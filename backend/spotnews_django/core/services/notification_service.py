import os
import logging
from typing import Optional, List, Dict, Any
import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin.exceptions import FirebaseError
from django.conf import settings
import psycopg2

logger = logging.getLogger(__name__)

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    # Try locating firebase_service_account.json
    candidates = [
        getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None),
        os.path.join(settings.BASE_DIR, 'firebase_service_account.json'),
        os.path.join(settings.BASE_DIR, '..', 'firebase_service_account.json'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'firebase_service_account.json'),
    ]

    cred_path = None
    for path in candidates:
        if path and os.path.exists(path):
            cred_path = path
            break

    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    if cred_path:
        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialized successfully using %s", cred_path)
        return _firebase_app

    # Fallback to environment variable (useful on Render/Heroku)
    raw_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
    if raw_json:
        try:
            import json
            cred_dict = json.loads(raw_json)
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully from FIREBASE_SERVICE_ACCOUNT_JSON env var")
            return _firebase_app
        except Exception as e:
            logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var: %s", e)

    raise FileNotFoundError("firebase_service_account.json could not be found and FIREBASE_SERVICE_ACCOUNT_JSON env var is not set.")


def send_topic_notification(
    title: str,
    body: str,
    topic: str = "all",
    url: str = "/",
    image_url: Optional[str] = None,
    channel_id: str = "news",
    extra_data: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Send a push notification to an FCM topic ('all', 'district_1', etc.).
    """
    get_firebase_app()

    data_payload = {
        "url": url or "/",
        "channel_id": channel_id,
        "title": title,
        "body": body,
    }
    if image_url:
        data_payload["image_url"] = image_url
    if extra_data:
        for k, v in extra_data.items():
            data_payload[str(k)] = str(v)

    notification_kwargs = {"title": title, "body": body}
    if image_url:
        notification_kwargs["image"] = image_url

    message = messaging.Message(
        topic=topic,
        notification=messaging.Notification(**notification_kwargs),
        data=data_payload,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id=channel_id,
                sound="default",
                color="#D61F3A",
                image=image_url if image_url else None,
            ),
        ),
    )

    try:
        response = messaging.send(message)
        logger.info("Sent topic notification [%s] message_id: %s", topic, response)
        return {"success": True, "message_id": response, "topic": topic}
    except Exception as e:
        logger.error("Failed to send topic notification [%s]: %s", topic, str(e))
        return {"success": False, "error": str(e), "topic": topic}


def send_token_notification(
    token: str,
    title: str,
    body: str,
    url: str = "/",
    image_url: Optional[str] = None,
    channel_id: str = "news",
    extra_data: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Send a push notification to a specific FCM device token.
    """
    get_firebase_app()

    data_payload = {
        "url": url or "/",
        "channel_id": channel_id,
        "title": title,
        "body": body,
    }
    if image_url:
        data_payload["image_url"] = image_url
    if extra_data:
        for k, v in extra_data.items():
            data_payload[str(k)] = str(v)

    notification_kwargs = {"title": title, "body": body}
    if image_url:
        notification_kwargs["image"] = image_url

    message = messaging.Message(
        token=token,
        notification=messaging.Notification(**notification_kwargs),
        data=data_payload,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id=channel_id,
                sound="default",
                color="#D61F3A",
                image=image_url if image_url else None,
            ),
        ),
    )

    try:
        response = messaging.send(message)
        return {"success": True, "message_id": response, "token": token}
    except messaging.UnregisteredError:
        logger.warning("Token unregistered/stale: %s. Cleaning from database...", token[:15])
        _remove_stale_token(token)
        return {"success": False, "error": "Token unregistered", "stale": True}
    except Exception as e:
        logger.error("Failed to send token notification: %s", str(e))
        return {"success": False, "error": str(e)}


def send_user_notification(
    user_id: str,
    title: str,
    body: str,
    url: str = "/",
    image_url: Optional[str] = None,
    channel_id: str = "reporter",
    extra_data: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Send a push notification to all devices registered for a specific user.
    """
    tokens = _get_tokens_for_user(user_id)
    if not tokens:
        return {"success": False, "error": f"No active device tokens found for user {user_id}"}

    success_count = 0
    failures = []
    for token in tokens:
        res = send_token_notification(
            token=token,
            title=title,
            body=body,
            url=url,
            image_url=image_url,
            channel_id=channel_id,
            extra_data=extra_data,
        )
        if res.get("success"):
            success_count += 1
        else:
            failures.append(res)

    return {
        "success": success_count > 0,
        "sent_count": success_count,
        "total_devices": len(tokens),
        "failures": failures,
    }


def _get_tokens_for_user(user_id: str) -> List[str]:
    """
    Fetch device tokens from PostgreSQL public.device_tokens
    """
    try:
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("SELECT token FROM public.device_tokens WHERE user_id = %s;", (user_id,))
            rows = cur.fetchall()
            return [r[0] for r in rows if r[0]]
    except Exception as dj_err:
        logger.warning("Django connection error for tokens, trying psycopg2 fallback: %s", dj_err)
        db_url = getattr(settings, 'DATABASE_URL', None) or os.getenv('DATABASE_URL')
        if not db_url:
            return []
        try:
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            cur.execute("SELECT token FROM public.device_tokens WHERE user_id = %s;", (user_id,))
            rows = cur.fetchall()
            conn.close()
            return [r[0] for r in rows if r[0]]
        except Exception as e:
            logger.error("Error fetching tokens for user %s: %s", user_id, str(e))
            return []


def _remove_stale_token(token: str):
    """
    Remove unregistered/stale FCM token from public.device_tokens
    """
    try:
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("DELETE FROM public.device_tokens WHERE token = %s;", (token,))
    except Exception as dj_err:
        logger.warning("Django connection error for token deletion, trying psycopg2 fallback: %s", dj_err)
        db_url = getattr(settings, 'DATABASE_URL', None) or os.getenv('DATABASE_URL')
        if not db_url:
            return
        try:
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            cur.execute("DELETE FROM public.device_tokens WHERE token = %s;", (token,))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error("Error deleting stale token: %s", str(e))
