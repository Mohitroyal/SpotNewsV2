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

import asyncio

# Import services once adapted for Django
from .services.grok_service import grok_service
from .services.render_service import render_service
from .services.storage_service import storage_service

def run_clipping_generation_background(clipping_id, data, user_id):
    """
    Background worker for generating clippings. 
    This will call Grok, Render HTML, Playwright, and Supabase uploads.
    """
    try:
        print(f"[BACKGROUND] Started clipping generation for {clipping_id}")
        
        async def _generate():
            content = data.get("article_content", "")
            language = data.get("language", "te")
            image_urls = data.get("image_urls", [])
            image_url = data.get("image_url", "")
            image_count = len(image_urls) if image_urls else (1 if image_url else 0)
            
            # 2. Text Translation & Formatting via Grok
            formatted_data = await grok_service.format_article(content, language, image_count)
            
            render_data = {
                **formatted_data,
                "id": clipping_id,
                "article_content": content,
                "headline": data.get("headline") or formatted_data.get("headline"),
                "publication_name": data.get("publication_name", "Newsflow"),
                "publication_date": data.get("publication_date", ""),
                "image_urls": image_urls,
                "video_url": data.get("video_url"),
                "language": language,
                "layout_columns": data.get("layout_columns", "auto"),
                "font_family": data.get("font_family", "playfair"),
                "logo_id": data.get("logo_id", data.get("template_id", "classic")),
                "is_premium": False,
                "show_watermark": data.get("show_watermark", True),
                "image_layout": data.get("image_layout", "default"),
                "heading_bg": data.get("heading_bg", None),
                "border_color": data.get("border_color", None),
                "primary_color": data.get("primary_color", None),
            }
            
            # 3. HTML Rendering via Jinja2
            template_id = data.get("template_id", "classic")
            html = await render_service.render_html(render_data, f"{template_id}.html")
            
            # 4. Screenshot / PDF Generation via Playwright
            temp_png = f"temp_{clipping_id}.png"
            temp_pdf = f"temp_{clipping_id}.pdf"
            hero_box = await render_service.generate_clipping_assets(html, temp_png, temp_pdf)
            
            return temp_png, temp_pdf, hero_box
            
        # Run async code inside the synchronous thread
        temp_png, temp_pdf, hero_box = asyncio.run(_generate())
        
        # 5. Upload to Supabase Storage
        import time
        timestamp = int(time.time())
        png_url = storage_service.upload_file(temp_png, f"clippings/{clipping_id}_{timestamp}.png")
        pdf_url = storage_service.upload_file(temp_pdf, f"clippings/{clipping_id}_{timestamp}.pdf")
        
        mp4_url = None
        video_url = data.get("video_url")
        print(f"[DEBUG VIDEO] video_url: {video_url}")
        print(f"[DEBUG VIDEO] hero_box: {hero_box}")
        if video_url and hero_box:
            try:
                import urllib.request
                import subprocess
                from imageio_ffmpeg import get_ffmpeg_exe
                
                temp_video = f"temp_{clipping_id}.mp4"
                temp_mp4 = f"temp_out_{clipping_id}.mp4"
                print(f"[BACKGROUND] Downloading video from {video_url}...")
                urllib.request.urlretrieve(video_url, temp_video)
                
                x, y = int(hero_box['x']), int(hero_box['y'])
                w, h = int(hero_box['width']), int(hero_box['height'])
                
                print(f"[BACKGROUND] Running FFmpeg overlay at {x},{y} ({w}x{h})")
                ffmpeg_exe = get_ffmpeg_exe()
                # Scale the video, crop it to exact width/height, then overlay on the looped PNG
                cmd = [
                    ffmpeg_exe, "-y",
                    "-loop", "1", "-i", temp_png,
                    "-i", temp_video,
                    "-filter_complex",
                    f"[1:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}[vid];[0:v][vid]overlay={x}:{y}[outv]",
                    "-map", "[outv]", "-map", "1:a?",
                    "-c:v", "libx264",
                    "-c:a", "aac",
                    "-shortest",
                    "-pix_fmt", "yuv420p",
                    temp_mp4
                ]
                subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                mp4_url = storage_service.upload_file(temp_mp4, f"clippings/{clipping_id}_{timestamp}.mp4", "video/mp4")
                if os.path.exists(temp_video): os.remove(temp_video)
                if os.path.exists(temp_mp4): os.remove(temp_mp4)
            except Exception as vid_err:
                print(f"[BACKGROUND ERROR] Failed to generate MP4: {vid_err}")
                import traceback
                traceback.print_exc()

        if os.path.exists(temp_png):
            os.remove(temp_png)
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)
        
        # 6. Update Database Status to 'completed'
        with connection.cursor() as cursor:
            # Need to update mp4_url if it exists. We might need to alter table if mp4_url column doesn't exist.
            # Assuming mp4_url exists, since the frontend poll requested it.
            try:
                cursor.execute(
                    "UPDATE clippings SET status = %s, png_url = %s, pdf_url = %s, mp4_url = %s WHERE id = %s",
                    ['completed', png_url, pdf_url, mp4_url, clipping_id]
                )
            except Exception as db_err:
                print(f"[BACKGROUND ERROR] Missing mp4_url column, updating custom_layout instead: {db_err}")
                import json
                cursor.execute("SELECT custom_layout FROM clippings WHERE id = %s", [clipping_id])
                row = cursor.fetchone()
                custom_layout = json.loads(row[0]) if row and row[0] else {}
                custom_layout['mp4_url'] = mp4_url
                cursor.execute(
                    "UPDATE clippings SET status = %s, png_url = %s, pdf_url = %s, custom_layout = %s WHERE id = %s",
                    ['completed', png_url, pdf_url, json.dumps(custom_layout), clipping_id]
                )
            
        print(f"[BACKGROUND] Finished clipping generation for {clipping_id}")
        
    except Exception as e:
        print(f"[BACKGROUND ERROR] Error generating clipping {clipping_id}: {e}")
        import traceback
        traceback.print_exc()
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
        import json
        custom_layout_data = {
            "videoUrl": data.get("video_url"),
            "reporterName": data.get("reporter_name"),
            "imageUrls": data.get("image_urls")
        }
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO clippings (
                    id, user_id, headline, article_content, language, template_id, status, created_at, custom_layout
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s)
            """, [clipping_id, user_id, headline, article_content, language, template_id, 'processing', json.dumps(custom_layout_data)])
            
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

