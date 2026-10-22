import json
from django.http import JsonResponse
from django.db import connection
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def admin_generations(request):
    try:
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        offset = (page - 1) * page_size
        
        user_id = request.GET.get('user_id')
        district = request.GET.get('district')
        status = request.GET.get('status')
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')
        
        query = (
            "SELECT c.id, c.status, c.created_at, c.user_id, c.headline, c.template_id, "
            "c.language, c.tone, c.publication_name, c.publication_date, c.layout_columns, "
            "c.font_family, c.png_url, c.pdf_url, p.email, p.full_name, p.plan, "
            "c.district, c.state, c.is_posted "
            "FROM clippings c LEFT JOIN profiles p ON c.user_id = p.id"
        )
        count_query = "SELECT COUNT(*) FROM clippings c"
        
        where_clauses = []
        params = []
        
        if user_id:
            where_clauses.append("c.user_id = %s")
            params.append(user_id)
            
        if district and district.strip().lower() != 'all':
            where_clauses.append("LOWER(TRIM(COALESCE(c.district, ''))) = LOWER(TRIM(%s))")
            params.append(district.strip())
            
        if status and status.strip().lower() != 'all':
            st = status.strip().lower()
            if st == 'pending':
                where_clauses.append("(c.status = 'pending_approval' OR (COALESCE(c.is_posted, false) = false AND c.status != 'rejected'))")
            elif st == 'approved':
                where_clauses.append("(c.is_posted = true OR c.status = 'approved')")
            elif st == 'rejected':
                where_clauses.append("c.status = 'rejected'")

        if from_date:
            where_clauses.append("c.created_at >= %s")
            params.append(f"{from_date} 00:00:00+05:30")
        if to_date:
            where_clauses.append("c.created_at <= %s")
            params.append(f"{to_date} 23:59:59+05:30")
            
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)
            query += where_sql
            count_query += where_sql
            
        query_params = list(params)
        query += " ORDER BY c.created_at DESC LIMIT %s OFFSET %s"
        query_params.extend([page_size, offset])
        
        with connection.cursor() as cursor:
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            cursor.execute(query, query_params)
            rows = cursor.fetchall()
            
            results = []
            for r in rows:
                results.append({
                    "id": str(r[0]),
                    "status": r[1] or "completed",
                    "created_at": str(r[2]) if r[2] else "",
                    "user_id": str(r[3]),
                    "headline": r[4] or "Untitled",
                    "template_id": r[5] or "default",
                    "language": r[6] or "en",
                    "tone": r[7] or "formal",
                    "publication_name": r[8] or "",
                    "publication_date": str(r[9]) if r[9] else "",
                    "layout_columns": r[10] or 3,
                    "font_family": r[11] or "playfair",
                    "image_count": 0,
                    "png_url": r[12] or "",
                    "pdf_url": r[13] or "",
                    "user_email": r[14] or "",
                    "user_name": r[15] or "",
                    "user_plan": r[16] or "free",
                    "district": r[17] or "",
                    "state": r[18] or "",
                    "is_posted": bool(r[19]) if r[19] is not None else False
                })
                
        return JsonResponse({"total": total, "results": results})
    except Exception as e:
        print(f"Error fetching generations: {e}")
        return JsonResponse({"total": 0, "results": []})

@csrf_exempt
def admin_user_role(request, user_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            role = data.get('role', 'user')
            plan = data.get('plan')
            district = data.get('district')
            phone_number = data.get('phone_number')
            
            if role not in ('superadmin', 'admin', 'reporter', 'user'):
                return JsonResponse({"detail": f"Invalid role: {role}"}, status=400)
                
            with connection.cursor() as cursor:
                # If promoting to admin, enforce: every district will get one admin only
                if role == 'admin':
                    if not district or not str(district).strip():
                        return JsonResponse({
                            "detail": "An admin must be assigned to a specific district. Every district will get one admin only."
                        }, status=400)
                    
                    cleaned_district = str(district).strip()
                    # Check if another admin already occupies this district
                    cursor.execute("""
                        SELECT email, full_name, district 
                        FROM profiles 
                        WHERE role = 'admin' 
                          AND LOWER(TRIM(COALESCE(district, ''))) = LOWER(TRIM(%s)) 
                          AND id != %s
                    """, [cleaned_district, user_id])
                    existing = cursor.fetchone()
                    if existing:
                        admin_name = existing[0] or existing[1] or "another administrator"
                        return JsonResponse({
                            "detail": f"District '{cleaned_district}' already has an assigned admin ({admin_name}). Every district will get one admin only."
                        }, status=400)
                    
                    target_plan = plan or 'admin'
                    cursor.execute(
                        "UPDATE profiles SET role = %s, district = %s, plan = %s WHERE id = %s",
                        [role, cleaned_district, target_plan, user_id]
                    )
                else:
                    # Role is superadmin, reporter, or user
                    cleaned_district = str(district).strip() if district else None
                    if plan and plan in ('free', 'pro', 'enterprise', 'reporter', 'superadmin'):
                        cursor.execute(
                            "UPDATE profiles SET role = %s, plan = %s, district = COALESCE(%s, district) WHERE id = %s",
                            [role, plan, cleaned_district, user_id]
                        )
                    else:
                        cursor.execute(
                            "UPDATE profiles SET role = %s, district = COALESCE(%s, district) WHERE id = %s",
                            [role, cleaned_district, user_id]
                        )
                
                if phone_number and str(phone_number).strip():
                    cursor.execute(
                        "UPDATE profiles SET phone_number = %s WHERE id = %s",
                        [str(phone_number).strip(), user_id]
                    )
                    
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=400)
    return JsonResponse({"detail": "Method not allowed"}, status=405)

@csrf_exempt
def admin_user_plan(request, user_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            plan = data.get('plan', 'free')
            if plan not in ('free', 'pro', 'enterprise'):
                return JsonResponse({"detail": f"Invalid plan: {plan}. Must be free, pro, or enterprise."}, status=400)
            with connection.cursor() as cursor:
                cursor.execute("UPDATE profiles SET plan = %s WHERE id = %s", [plan, user_id])
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=400)
    return JsonResponse({"detail": "Method not allowed"}, status=405)

@csrf_exempt
def admin_user_ban(request, user_id):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            duration = data.get('duration', '876600h')
            is_banned = duration.lower() != 'none'
            with connection.cursor() as cursor:
                cursor.execute("UPDATE profiles SET is_banned = %s WHERE id = %s", [is_banned, user_id])
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=400)
    return JsonResponse({"detail": "Method not allowed"}, status=405)

@csrf_exempt
def admin_user_delete(request, user_id):
    if request.method == 'DELETE':
        try:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM auth.users WHERE id = %s", [user_id])
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=400)
    return JsonResponse({"detail": "Method not allowed"}, status=405)

@csrf_exempt
def admin_logos(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, name, url, is_active, created_at FROM publication_logos ORDER BY created_at ASC")
            rows = cursor.fetchall()
            logos = []
            for r in rows:
                logos.append({
                    "id": str(r[0]),
                    "name": r[1] or "",
                    "url": r[2] or "",
                    "is_active": r[3] if r[3] is not None else True,
                    "created_at": str(r[4]) if r[4] else ""
                })
            if logos:
                return JsonResponse(logos, safe=False)
    except Exception as e:
        pass

    logos = [
        {"id": "rti_express", "name": "RTI Express", "url": "/static/logos/rti_express.svg", "is_active": True},
        {"id": "bharath_reporter", "name": "Bharath Reporter", "url": "/static/logos/bharath_reporter.svg", "is_active": True},
        {"id": "national_news", "name": "National News", "url": "/static/logos/national_news.svg", "is_active": True},
        {"id": "extra_news", "name": "The Extra News", "url": "/static/logos/extra_news.svg", "is_active": True},
    ]
    return JsonResponse(logos, safe=False)
