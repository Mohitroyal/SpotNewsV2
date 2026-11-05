import os
import time
import logging
import threading
from typing import Optional, List, Dict, Any
import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin.exceptions import FirebaseError
from django.conf import settings
import psycopg2

logger = logging.getLogger(__name__)

LIVE_DB_URL = "postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

def get_db_url() -> str:
    return getattr(settings, 'DATABASE_URL', None) or os.getenv('DATABASE_URL') or LIVE_DB_URL

def get_pg_conn():
    return psycopg2.connect(get_db_url())

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    # 1. Try locating firebase_service_account.json
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
        start_notification_worker_if_needed()
        return _firebase_app
    except ValueError:
        pass

    if cred_path:
        try:
            cred = credentials.Certificate(cred_path)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully using %s", cred_path)
            start_notification_worker_if_needed()
            return _firebase_app
        except Exception as e:
            logger.warning("Failed initializing Firebase with file %s: %s", cred_path, e)

    # 2. Fallback to environment variable (useful on Render/Heroku)
    raw_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
    if raw_json:
        try:
            import json
            cred_dict = json.loads(raw_json)
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully from FIREBASE_SERVICE_ACCOUNT_JSON env var")
            start_notification_worker_if_needed()
            return _firebase_app
        except Exception as e:
            logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var: %s", e)

    # 3. Fallback to Supabase Database (public.app_config table)
    try:
        import json
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("SELECT config_value FROM public.app_config WHERE config_key = 'firebase_service_account' LIMIT 1;")
        row = cur.fetchone()
        conn.close()
        if row and row[0]:
            cred_dict = json.loads(row[0])
            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully from database public.app_config table")
            start_notification_worker_if_needed()
            return _firebase_app
    except Exception as pg_err:
        logger.error("Failed connecting to database for Firebase credentials: %s", pg_err)

    raise FileNotFoundError("firebase_service_account.json could not be found, FIREBASE_SERVICE_ACCOUNT_JSON env var is not set, and database config is unavailable.")


DEFAULT_APP_LOGO = "https://rffrqokpnqoycpozrjuc.supabase.co/storage/v1/object/public/newscraft-clippings/assets/app_logo.png"


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
    Also sends direct multicast to all registered devices in public.device_tokens.
    """
    get_firebase_app()

    if not image_url:
        image_url = DEFAULT_APP_LOGO

    data_payload = {
        "url": url or "/",
        "channel_id": channel_id,
        "title": title,
        "body": body,
        "image_url": image_url,
    }
    if extra_data:
        for k, v in extra_data.items():
            data_payload[str(k)] = str(v)

    notification_kwargs = {"title": title, "body": body, "image": image_url}

    message = messaging.Message(
        topic=topic,
        notification=messaging.Notification(**notification_kwargs),
        data=data_payload,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id=channel_id,
                sound="default",
                color="#015BB3",
                image=image_url,
                icon="ic_stat_logo",
            ),
        ),
    )

    # 1. Send to FCM topic
    topic_res = None
    try:
        topic_res = messaging.send(message)
        logger.info("Sent topic notification [%s] message_id: %s", topic, topic_res)
    except Exception as e:
        logger.warning("Topic notification [%s] failed (will try direct device multicast): %s", topic, str(e))

    # 2. Direct multicast to all registered device tokens in public.device_tokens
    # Ensures all app users receive the push notification even if topic subscription was missed
    multicast_sent = 0
    multicast_failed = 0
    try:
        all_tokens = _get_all_device_tokens()
        if all_tokens:
            batch_size = 500
            for i in range(0, len(all_tokens), batch_size):
                batch = all_tokens[i:i + batch_size]
                multicast_msg = messaging.MulticastMessage(
                    tokens=batch,
                    notification=messaging.Notification(**notification_kwargs),
                    data=data_payload,
                    android=messaging.AndroidConfig(
                        priority="high",
                        notification=messaging.AndroidNotification(
                            channel_id=channel_id,
                            sound="default",
                            color="#015BB3",
                            image=image_url,
                            icon="ic_stat_logo",
                        ),
                    ),
                )
                batch_response = messaging.send_each_for_multicast(multicast_msg)
                multicast_sent += batch_response.success_count
                multicast_failed += batch_response.failure_count
                for idx, resp in enumerate(batch_response.responses):
                    if not resp.success and resp.exception:
                        exc_str = str(resp.exception).lower()
                        if "not-registered" in exc_str or "unregistered" in exc_str or "invalid-argument" in exc_str:
                            _remove_stale_token(batch[idx])
            logger.info("Direct multicast delivered to %d tokens (success: %d, failure: %d)",
                        len(all_tokens), multicast_sent, multicast_failed)
    except Exception as multi_err:
        logger.warning("Direct multicast error: %s", multi_err)

    if topic_res or multicast_sent > 0:
        return {"success": True, "message_id": topic_res or "multicast_direct", "topic": topic, "direct_sent": multicast_sent}
    else:
        return {"success": False, "error": "Failed to deliver topic notification and no device tokens reached", "topic": topic}


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

    if not image_url:
        image_url = DEFAULT_APP_LOGO

    data_payload = {
        "url": url or "/",
        "channel_id": channel_id,
        "title": title,
        "body": body,
        "image_url": image_url,
    }
    if extra_data:
        for k, v in extra_data.items():
            data_payload[str(k)] = str(v)

    notification_kwargs = {"title": title, "body": body, "image": image_url}

    message = messaging.Message(
        token=token,
        notification=messaging.Notification(**notification_kwargs),
        data=data_payload,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id=channel_id,
                sound="default",
                color="#015BB3",
                image=image_url,
                icon="ic_stat_logo",
            ),
        ),
    )

    try:
        res = messaging.send(message)
        logger.info("Successfully sent token notification: %s", res)
        return {"success": True, "message_id": res}
    except FirebaseError as fe:
        err_msg = str(fe)
        logger.warning("FirebaseError sending to token %s: %s", token, err_msg)
        if "not-registered" in err_msg.lower() or "unregistered" in err_msg.lower():
            _remove_stale_token(token)
        return {"success": False, "error": err_msg}
    except Exception as e:
        logger.error("Unexpected error sending to token %s: %s", token, e)
        return {"success": False, "error": str(e)}


def send_user_notification(
    user_id: Optional[str] = None,
    title: str = "",
    body: str = "",
    url: str = "/",
    image_url: Optional[str] = None,
    channel_id: str = "reporter",
    extra_data: Optional[Dict[str, str]] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send a push notification to all devices registered for a specific user, email, or phone.
    """
    tokens = _get_tokens_for_user(user_id=user_id, email=email, phone=phone)
    if not tokens:
        return {"success": False, "error": f"No active device tokens found for user={user_id} email={email} phone={phone}"}

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


def _get_all_device_tokens() -> List[str]:
    """
    Fetch all active FCM device tokens from public.device_tokens using direct Postgres connection
    """
    tokens = []
    try:
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT token FROM public.device_tokens WHERE token IS NOT NULL AND LENGTH(token) > 10;")
        rows = cur.fetchall()
        conn.close()
        tokens = [r[0] for r in rows if r[0]]
    except Exception as e:
        logger.error("Error fetching all tokens from PostgreSQL: %s", str(e))
    return tokens


def _get_tokens_for_user(user_id: Optional[str] = None, email: Optional[str] = None, phone: Optional[str] = None) -> List[str]:
    """
    Fetch device tokens from PostgreSQL public.device_tokens by user_id, email, or phone
    """
    tokens = []
    conn = None
    try:
        conn = get_pg_conn()
        cur = conn.cursor()

        if user_id:
            cur.execute("SELECT token FROM public.device_tokens WHERE user_id::text = %s;", (str(user_id),))
            rows = cur.fetchall()
            tokens = [r[0] for r in rows if r[0]]

            # If no token by direct user_id, enrich email/phone from profiles
            if not tokens:
                try:
                    cur.execute("SELECT email, phone FROM public.profiles WHERE id::text = %s;", (str(user_id),))
                    p_row = cur.fetchone()
                    if p_row:
                        if not email and p_row[0]:
                            email = p_row[0]
                        if not phone and p_row[1]:
                            phone = p_row[1]
                except Exception as p_err:
                    logger.warning("Could not enrich user email/phone from profiles: %s", p_err)

        if not tokens and email:
            clean_email = email.strip().lower()
            cur.execute("""
                SELECT dt.token 
                FROM public.device_tokens dt
                JOIN public.profiles p ON dt.user_id = p.id
                WHERE LOWER(p.email) = %s;
            """, (clean_email,))
            rows = cur.fetchall()
            tokens = [r[0] for r in rows if r[0]]

        if not tokens and phone:
            clean_phone = "".join(filter(str.isdigit, str(phone)))[-10:]
            if clean_phone:
                cur.execute("""
                    SELECT dt.token 
                    FROM public.device_tokens dt
                    JOIN public.profiles p ON dt.user_id = p.id
                    WHERE p.phone LIKE %s;
                """, (f"%{clean_phone}%",))
                rows = cur.fetchall()
                tokens = [r[0] for r in rows if r[0]]

        conn.close()
    except Exception as e:
        if conn:
            conn.close()
        logger.error("Error fetching tokens for user %s: %s", user_id, str(e))

    return tokens


def _remove_stale_token(token: str):
    """
    Remove unregistered/stale FCM token from public.device_tokens
    """
    try:
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM public.device_tokens WHERE token = %s;", (token,))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Error deleting stale token: %s", str(e))


def process_notification_events(batch_size: int = 10) -> Dict[str, Any]:
    """
    Atomically claims and dispatches pending notification events from public.notification_events.
    Guarantees exactly-once processing with database row-level locking (SKIP LOCKED).
    Works for both Auto-Accept and Normal Accept automatically.
    """
    processed_count = 0
    failed_count = 0
    events = []

    try:
        conn = get_pg_conn()
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, clipping_id, title, body, topic, district, user_id, user_email, png_url
                FROM public.notification_events
                WHERE status IN ('pending', 'failed') AND attempts < 5
                ORDER BY created_at ASC
                LIMIT %s
                FOR UPDATE SKIP LOCKED;
            """, (batch_size,))
            rows = cur.fetchall()
            for r in rows:
                events.append({
                    "id": str(r[0]),
                    "clipping_id": str(r[1]),
                    "title": r[2],
                    "body": r[3],
                    "topic": r[4] or "all",
                    "district": r[5],
                    "user_id": str(r[6]) if r[6] else None,
                    "user_email": r[7],
                    "png_url": r[8],
                })
        conn.commit()
        conn.close()
    except Exception as claim_err:
        logger.error("[NotificationWorker] Error claiming events: %s", claim_err)
        return {"processed": 0, "failed": 0, "error": str(claim_err)}

    if not events:
        return {"processed": 0, "failed": 0, "events": []}

    logger.info("[NotificationWorker] Processing %d pending notification event(s)...", len(events))

    for ev in events:
        event_id = ev["id"]
        clipping_id = ev["clipping_id"]
        title = ev["title"]
        body = ev["body"]
        topic = ev["topic"]
        png_url = ev["png_url"]
        user_id = ev["user_id"]
        user_email = ev["user_email"]
        url = f"/n/{clipping_id}"

        dispatch_success = False
        error_msg = None

        try:
            # 1. Send topic broadcast to readers (and direct device token multicast)
            topic_res = send_topic_notification(
                title=title,
                body=body,
                topic=topic,
                url=url,
                image_url=png_url,
                channel_id="news",
                extra_data={"clipId": clipping_id, "id": clipping_id, "url": url},
            )

            # 2. If clipping belongs to a reporter, send user push notification & save in-app alert
            reporter_res = None
            if user_id:
                try:
                    reporter_title = "🎉 మీ వార్త ఆమోదించబడింది! (Clipping Approved)"
                    reporter_body = f"అభినందనలు! \"{title[:40]}\" లైవ్ ఫీడ్‌లో ప్రచురించబడింది."
                    reporter_res = send_user_notification(
                        user_id=user_id,
                        email=user_email,
                        title=reporter_title,
                        body=reporter_body,
                        url=url,
                        image_url=png_url,
                        channel_id="reporter",
                        extra_data={"clipId": clipping_id, "id": clipping_id, "url": url},
                    )

                    # Persist in-app notification in public.notifications
                    try:
                        conn_notif = get_pg_conn()
                        with conn_notif.cursor() as cur_notif:
                            cur_notif.execute("""
                                INSERT INTO public.notifications (
                                    user_id, title, message, is_read, notification_type, user_email
                                ) VALUES (%s, %s, %s, false, 'clipping_approved', %s)
                            """, (user_id, reporter_title, reporter_body, user_email or ''))
                        conn_notif.commit()
                        conn_notif.close()
                    except Exception as inapp_err:
                        logger.warning("[NotificationWorker] In-app alert insert warning: %s", inapp_err)

                except Exception as rep_err:
                    logger.warning("[NotificationWorker] Reporter notification warning: %s", rep_err)

            if topic_res.get("success") or (reporter_res and reporter_res.get("success")):
                dispatch_success = True
            else:
                error_msg = topic_res.get("error") or "FCM delivery failed"

        except Exception as dispatch_err:
            dispatch_success = False
            error_msg = str(dispatch_err)
            logger.error("[NotificationWorker] Exception dispatching event %s: %s", event_id, dispatch_err)

        # 3. Update database state
        try:
            conn_up = get_pg_conn()
            with conn_up.cursor() as cur_up:
                if dispatch_success:
                    cur_up.execute("""
                        UPDATE public.notification_events
                        SET status = 'sent', processed_at = NOW(), attempts = attempts + 1, last_error = NULL
                        WHERE id = %s;
                        
                        UPDATE public.clippings
                        SET approval_notified = true
                        WHERE id = %s;
                    """, (event_id, clipping_id))
                    processed_count += 1
                else:
                    cur_up.execute("""
                        UPDATE public.notification_events
                        SET status = 'failed', attempts = attempts + 1, last_error = %s
                        WHERE id = %s;
                    """, (error_msg, event_id))
                    failed_count += 1
            conn_up.commit()
            conn_up.close()
        except Exception as up_err:
            logger.error("[NotificationWorker] Failed updating event %s status: %s", event_id, up_err)

    return {"processed": processed_count, "failed": failed_count, "total": len(events)}


_worker_thread = None
_worker_lock = threading.Lock()

def start_notification_worker_if_needed():
    """
    Starts an asynchronous background daemon thread to monitor and dispatch pending notification events.
    Runs reliably without requiring admin panel or user sessions.
    """
    global _worker_thread
    with _worker_lock:
        if _worker_thread is None or not _worker_thread.is_alive():
            def _loop():
                while True:
                    try:
                        process_notification_events(batch_size=10)
                    except Exception as loop_err:
                        logger.warning("[NotificationWorkerLoop] Exception: %s", loop_err)
                    time.sleep(15)

            _worker_thread = threading.Thread(target=_loop, daemon=True, name="NotificationOutboxWorker")
            _worker_thread.start()
            logger.info("NotificationOutboxWorker daemon started.")
