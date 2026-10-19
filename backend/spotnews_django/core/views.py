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
    token = body_data.get("token")
    url = body_data.get("url", "/")
    image_url = body_data.get("image_url")
    channel_id = body_data.get("channel_id", "news")
    extra_data = body_data.get("data")

    from core.services.notification_service import (
        send_topic_notification,
        send_token_notification,
        send_user_notification,
    )

    try:
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
        elif user_id or email:
            result = send_user_notification(
                user_id=user_id,
                email=email,
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
