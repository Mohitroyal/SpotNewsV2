"""
Push a notification when something new goes live.

POST /v1/notify/clip  {"id": "<clipping id>"}   - after "Publish now" / direct publish from the app
POST /v1/notify/ad    {"id": "<local_ads id>"}  - after a new ad goes live

Safe to call from the app: the server reads the item from the database itself (the caller cannot choose the
text), only items that are live and less than 3 hours old are pushed, and each item is pushed only once.
"""
import json
import logging

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core.services.spot_push import send_to_district

logger = logging.getLogger(__name__)


def _body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        return {}


def _short(text, n=60):
    t = (text or "").strip().replace("\n", " ")
    return t if len(t) <= n else t[: n - 1] + "…"


@csrf_exempt
def notify_clip(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    cid = str(_body(request).get("id") or "").strip()
    if not cid or cid.startswith("local_"):
        return JsonResponse({"error": "id required"}, status=400)
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE clippings
                   SET custom_layout = coalesce(custom_layout, '{}'::jsonb) || '{"push_sent": true}'::jsonb
                 WHERE id::text = %s
                   AND status = 'approved' AND coalesce(is_posted, false)
                   AND created_at > now() - interval '3 hours'
                   AND coalesce((custom_layout->>'push_sent')::boolean, false) = false
                RETURNING headline, district, png_url
                """,
                [cid],
            )
            row = cur.fetchone()
        if not connection.in_atomic_block:
            connection.commit()
    except Exception as e:
        logger.error("notify_clip db error: %s", e)
        return JsonResponse({"error": "db"}, status=500)
    if not row:
        return JsonResponse({"sent": False, "reason": "not live, too old or already sent"})
    headline, district, png = row
    place = f"{district} · " if district and district != "All" else ""
    res = send_to_district(
        district=district, title=f"📰 {place}{_short(headline, 50)}",
        body="కొత్త వార్త వచ్చింది — ఇప్పుడే చదవండి", url=f"/feed?clipId={cid}", image_url=png,
        channel_id="news", include_old_apps=True,
    )
    return JsonResponse({"sent": res.get("success", False)})


@csrf_exempt
def notify_ad(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    aid = str(_body(request).get("id") or "").strip()
    if not aid:
        return JsonResponse({"error": "id required"}, status=400)
    try:
        with connection.cursor() as cur:
            # one-time flag column (added on first use; harmless if it already exists)
            cur.execute("ALTER TABLE local_ads ADD COLUMN IF NOT EXISTS push_sent_at timestamptz")
            cur.execute(
                """
                UPDATE local_ads SET push_sent_at = now()
                 WHERE id::text = %s AND status = 'active' AND push_sent_at IS NULL
                   AND created_at > now() - interval '3 hours'
                   -- at most one ad push per district every 20 minutes (no spam for readers)
                   AND NOT EXISTS (SELECT 1 FROM local_ads o
                                    WHERE coalesce(o.target_district, 'All') = coalesce(local_ads.target_district, 'All')
                                      AND o.push_sent_at > now() - interval '20 minutes')
                RETURNING title, target_district, media_url, media_type
                """,
                [aid],
            )
            row = cur.fetchone()
        if not connection.in_atomic_block:
            connection.commit()
    except Exception as e:
        logger.error("notify_ad db error: %s", e)
        return JsonResponse({"error": "db"}, status=500)
    if not row:
        return JsonResponse({"sent": False, "reason": "not live, too old or already sent"})
    title, district, media, mtype = row
    place = f"{district} · " if district and district != "All" else ""
    res = send_to_district(
        district=district, title=f"📣 {place}కొత్త ప్రకటన", body=_short(title, 80), url="/feed",
        image_url=media if mtype != "video" else None, channel_id="general", include_old_apps=False,
    )
    return JsonResponse({"sent": res.get("success", False)})
