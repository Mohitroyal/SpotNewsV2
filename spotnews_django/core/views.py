from django.http import JsonResponse
from django.shortcuts import redirect
from django.conf import settings

def home_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard:dashboard')
    return redirect('accounts:login')

def health_check(request):
    return JsonResponse({
        "status": "ok",
        "service": "spotnews-django"
    })

def health_msg91(request):
    return JsonResponse({
        "configured": bool(settings.MSG91_AUTHKEY),
        "provider": "MSG91",
        "flow_id_configured": bool(settings.MSG91_TEMPLATE_ID),
        "sender_configured": bool(settings.MSG91_SENDER_ID)
    })

import base64
import json
import time
from django.db import connection
from django.views.decorators.csrf import csrf_exempt

def check_jwt(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return False, JsonResponse({"detail": "Missing Authorization header"}, status=401)
    
    token = auth_header.split(" ")[1]
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False, JsonResponse({"detail": "Invalid token format"}, status=401)
        
        payload_b64 = parts[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)
        
        if payload.get("exp") and payload["exp"] < time.time():
            return False, JsonResponse({"detail": "Token has expired"}, status=401)
            
        return True, None
    except Exception as e:
        print(f"JWT Decode Error: {e}")
        return False, JsonResponse({"detail": "Invalid token"}, status=401)

@csrf_exempt
def admin_stats(request):
    is_valid, error_response = check_jwt(request)
    if not is_valid:
        return error_response

    total_users = 0
    total_gens = 0
    gens_today = 0
    active_users_today = 0
    
    try:
        with connection.cursor() as cursor:
            # Total Users
            cursor.execute("SELECT COUNT(*) FROM auth.users")
            row = cursor.fetchone()
            if row: total_users = row[0]

            # Total Generations
            cursor.execute("SELECT COUNT(*) FROM clippings")
            row = cursor.fetchone()
            if row: total_gens = row[0]

            # Generations Today (IST)
            cursor.execute("SELECT COUNT(*) FROM clippings WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')")
            row = cursor.fetchone()
            if row: gens_today = row[0]
            
            # Active Users Today (IST)
            cursor.execute("SELECT COUNT(DISTINCT user_id) FROM clippings WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')")
            row = cursor.fetchone()
            if row: active_users_today = row[0]
    except Exception as e:
        print(f"Error fetching stats: {e}")

    return JsonResponse({
        "totalUsers": total_users,
        "totalGenerationsAllTime": total_gens,
        "totalGenerationsToday": gens_today,
        "activeUsersToday": active_users_today,
        "totalLogos": 4,
        "debug_info": "Updated Django backend stats"
    })

@csrf_exempt
def admin_auth_users(request):
    is_valid, error_response = check_jwt(request)
    if not is_valid:
        return error_response

    users = []
    try:
        with connection.cursor() as cursor:
            # Query auth.users and join with clippings for stats
            query = """
                SELECT 
                    u.id, u.email, u.phone, p.role, u.created_at, u.raw_user_meta_data->>'full_name' as full_name, p.plan,
                    (SELECT COUNT(*) FROM clippings c WHERE c.user_id = u.id) as total_generations,
                    (SELECT COUNT(*) FROM clippings c WHERE c.user_id = u.id AND DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) as generations_today,
                    u.last_sign_in_at
                FROM auth.users u
                LEFT JOIN profiles p ON p.id = u.id
                ORDER BY u.created_at DESC NULLS LAST
                LIMIT 500
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            for r in rows:
                users.append({
                    "id": str(r[0]) if r[0] else "",
                    "email": r[1] or "",
                    "phone_number": r[2] or "",
                    "role": r[3] or "user",
                    "created_at": str(r[4]) if r[4] else "",
                    "full_name": r[5] or "",
                    "plan": r[6] or "free",
                    "total_generations": r[7] or 0,
                    "generations_today": r[8] or 0,
                    "last_sign_in_at": str(r[9]) if r[9] else "",
                    "is_banned": False,
                    "banned_until": ""
                })
    except Exception as e:
        print(f"Error fetching auth.users: {e}")
        return JsonResponse({"detail": str(e)}, status=500)
    return JsonResponse(users, safe=False)

@csrf_exempt
def send_notification_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)

    try:
        body_data = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        body_data = {}

    title = body_data.get("title", "").strip()
    body = body_data.get("body", "").strip()
    if not title or not body:
        return JsonResponse({"error": "'title' and 'body' are required fields."}, status=400)

    topic = body_data.get("topic")
    user_id = body_data.get("user_id")
    email = body_data.get("email")
    phone = body_data.get("phone")
    token = body_data.get("token")
    url = body_data.get("url", "/")
    image_url = body_data.get("image_url")
    channel_id = body_data.get("channel_id", "news")
    extra_data = body_data.get("data")

    try:
        from core.services.notification_service import (
            send_topic_notification,
            send_token_notification,
            send_user_notification,
        )

        if token:
            result = send_token_notification(
                token=token,
                title=title,
                body=body,
                url=url,
                image_url=image_url,
                channel_id=channel_id,
                extra_data=extra_data,
            )
        elif user_id or email or phone:
            result = send_user_notification(
                user_id=user_id,
                email=email,
                phone=phone,
                title=title,
                body=body,
                url=url,
                image_url=image_url,
                channel_id=channel_id,
                extra_data=extra_data,
            )
        else:
            target_topic = topic or "all"
            result = send_topic_notification(
                title=title,
                body=body,
                topic=target_topic,
                url=url,
                image_url=image_url,
                channel_id=channel_id,
                extra_data=extra_data,
            )

        status_code = 200 if result.get("success") else 500
        return JsonResponse(result, status=status_code)
    except Exception as e:
        import traceback
        logger.error("Exception in send_notification_view: %s\n%s", str(e), traceback.format_exc())
        return JsonResponse({"error": str(e), "traceback": traceback.format_exc()}, status=500)

@csrf_exempt
def send_approval_sms_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)
    try:
        body_data = json.loads(request.body.decode("utf-8")) if request.body else {}
        phone = body_data.get("phone", "").strip()
        name = body_data.get("name", "Reporter").strip()
        message = body_data.get("message", f"Spot News 24x7: Congratulations {name}! Your reporter application has been APPROVED. Open Spot News app and set up your Press ID Card to complete login.").strip()

        clean_digits = "".join(filter(str.isdigit, str(phone)))
        if len(clean_digits) == 10:
            clean_digits = "91" + clean_digits

        if not clean_digits or len(clean_digits) != 12:
            return JsonResponse({"error": "Invalid phone number", "received": phone}, status=400)

        sms_result = {"phone": clean_digits, "name": name}
        if settings.MSG91_AUTHKEY:
            try:
                import httpx
                headers = {
                    "authkey": settings.MSG91_AUTHKEY,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                }
                template_id = getattr(settings, 'MSG91_APPROVAL_TEMPLATE_ID', '') or settings.MSG91_TEMPLATE_ID
                flow_payload = {
                    "flow_id": template_id,
                    "sender": settings.MSG91_SENDER_ID,
                    "short_url": "0",
                    "recipients": [
                        {
                            "mobiles": clean_digits,
                            "name": name,
                            settings.MSG91_OTP_VARIABLE: "APPROVED"
                        }
                    ]
                }
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post("https://api.msg91.com/api/v5/flow/", json=flow_payload, headers=headers)
                    sms_result["status"] = resp.status_code
                    sms_result["body"] = resp.text
                    sms_result["success"] = resp.status_code == 200
            except Exception as msgErr:
                logger.warning(f"[MSG91] Error sending approval SMS: {msgErr}")
                sms_result["error"] = str(msgErr)
                sms_result["success"] = False
        else:
            logger.info(f"[MSG91-MOCK] Would send approval SMS to {clean_digits}: {message}")
            sms_result["mock"] = True
            sms_result["success"] = True

        return JsonResponse({"success": True, "message": "Approval SMS processed", "result": sms_result})
    except Exception as e:
        logger.error(f"Approval SMS error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def device_tokens_stats_view(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*), COUNT(DISTINCT user_id) FROM public.device_tokens;")
            row = cursor.fetchone()
            total_tokens = row[0] if row else 0
            unique_users = row[1] if row else 0

            cursor.execute("SELECT district_id, COUNT(*) FROM public.device_tokens GROUP BY district_id;")
            districts = {str(r[0]): r[1] for r in cursor.fetchall()}

        return JsonResponse({
            "total_device_tokens": total_tokens,
            "unique_registered_users": unique_users,
            "tokens_by_district": districts,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

from django.http import HttpResponse

def story_share_view(request, clip_id):
    """
    Renders an HTML page with Open Graph (OG) meta tags so WhatsApp, Telegram, etc.
    display the clipping image as a rich preview card.
    When tapped in WhatsApp, it opens this URL which redirects directly into the app
    if installed, or prompts to download from Google Play if not installed.
    """
    headline = "RTI Express Spot News 24x7"
    png_url = ""
    summary = "పూర్తి వార్త యాప్‌లో చదవండి — RTI Express Spot News 24x7"
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT headline, png_url, summary FROM public.clippings WHERE id = %s", [str(clip_id)])
            row = cursor.fetchone()
            if row:
                headline = row[0] or headline
                png_url = row[1] or ""
                summary = row[2] or summary
    except Exception as e:
        print(f"Error fetching clipping {clip_id}: {e}")

    # Fallback to Supabase REST if connection failed or not found in local cursor
    if not png_url:
        try:
            import urllib.request
            supa_url = f"https://rffrqokpnqoycpozrjuc.supabase.co/rest/v1/clippings?id=eq.{clip_id}&select=headline,png_url,summary"
            anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZnJxb2twbnFveWNwb3pyanVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDE4MjUsImV4cCI6MjA5NDUxNzgyNX0.9BcRAPuhoK1C6SMeUvexABXp5HW2dfEJbdcRT_2FiL4"
            req = urllib.request.Request(supa_url, headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "User-Agent": "SpotNewsBackend/1.0"
            })
            with urllib.request.urlopen(req, timeout=5) as res:
                data = json.loads(res.read().decode('utf-8'))
                if data and len(data) > 0:
                    headline = data[0].get("headline") or headline
                    png_url = data[0].get("png_url") or ""
                    summary = data[0].get("summary") or summary
        except Exception as err:
            print(f"Supabase fallback fetch error: {err}")

    package_name = "com.newscraft.mobile"
    play_store_url = f"https://play.google.com/store/apps/details?id={package_name}"
    scheme_url = f"spotnews://feed?clipId={clip_id}"
    intent_url = f"intent://feed?clipId={clip_id}#Intent;scheme=spotnews;package={package_name};S.browser_fallback_url={play_store_url};end"
    share_url = request.build_absolute_uri()

    html = f"""<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{headline} | RTI Express Spot News 24x7</title>
    
    <!-- WhatsApp & Social Open Graph Tags (Way2News style) -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="RTI Express Spot News 24x7" />
    <meta property="og:title" content="{headline}" />
    <meta property="og:description" content="పూర్తి వార్త చదవడానికి క్లిక్ చేయండి - RTI Express Spot News 24x7" />
    <meta property="og:image" content="{png_url}" />
    <meta property="og:image:secure_url" content="{png_url}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1080" />
    <meta property="og:image:height" content="1350" />
    <meta property="og:url" content="{share_url}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{headline}" />
    <meta name="twitter:description" content="పూర్తి వార్త చదవడానికి క్లిక్ చేయండి - RTI Express Spot News 24x7" />
    <meta name="twitter:image" content="{png_url}" />

    <!-- App Links for Android -->
    <meta property="al:android:url" content="{scheme_url}" />
    <meta property="al:android:package" content="{package_name}" />
    <meta property="al:android:app_name" content="Spot News 24x7" />

    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background: #0b1523;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }}
        .container {{
            max-width: 480px;
            width: 100%;
            background: linear-gradient(145deg, #132238 0%, #0b1523 100%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 24px 20px 20px;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }}
        .brand-badge {{
            display: inline-block;
            background: rgba(20, 90, 177, 0.25);
            border: 1px solid rgba(20, 90, 177, 0.5);
            color: #4da3ff;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 14px;
        }}
        .headline {{
            font-size: 18px;
            font-weight: 800;
            line-height: 1.45;
            margin-bottom: 14px;
            color: #ffffff;
            word-break: break-word;
        }}
        .clipping-img {{
            width: 100%;
            max-height: 380px;
            object-fit: contain;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: #050b14;
            margin-bottom: 16px;
            cursor: pointer;
            display: block;
        }}
        .btn {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 15px;
            margin-bottom: 10px;
            border: none;
            cursor: pointer;
            transition: opacity 0.2s;
        }}
        .btn-app {{
            background: linear-gradient(135deg, #015BB3 0%, #0284c7 100%);
            color: #ffffff !important;
            box-shadow: 0 4px 14px rgba(1, 91, 179, 0.4);
        }}
        .btn-playstore {{
            background: linear-gradient(135deg, #00875a 0%, #006644 100%);
            color: #ffffff !important;
            box-shadow: 0 4px 14px rgba(0, 135, 90, 0.4);
        }}
        .footer-text {{
            font-size: 12px;
            color: #718096;
            margin-top: 10px;
            line-height: 1.4;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="brand-badge">⚡ RTI Express Spot News 24x7</div>
        <h1 class="headline">{headline}</h1>
        {f'<img class="clipping-img" src="{png_url}" alt="News Clipping" onclick="openApp()" />' if png_url else ''}
        <a href="{scheme_url}" class="btn btn-app" onclick="openApp(); return false;">🚀 యాప్‌లో తెరవండి (Open in App)</a>
        <a href="{play_store_url}" class="btn btn-playstore" target="_blank" rel="noopener">📥 Google Play నుండి డౌన్‌లోడ్ చేయండి</a>
        <p class="footer-text">యాప్ మీ ఫోన్‌లో ఇప్పటికే ఉంటే "యాప్‌లో తెరవండి" పై క్లిక్ చేయండి.</p>
    </div>

    <script>
        function openApp() {{
            window.location.href = "{scheme_url}";
            setTimeout(function() {{
                window.location.href = "{intent_url}";
            }}, 400);
        }}
        // If opened on Android device, attempt auto-redirect to app
        if (/Android/i.test(navigator.userAgent)) {{
            openApp();
        }}
    </script>
</body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8")

