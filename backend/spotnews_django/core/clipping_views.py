import json
import uuid
import threading
from datetime import datetime
from django.http import JsonResponse
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from .views import check_jwt

from django.core.files.storage import FileSystemStorage
import os

# Import services once adapted for Django
# from .services.grok_service import grok_service
# from .services.render_service import render_service
from .services.storage_service import storage_service

def run_clipping_generation_background(clipping_id, data, user_id):
    """
    Background worker for generating clippings. 
    This will call Grok, Render HTML, Playwright, and Supabase uploads.
    """
    try:
        print(f"[BACKGROUND] Started clipping generation for {clipping_id}")
        
        # 1. Image Processing (if required)
        
        # 2. Text Translation & Formatting via Grok
        # formatted_data = grok_service.format_article(...)
        
        # 3. HTML Rendering via Jinja2
        # html = render_service.render_html(...)
        
        # 4. Screenshot / PDF Generation via Playwright
        # render_service.generate_clipping_assets(...)
        
        # 5. Upload to Supabase Storage
        # png_url = storage_service.upload_file(...)
        
        # 6. Update Database Status to 'completed'
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE clippings SET status = %s, updated_at = NOW() WHERE id = %s",
                ['completed', clipping_id]
            )
            
        print(f"[BACKGROUND] Finished clipping generation for {clipping_id}")
        
    except Exception as e:
        print(f"[BACKGROUND ERROR] Error generating clipping {clipping_id}: {e}")
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE clippings SET status = %s, custom_layout = %s WHERE id = %s",
                    ['failed', json.dumps({"error": str(e), "stage": "Processing Error"}), clipping_id]
                )
        except Exception as db_err:
            print(f"Failed to update error status: {db_err}")


@csrf_exempt
def create_clipping(request):
    """
    POST /api/v1/generate
    Start a new clipping generation process
    """
    is_valid, error_response = check_jwt(request)
    if not is_valid:
        return error_response

    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)
        
    try:
        data = json.loads(request.body)
        
        # Extract fields
        headline = data.get("headline", "")
        article_content = data.get("article_content", "")
        template_id = data.get("template_id", "classic")
        language = data.get("language", "te")
        
        # Extract JWT user_id from token manually since check_jwt doesn't return it
        # Assuming you'll decode it properly, using a placeholder for now
        auth_header = request.headers.get("Authorization")
        token = auth_header.split(" ")[1]
        parts = token.split(".")
        import base64
        payload_b64 = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode('utf-8'))
        user_id = payload.get("sub")
        
        # Generate new ID
        clipping_id = str(uuid.uuid4())
        
        # Insert into Database with 'processing' status
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO clippings (
                    id, user_id, headline, article_content, language, template_id, status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """, [clipping_id, user_id, headline, article_content, language, template_id, 'processing'])
            
        # Spawn background thread for processing (Django synchronous environment)
        thread = threading.Thread(target=run_clipping_generation_background, args=(clipping_id, data, user_id))
        thread.daemon = True
        thread.start()
        
        return JsonResponse({
            "success": True,
            "data": {
                "id": clipping_id,
                "status": "processing",
                "headline": headline,
                "template_id": template_id
            },
            "message": "Generation started successfully"
        })
        
    except Exception as e:
        print(f"Error creating clipping: {e}")
        return JsonResponse({"detail": str(e)}, status=400)


@csrf_exempt
def list_clippings(request):
    """
    GET /api/v1/generate
    List all clippings for the current user
    """
    is_valid, error_response = check_jwt(request)
    if not is_valid:
        return error_response
        
    if request.method != 'GET':
        return JsonResponse({"detail": "Method not allowed"}, status=405)
        
    try:
        # Extract JWT user_id
        auth_header = request.headers.get("Authorization")
        token = auth_header.split(" ")[1]
        parts = token.split(".")
        import base64
        payload_b64 = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode('utf-8'))
        user_id = payload.get("sub")
        
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('pageSize', 10))
        offset = (page - 1) * page_size
        
        results = []
        total = 0
        
        with connection.cursor() as cursor:
            # Count total
            cursor.execute("SELECT COUNT(*) FROM clippings WHERE user_id = %s", [user_id])
            total = cursor.fetchone()[0]
            
            # Get paginated data
            cursor.execute("""
                SELECT id, status, headline, template_id, created_at, png_url, pdf_url, custom_layout
                FROM clippings 
                WHERE user_id = %s 
                ORDER BY created_at DESC 
                LIMIT %s OFFSET %s
            """, [user_id, page_size, offset])
            
            rows = cursor.fetchall()
            for r in rows:
                custom_layout = r[7] if isinstance(r[7], dict) else (json.loads(r[7]) if r[7] else {})
                
                results.append({
                    "id": str(r[0]),
                    "status": r[1] or "processing",
                    "headline": r[2] or "",
                    "template_id": r[3] or "classic",
                    "created_at": str(r[4]) if r[4] else "",
                    "png_url": r[5] or "",
                    "pdf_url": r[6] or "",
                    "stage": custom_layout.get("stage", "processing") if r[1] != 'completed' else "Final Response",
                    "progress": custom_layout.get("progress", 15) if r[1] != 'completed' else 100,
                    "error": custom_layout.get("error", "") if r[1] == 'failed' else ""
                })
                
        return JsonResponse({
            "success": True,
            "data": {
                "items": results,
                "total": total,
                "page": page,
                "pageSize": page_size,
                "totalPages": (total + page_size - 1) // page_size
            },
            "message": "Clippings retrieved successfully"
        })
        
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)

@csrf_exempt
def upload_image(request):
    """
    POST /api/v1/uploads/image
    Upload an image for a clipping or profile logo
    """
    is_valid, error_response = check_jwt(request)
    if not is_valid:
        return error_response

    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if 'file' not in request.FILES:
        return JsonResponse({"detail": "No file uploaded"}, status=400)

    upload_file = request.FILES['file']
    
    # 50 MB limit
    if upload_file.size > 50 * 1024 * 1024:
        return JsonResponse({"detail": "File exceeds maximum allowed size of 50MB."}, status=413)

    fs = FileSystemStorage()
    filename = fs.save(f"temp_{uuid.uuid4().hex}_{upload_file.name}", upload_file)
    file_path = fs.path(filename)

    try:
        ext = os.path.splitext(upload_file.name)[1].lower() or '.jpg'
        dest_path = f"uploads/{uuid.uuid4().hex}{ext}"
        
        url = storage_service.upload_file(file_path, dest_path, upload_file.content_type)
        return JsonResponse({
            "success": True,
            "url": url,
            "data": {"url": url},
            "message": "Image uploaded successfully"
        })
    except Exception as e:
        print(f"Error uploading image: {e}")
        return JsonResponse({"detail": str(e)}, status=500)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

