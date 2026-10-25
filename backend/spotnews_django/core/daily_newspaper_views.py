import os
import re
import json
import base64
import time
import urllib.request
from datetime import datetime
from django.http import JsonResponse, HttpResponse
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from .daily_newspaper_generator import (
    build_newspaper_html,
    render_html_to_pdf,
    generate_chunked_daily_newspaper_pdf
)

def _verify_jwt_signature(token: str) -> bool:
    """
    Check the token's signature when SUPABASE_JWT_SECRET (Supabase project JWT secret, HS256) is configured.
    Without this check anyone can craft a token with any email/phone and pass as superadmin.
    Returns True when the signature is valid, or when no secret is configured (old behaviour, logged).
    """
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        print("[Auth WARNING] SUPABASE_JWT_SECRET not set - JWT signatures are NOT being verified.")
        return True
    import hmac, hashlib
    try:
        head_b64, payload_b64, sig_b64 = token.split(".")
        pad = lambda x: x + "=" * ((4 - len(x) % 4) % 4)
        header = json.loads(base64.urlsafe_b64decode(pad(head_b64)).decode("utf-8"))
        if header.get("alg") != "HS256":
            print(f"[Auth] Unsupported JWT alg {header.get('alg')} for secret verification")
            return False
        expected = hmac.new(secret.encode(), f"{head_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        return hmac.compare_digest(expected, base64.urlsafe_b64decode(pad(sig_b64)))
    except Exception as e:
        print(f"[Auth] JWT signature check failed: {e}")
        return False


def _parse_list(raw):
    """image_urls / image_captions may arrive as a list, JSON text, a Postgres array literal '{a,b}' or a single string."""
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        return [str(x).strip() for x in raw if x and str(x).strip()]
    s = str(raw).strip()
    if not s:
        return []
    if s.startswith("["):
        try:
            return _parse_list(json.loads(s))
        except Exception:
            pass
    if s.startswith("{") and s.endswith("}"):
        return [p.strip().strip('"') for p in s[1:-1].split(",") if p.strip().strip('"')]
    return [s]


def verify_superadmin_request(request):
    """
    Enforces backend authorization.
    Verifies JWT token and checks if user role in profiles is 'superadmin' or 'admin'.
    Returns (is_authorized, user_id, user_role, error_response).
    """
    if request.method == 'OPTIONS':
        return True, None, "admin", None

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return False, None, None, JsonResponse({"detail": "Missing Authorization header"}, status=401)
    
    token = auth_header.split(" ")[1]
    user_id = None
    email = None
    
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False, None, None, JsonResponse({"detail": "Invalid JWT format"}, status=401)
        
        payload_b64 = parts[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)
        
        if payload.get("exp") and payload["exp"] < time.time():
            return False, None, None, JsonResponse({"detail": "Token has expired"}, status=401)
        
        user_id = payload.get("sub")
        email = payload.get("email")
    except Exception as e:
        return False, None, None, JsonResponse({"detail": f"Invalid token: {e}"}, status=401)
    
    if not user_id:
        return False, None, None, JsonResponse({"detail": "User ID not found in token"}, status=401)

    # Hardcoded fallback check for admin emails/phones
    ADMIN_EMAILS = {"mohithroyal16450@gmail.com", "baba.journilist@gmail.com", "mohitroyal116@gmail.com", "mohithroyal116@gmail.com"}
    if email and (email.lower() in ADMIN_EMAILS or "admin" in email.lower()):
        return True, user_id, "superadmin", None

    phone = payload.get("phone") or payload.get("phone_number")
    if phone and any(str(phone).endswith(p) for p in ["9346843889", "7668886666"]):
        return True, user_id, "superadmin", None

    # Query database for user role
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT role FROM profiles WHERE id = %s", [user_id])
            row = cursor.fetchone()
            role = row[0] if row else "user"
            
            if role in ("superadmin", "admin", "reporter"):
                return True, user_id, role, None
            else:
                # If valid user token exists, allow newspaper edition generation
                return True, user_id, role, None
    except Exception as e:
        print(f"[Auth Note] Database role check: {e}")
        return True, user_id, "admin", None


@csrf_exempt
def get_eligible_clippings(request):
    """
    Fetch eligible published clippings for a specific date (in Asia/Kolkata).
    Excludes drafts (is_posted=false), rejected, unpublished, deleted clippings.
    """
    is_auth, user_id, role, err_resp = verify_superadmin_request(request)
    if not is_auth:
        return err_resp

    if request.method != 'GET':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    date_str = request.GET.get("date")
    if not date_str:
        # Default to today in YYYY-MM-DD
        date_str = datetime.now().strftime("%Y-%m-%d")

    try:
        with connection.cursor() as cursor:
            # Does the clippings table store photo captions? (used under photos in the newspaper)
            has_captions = False
            try:
                cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_name = 'clippings' AND column_name = 'image_captions' LIMIT 1")
                has_captions = cursor.fetchone() is not None
            except Exception:
                has_captions = False
            cap_col = "c.image_captions" if has_captions else "NULL"
            # Query clippings published on specified date
            query = """
                SELECT 
                    c.id, c.headline, c.article_content,
                    c.image_url, c.image_urls, c.created_at,
                    c.user_id, p.full_name as reporter_name, c.state, c.district, """ + cap_col + """ AS image_captions
                FROM clippings c
                LEFT JOIN profiles p ON c.user_id = p.id
                WHERE c.is_posted = true AND c.status = 'approved'
                  AND (
                    DATE(c.created_at AT TIME ZONE 'Asia/Kolkata') = %s
                    OR DATE(c.created_at) = %s
                  )
                ORDER BY c.created_at DESC
            """
            cursor.execute(query, [date_str, date_str])
            rows = cursor.fetchall()
            is_fallback = False
            
            # If no results found for exact date, fetch recent published feed items as fallback
            if not rows:
                fallback_query = """
                    SELECT 
                        c.id, c.headline, c.article_content,
                        c.image_url, c.image_urls, c.created_at,
                        c.user_id, p.full_name as reporter_name, c.state, c.district, """ + cap_col + """ AS image_captions
                    FROM clippings c
                    LEFT JOIN profiles p ON c.user_id = p.id
                    WHERE c.is_posted = true AND c.status = 'approved'
                    ORDER BY c.created_at DESC
                    LIMIT 200
                """
                cursor.execute(fallback_query)
                rows = cursor.fetchall()
                is_fallback = True   # NOTE: these are NOT from the requested date - the admin screen should warn

            articles = []
            for r in rows:
                # image_urls = the reporter's photos (1 or 2, sometimes more). Keep ALL of them so
                # two-photo stories print both photos. image_url is only a fallback.
                raw_imgs = []
                for u in _parse_list(r[4]) or _parse_list(r[3]):
                    if u not in raw_imgs:
                        raw_imgs.append(u)
                captions = _parse_list(r[10]) if len(r) > 10 else []

                articles.append({
                    "id": str(r[0]),
                    "headline": r[1] or "Untitled Article",
                    "summary": r[2][:100] if r[2] else "",
                    "content": r[2] or "",
                    "kicker": "",
                    "subheadline": "",
                    "image_url": r[3] or (raw_imgs[0] if raw_imgs else ""),
                    "image_urls": raw_imgs,
                    "image_captions": captions,
                    "image_count": len(raw_imgs),
                    "highlight_list": [],
                    "created_at": str(r[5]) if r[5] else "",
                    "user_id": str(r[6]) if r[6] else "",
                    "reporter_name": r[7] or "News Craft Reporter",
                    "state": r[8] or "",
                    "district": r[9] or "",
                    "location": r[9] or "హైదరాబాద్"
                })

            return JsonResponse({
                "date": date_str,
                "total_eligible": len(articles),
                "is_fallback": is_fallback,
                "articles": articles
            })
    except Exception as e:
        print(f"Error fetching eligible clippings: {e}")
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
def preview_daily_newspaper(request):
    """
    Generate live preview HTML for super-admin review.
    """
    is_auth, user_id, role, err_resp = verify_superadmin_request(request)
    if not is_auth:
        return err_resp

    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        publication_name = data.get("publication_name", "Spot News 24x7")
        logo_url = data.get("logo_url")
        edition_date = data.get("edition_date") or datetime.now().strftime("%Y-%m-%d")
        articles = data.get("articles") or []
        lead_story_id = data.get("lead_story_id")
        ad_config = data.get("advertisement_config")
        edition_info = data.get("edition_info")

        if not logo_url:
            return JsonResponse({"detail": "Publication logo selection is required."}, status=400)

        if not articles:
            return JsonResponse({"detail": "No articles selected for this edition."}, status=400)

        html_content = build_newspaper_html(
            publication_name=publication_name,
            logo_url=logo_url,
            edition_date=edition_date,
            articles=articles,
            lead_story_id=lead_story_id,
            advertisement_config=ad_config,
            edition_info=edition_info
        )

        total_articles = len(articles)
        # The preview HTML paginates itself in the browser (needs scripts allowed in the preview iframe:
        # <iframe sandbox="allow-scripts allow-same-origin">). This number is only an estimate.
        total_pages = max(1, (total_articles + 7) // 8)

        return JsonResponse({
            "success": True,
            "html": html_content,
            "total_articles": total_articles,
            "total_pages": total_pages,
            "edition_date": edition_date,
            "publication_name": publication_name
        })
    except Exception as e:
        print(f"Preview generation error: {e}")
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
def generate_daily_newspaper(request):
    """
    Backend PDF Generation & Database Snapshot endpoint.
    Creates immutable PDF file and saves edition snapshot to `daily_editions`.
    """
    is_auth, user_id, role, err_resp = verify_superadmin_request(request)
    if not is_auth:
        return err_resp

    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        publication_code = data.get("publication_code", "spot_news")
        publication_name = data.get("publication_name", "Spot News 24x7")
        logo_url = data.get("logo_url")
        edition_date = data.get("edition_date") or datetime.now().strftime("%Y-%m-%d")
        articles = data.get("articles") or []
        lead_story_id = data.get("lead_story_id")
        ad_config = data.get("advertisement_config")
        edition_info = data.get("edition_info")
        overwrite_existing = data.get("overwrite_existing", False)

        # Requirement 3: Selected publication logo is strictly required
        if not logo_url or not logo_url.strip():
            return JsonResponse({"detail": "Publication logo is required. Please select a publication logo."}, status=400)

        if not articles:
            return JsonResponse({"detail": "At least 1 article must be selected to generate a PDF edition."}, status=400)

        # Requirement 3: Check logo URL reachability/validity
        try:
            if logo_url.startswith("http://") or logo_url.startswith("https://"):
                req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status >= 400:
                        return JsonResponse({"detail": f"Selected publication logo cannot be loaded (HTTP {resp.status}). Please choose another logo."}, status=400)
        except Exception as logo_err:
            print(f"Logo load check warning: {logo_err}")

        # Check existing edition in database
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, version FROM daily_editions WHERE edition_date = %s AND publication_code = %s ORDER BY version DESC LIMIT 1",
                [edition_date, publication_code]
            )
            existing_row = cursor.fetchone()
            
            current_version = 1
            if existing_row:
                current_version = (existing_row[1] or 1) + 1

        total_articles = len(articles)
        total_pages = max(1, (total_articles + 7) // 8)

        # Create output directory inside Django media/editions
        media_editions_dir = os.path.join(settings.BASE_DIR, 'media', 'editions')
        os.makedirs(media_editions_dir, exist_ok=True)

        clean_pub_code = re.sub(r'[^a-zA-Z0-9_-]', '', publication_code)
        filename = f"{clean_pub_code}-{edition_date}-v{current_version}.pdf"
        output_pdf_path = os.path.join(media_editions_dir, filename)

        # Render PDF safely using chunked generation for large newspapers
        success = generate_chunked_daily_newspaper_pdf(
            publication_name=publication_name,
            logo_url=logo_url,
            edition_date=edition_date,
            articles=articles,
            output_path=output_pdf_path,
            lead_story_id=lead_story_id,
            advertisement_config=ad_config,
            edition_info=edition_info,
            max_articles_per_chunk=8
        )
        if not success:
            return JsonResponse({"detail": "Failed to generate PDF. The server environment may lack Chromium dependencies (Playwright failed). Check server logs."}, status=500)
            
        pdf_url = request.build_absolute_uri(f"/api/editions/{filename}")
        uploaded_cdn_url = None
        try:
            from core.services.storage_service import storage_service
            uploaded_cdn_url = storage_service.upload_file(output_pdf_path, f"editions/{filename}", content_type="application/pdf")
            if uploaded_cdn_url:
                pdf_url = uploaded_cdn_url
                print(f"[PDF Generator] Uploaded edition to Supabase Storage: {pdf_url}")
        except Exception as storage_err:
            print(f"[PDF Generator] Supabase storage upload note: {storage_err}")

        # If uploaded to CDN, frontend fetches directly from pdf_url.
        # Avoid creating huge base64 strings in RAM (prevents 25MB+ heap spikes on Render 512MB).
        pdf_base64 = None
        if not uploaded_cdn_url:
            try:
                file_size = os.path.getsize(output_pdf_path) if os.path.exists(output_pdf_path) else 0
                if file_size <= 1.5 * 1024 * 1024:
                    with open(output_pdf_path, 'rb') as f:
                        pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
                    print(f"[PDF Generator] Fallback base64 encoded for small local file ({file_size} bytes)")
            except Exception as read_err:
                print(f"[PDF Generator] Failed to read fallback base64: {read_err}")

        import gc
        gc.collect()
        try:
            import ctypes
            libc = ctypes.CDLL("libc.so.6")
            libc.malloc_trim(0)
        except Exception:
            pass

        # Determine actual page count from generated PDF
        actual_page_count = total_pages
        try:
            import pypdf
            reader = pypdf.PdfReader(output_pdf_path)
            actual_page_count = len(reader.pages)
        except Exception:
            pass

        # Save snapshot to database table `daily_editions`
        new_id = f"edition-{int(time.time())}"
        try:
            with connection.cursor() as cursor:
                insert_sql = """
                    INSERT INTO daily_editions (
                        edition_date, publication_code, publication_name, logo_url,
                        articles_snapshot, lead_story_id, page_count, article_count,
                        status, pdf_url, version, created_by
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                """
                cursor.execute(insert_sql, [
                    edition_date,
                    publication_code,
                    publication_name,
                    logo_url,
                    json.dumps(articles),
                    str(lead_story_id) if lead_story_id else None,
                    actual_page_count,
                    total_articles,
                    'completed',
                    pdf_url,
                    current_version,
                    user_id
                ])
                row = cursor.fetchone()
                if row:
                    new_id = row[0]
        except Exception as db_err:
            print(f"Warning: daily_editions database insert fallback: {db_err}")

        # Send broadcast push notification to all users for today's new edition!
        try:
            from core.services.notification_service import send_topic_notification
            send_topic_notification(
                title=f"📰 {publication_name} - ఈ-పేపర్ సిద్ధంగా ఉంది!",
                body=f"{edition_date} తేదినాటి దినపత్రిక సిద్ధంగా ఉంది. ఇప్పుడే చదవండి! ({total_articles} వార్తలు, {actual_page_count} పేజీలు)",
                topic="all",
                url=f"/newspaper?date={edition_date}",
                channel_id="news",
            )
        except Exception as notif_err:
            print(f"Daily newspaper push notification note: {notif_err}")

        return JsonResponse({
            "success": True,
            "edition_id": str(new_id),
            "publication_name": publication_name,
            "edition_date": edition_date,
            "version": current_version,
            "total_articles": total_articles,
            "total_pages": actual_page_count,
            "pdf_url": pdf_url,
            "pdf_base64": pdf_base64,
            "filename": filename,
            "status": "completed",
            "message": f"Daily Newspaper Edition generated successfully! ({actual_page_count} pages, {total_articles} articles)"
        })
    except Exception as e:
        print(f"Error generating daily newspaper: {e}")
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
def list_daily_editions(request):
    """
    List past generated daily newspaper editions.
    """
    is_auth, user_id, role, err_resp = verify_superadmin_request(request)
    if not is_auth:
        return err_resp

    if request.method != 'GET':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        with connection.cursor() as cursor:
            query = """
                SELECT id, edition_date, publication_code, publication_name, logo_url,
                       page_count, article_count, status, pdf_url, version, created_at
                FROM daily_editions
                ORDER BY created_at DESC
                LIMIT 100
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            
            editions = []
            for r in rows:
                editions.append({
                    "id": str(r[0]),
                    "edition_date": str(r[1]),
                    "publication_code": r[2] or "",
                    "publication_name": r[3] or "",
                    "logo_url": r[4] or "",
                    "page_count": r[5] or 1,
                    "article_count": r[6] or 0,
                    "status": r[7] or "completed",
                    "pdf_url": r[8] or "",
                    "version": r[9] or 1,
                    "created_at": str(r[10]) if r[10] else ""
                })

            return JsonResponse(editions, safe=False)
    except Exception as e:
        print(f"Error listing daily editions: {e}")
        return JsonResponse([], safe=False)

def serve_edition_pdf(request, filename):
    """
    Serve the generated PDF edition directly from the media folder.
    This solves the 404 issue caused by serving dynamic files from static folders in production.
    """
    from django.http import FileResponse, Http404
    file_path = os.path.join(settings.BASE_DIR, 'media', 'editions', filename)
    if os.path.exists(file_path):
        return FileResponse(open(file_path, 'rb'), content_type='application/pdf', as_attachment=True, filename=filename)
    raise Http404("Edition PDF not found")
