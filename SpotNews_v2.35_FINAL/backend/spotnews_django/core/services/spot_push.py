"""
District push notifications for RTI Express Spot News 24x7.

Topics (app v2.35 and later):
    dist_<district_slug>   e.g. dist_guntur, dist_sri_potti_sriramulu_nellore
    readers                every reader (announcements)
Old app versions (before v2.35) only listen to the topic 'all', so news is also sent to 'all'
to keep them working exactly as before.
"""
import logging
import re
import threading
from typing import Optional

from firebase_admin import messaging

from core.services.notification_service import get_firebase_app, DEFAULT_APP_LOGO

logger = logging.getLogger(__name__)


def district_topic(name: Optional[str]) -> Optional[str]:
    slug = re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_")
    if not slug or slug in ("all", "all_districts"):
        return None
    return f"dist_{slug}"


def _condition(district: Optional[str], include_old_apps: bool) -> str:
    t = district_topic(district)
    target = f"'{t}' in topics" if t else "'readers' in topics"
    return f"{target} || 'all' in topics" if include_old_apps else target


def send_condition(condition: str, title: str, body: str, url: str = "/", image_url: Optional[str] = None,
                   channel_id: str = "news", tag: Optional[str] = None) -> dict:
    try:
        get_firebase_app()
    except Exception as e:  # e.g. TEST server without Firebase
        logger.warning("Push skipped, Firebase not set up: %s", e)
        return {"success": False, "error": "firebase not configured"}
    image = image_url or DEFAULT_APP_LOGO
    data = {"url": url or "/", "channel_id": channel_id, "title": title, "body": body, "image_url": image}
    message = messaging.Message(
        condition=condition,
        notification=messaging.Notification(title=title, body=body, image=image),
        data=data,
        android=messaging.AndroidConfig(
            priority="high",
            collapse_key=tag,
            notification=messaging.AndroidNotification(
                channel_id=channel_id, sound="default", color="#015BB3", image=image, icon="ic_stat_logo", tag=tag,
            ),
        ),
    )
    try:
        mid = messaging.send(message)
        logger.info("Push sent [%s] %s", condition, mid)
        return {"success": True, "message_id": mid, "condition": condition}
    except Exception as e:  # never break the caller
        logger.error("Push failed [%s]: %s", condition, e)
        return {"success": False, "error": str(e), "condition": condition}


def send_to_district(district: Optional[str], title: str, body: str, url: str = "/", image_url: Optional[str] = None,
                     channel_id: str = "news", include_old_apps: bool = True, tag: Optional[str] = None) -> dict:
    return send_condition(_condition(district, include_old_apps), title, body, url, image_url, channel_id, tag)


def send_in_background(**kwargs) -> None:
    threading.Thread(target=lambda: send_to_district(**kwargs), daemon=True).start()
