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
            email = (data.get('email') or '').strip().lower()
            
            if role not in ('superadmin', 'admin', 'reporter', 'user'):
                return JsonResponse({"detail": f"Invalid role: {role}"}, status=400)
                
            with connection.cursor() as cursor:
                target_user_id = str(user_id).strip()
                target_email = email

                # 1. Resolve actual target_user_id and target_email
                if target_email:
                    try:
                        cursor.execute("SELECT id FROM auth.users WHERE LOWER(email) = LOWER(%s) LIMIT 1", [target_email])
                        row = cursor.fetchone()
                        if row and row[0]:
                            target_user_id = str(row[0])
                        else:
                            cursor.execute("SELECT id FROM profiles WHERE LOWER(email) = LOWER(%s) LIMIT 1", [target_email])
                            row2 = cursor.fetchone()
                            if row2 and row2[0]:
                                target_user_id = str(row2[0])
                    except Exception:
                        pass

                if not target_email and target_user_id:
                    try:
                        cursor.execute("SELECT email FROM auth.users WHERE id::text = %s LIMIT 1", [target_user_id])
                        row = cursor.fetchone()
                        if row and row[0]:
                            target_email = str(row[0]).strip().lower()
                        else:
                            cursor.execute("SELECT email FROM profiles WHERE id::text = %s LIMIT 1", [target_user_id])
                            row2 = cursor.fetchone()
                            if row2 and row2[0]:
                                target_email = str(row2[0]).strip().lower()
                    except Exception:
                        pass

                cleaned_district = str(district).strip() if district else None

                # 2. Role specific plan assignment & admin single-district rule
                if role == 'admin':
                    if not cleaned_district:
                        try:
                            cursor.execute("SELECT district FROM profiles WHERE id::text = %s OR LOWER(COALESCE(email, '')) = LOWER(%s)", [target_user_id, target_email or ''])
                            row = cursor.fetchone()
                            if row and row[0] and str(row[0]).strip():
                                cleaned_district = str(row[0]).strip()
                        except Exception:
                            pass

                    if not cleaned_district:
                        return JsonResponse({
                            "detail": "An admin must be assigned to a specific district. Every district will get one admin only."
                        }, status=400)
                    
                    try:
                        cursor.execute("""
                            SELECT email, full_name, district 
                            FROM profiles 
                            WHERE role = 'admin' 
                              AND LOWER(TRIM(COALESCE(district, ''))) = LOWER(TRIM(%s)) 
                              AND id::text != %s
                              AND LOWER(COALESCE(email, '')) != LOWER(%s)
                        """, [cleaned_district, target_user_id, target_email or ''])
                        existing = cursor.fetchone()
                        if existing:
                            admin_name = existing[0] or existing[1] or "another administrator"
                            return JsonResponse({
                                "detail": f"District '{cleaned_district}' already has an assigned admin ({admin_name}). Every district will get one admin only."
                            }, status=400)
                    except Exception:
                        pass
                    
                    target_plan = plan or 'admin'
                else:
                    if role == 'superadmin':
                        target_plan = plan or 'superadmin'
                    elif role == 'reporter':
                        target_plan = plan or 'reporter'
                    else:
                        target_plan = plan or 'free'

                # 3. Update using central database function
                try:
                    cursor.execute("""
                        SELECT public.admin_set_user_permissions(
                            target_user_id => %s,
                            new_role => %s,
                            new_plan => %s,
                            new_phone => %s,
                            new_district => %s,
                            target_email => %s
                        )
                    """, [target_user_id, role, target_plan, phone_number, cleaned_district, target_email])
                except Exception as pe:
                    print("admin_set_user_permissions RPC notice in Django:", pe)
                    # Fallback direct updates
                    cursor.execute("""
                        UPDATE profiles 
                        SET role = %s, 
                            plan = %s, 
                            district = COALESCE(%s, district),
                            phone = COALESCE(%s, phone),
                            phone_number = COALESCE(%s, phone_number)
                        WHERE id::text = %s OR (LOWER(COALESCE(email, '')) = LOWER(%s) AND %s != '')
                    """, [role, target_plan, cleaned_district, phone_number, phone_number, target_user_id, target_email or '', target_email or ''])

                # 4. If role is reporter, activate reporter_applications
                if role == 'reporter':
                    try:
                        cursor.execute("""
                            UPDATE reporter_applications 
                            SET status = 'active'
                            WHERE id::text = %s OR (LOWER(COALESCE(email, '')) = LOWER(%s) AND %s != '')
                        """, [target_user_id, target_email or '', target_email or ''])
                    except Exception as re:
                        print("Reporter application activation notice:", re)

                # 5. Synchronize auth.users raw metadata
                try:
                    auth_meta = json.dumps({
                        "role": role,
                        "plan": target_plan,
                        "district": cleaned_district or ""
                    })
                    cursor.execute("""
                        UPDATE auth.users 
                        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || %s::jsonb,
                            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || %s::jsonb
                        WHERE id::text = %s OR (LOWER(COALESCE(email, '')) = LOWER(%s) AND %s != '')
                    """, [auth_meta, auth_meta, target_user_id, target_email or '', target_email or ''])
                except Exception:
                    pass

                # 6. Synchronize public.users if table exists
                try:
                    is_admin_val = (role in ('admin', 'superadmin'))
                    is_super_val = (role == 'superadmin')
                    cursor.execute("""
                        UPDATE users 
                        SET is_admin = %s, is_superuser = %s, subscription_plan = %s
                        WHERE id::text = %s OR (LOWER(COALESCE(email, '')) = LOWER(%s) AND %s != '')
                    """, [is_admin_val, is_super_val, target_plan, target_user_id, target_email or '', target_email or ''])
                except Exception:
                    pass
                    
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
            if plan not in ('free', 'pro', 'enterprise', 'admin', 'superadmin'):
                return JsonResponse({"detail": f"Invalid plan: {plan}. Must be free, pro, enterprise, admin, or superadmin."}, status=400)
            with connection.cursor() as cursor:
                cursor.execute("UPDATE profiles SET plan = %s WHERE id = %s", [plan, user_id])
                try:
                    auth_meta = json.dumps({"plan": plan})
                    cursor.execute("""
                        UPDATE auth.users 
                        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || %s::jsonb,
                            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || %s::jsonb
                        WHERE id = %s
                    """, [auth_meta, auth_meta, user_id])
                except Exception:
                    pass
                try:
                    cursor.execute("UPDATE users SET subscription_plan = %s WHERE id = %s", [plan, user_id])
                except Exception:
                    pass
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
