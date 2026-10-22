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
            
            video_url = data.get("video_url") or data.get("videoUrl")
            # If video exists but no images exist, inject a transparent 1x1 PNG
            # This forces the template to render the hero-image-wrapper so we get hero_box coordinates
            if video_url and not image_urls and not image_url:
                image_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                image_urls = [image_url]

            image_count = len(image_urls) if image_urls else (1 if image_url else 0)
            
            # Insert helper to update stage
            from asgiref.sync import sync_to_async
            
            @sync_to_async
            def update_stage(stage_msg, progress):
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT custom_layout FROM clippings WHERE id = %s", [clipping_id])
                        row = cursor.fetchone()
                        cl = {}
                        if row and row[0]:
                            cl = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                        cl['stage'] = stage_msg
                        cl['progress'] = progress
                        cursor.execute("UPDATE clippings SET custom_layout = %s::jsonb WHERE id = %s", [json.dumps(cl), clipping_id])
                        # connection.commit() is usually not needed inside an autocommit thread, but let's be safe:
                        if not connection.in_atomic_block:
                            connection.commit()
                except Exception as e:
                    print(f"[DEBUG STAGE UPDATE] {e}")
                    
            await update_stage("Formatting Article with AI...", 15)
            # 2. Text Translation & Formatting via Grok
            formatted_data = await grok_service.format_article(content, language, image_count)
            
            original_template_id = str(data.get("template_id") or "classic").strip()
            normalized_id = original_template_id.lower().replace(" ", "").replace("_", "").replace("-", "")

            valid_templates = ["classic", "rti_express", "bharath_reporter", "national_news", "hero-image", "hero_image", "modern", "custom", "pattern_b"]
            
            if original_template_id not in valid_templates and normalized_id not in valid_templates:
                intended_template = "rti_express"
                logo_id = data.get("logo_id")
                if logo_id:
                    norm_lid = str(logo_id).lower().replace(" ", "").replace("_", "").replace("-", "")
                    if logo_id in valid_templates or norm_lid in valid_templates:
                        intended_template = logo_id
                template_id = intended_template
            else:
                template_id = original_template_id

            custom_dict = data.get("custom_layout") or {}
            raw_image_layout = str(data.get("image_layout") or custom_dict.get("image_layout") or "").lower().replace("_", "").replace("-", "")
            resolved_image_layout = raw_image_layout or "default"
            total_imgs = len(image_urls)

            is_custom_template = (
                template_id == "custom" or
                data.get("logo_id") == "custom" or
                "custom" in str(template_id) or
                data.get("show_summary") is True
            )

            if video_url:
                # Video clipping ALWAYS uses hero-image video template
                template_id = "hero-image"
                resolved_image_layout = "default"
            else:
                # Image clipping layout & pattern resolution
                if not resolved_image_layout or resolved_image_layout in ["default", "auto"]:
                    if "patterna" in normalized_id or normalized_id.endswith("a"):
                        resolved_image_layout = "pattern_a"
                    elif "patternb" in normalized_id or normalized_id.endswith("b"):
                        resolved_image_layout = "pattern_b"
                    elif "patternc" in normalized_id or normalized_id.endswith("c") or total_imgs == 2:
                        resolved_image_layout = "pattern_c"
                    elif "patternd" in normalized_id or normalized_id.endswith("d"):
                        resolved_image_layout = "pattern_d"
                    elif "patterne" in normalized_id or normalized_id.endswith("e"):
                        resolved_image_layout = "pattern_e"
                    elif "patternf" in normalized_id or normalized_id.endswith("f"):
                        resolved_image_layout = "pattern_f"
                    elif "patterng" in normalized_id or normalized_id.endswith("g"):
                        resolved_image_layout = "pattern_g"
                    elif "single" in normalized_id or "hero" in normalized_id:
                        resolved_image_layout = "single_image"
                    elif total_imgs == 2:
                        resolved_image_layout = "pattern_c"
                    else:
                        resolved_image_layout = "pattern_b"

                if total_imgs <= 1 and not is_custom_template:
                    if template_id in ["pattern_b", "hero-image", "hero_image", "classic"] or "patternb" in normalized_id:
                        template_id = "pattern_b"
                        resolved_image_layout = "pattern_b"

            should_show_summary = True if (not video_url and is_custom_template) else False

            pub_date = data.get("publication_date")
            if not pub_date:
                pub_date = datetime.utcnow().strftime("%d %B %Y")

            render_data = {
                **formatted_data,
                "id": clipping_id,
                "template_id": template_id,
                "show_summary": should_show_summary,
                "article_text": content,
                "raw_content": content,
                "article_content": content,
                "headline": data.get("headline") or formatted_data.get("headline"),
                "subheadline": data.get("subheadline") or formatted_data.get("subheadline", ""),
                "publication_name": data.get("publication_name") or "RTI EXPRESS",
                "publication_date": pub_date,
                "reporter_name": data.get("reporter_name") or "RTI REPORTER",
                "reporter_image": data.get("reporter_image"),
                "image_urls": image_urls,
                "image_url": image_urls[0] if image_urls else "",
                "video_url": video_url,
                "language": language,
                "layout_columns": data.get("layout_columns", "auto"),
                "font_family": data.get("font_family", "noto_serif"),
                "logo_id": data.get("logo_id") or template_id,
                "logo_url": data.get("logo_url"),
                "is_premium": False,
                "show_watermark": data.get("show_watermark", True),
                "show_inner_borders": data.get("show_inner_borders", True),
                "show_outer_border": data.get("show_outer_border", True),
                "image_layout": resolved_image_layout,
                "heading_bg": data.get("heading_bg", None),
                "border_color": data.get("border_color", None),
                "primary_color": data.get("primary_color", None),
                "category": data.get("category", ""),
                "state": data.get("state", ""),
                "district": data.get("district", ""),
                "mandal": data.get("mandal", ""),
            }
            
            # 3. HTML Rendering via Jinja2
            html = await render_service.render_html(render_data, f"{template_id}.html")
            
            # 4. Screenshot / PDF Generation via Playwright
            temp_png = f"temp_{clipping_id}.png"
            temp_pdf = f"temp_{clipping_id}.pdf"
            temp_overlay = f"temp_overlay_{clipping_id}.png"
            hero_box, overlay_box = await render_service.generate_clipping_assets(html, temp_png, temp_pdf, overlay_png_path=temp_overlay)
            
            return temp_png, temp_pdf, temp_overlay, hero_box, overlay_box
            
        # Run async code inside the synchronous thread
        temp_png, temp_pdf, temp_overlay, hero_box, overlay_box = asyncio.run(_generate())
        
        # 5. Upload to Supabase Storage
        def _update_stage_sync(stage_msg, progress):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT custom_layout FROM clippings WHERE id = %s", [clipping_id])
                    row = cursor.fetchone()
                    cl = {}
                    if row and row[0]:
                        cl = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                    cl['stage'] = stage_msg
                    cl['progress'] = progress
                    cursor.execute("UPDATE clippings SET custom_layout = %s::jsonb WHERE id = %s", [json.dumps(cl), clipping_id])
                    if not connection.in_atomic_block:
                        connection.commit()
            except Exception as e:
                print(f"[DEBUG STAGE UPDATE] {e}")

        _update_stage_sync("Uploading images to storage...", 75)
        import time
        timestamp = int(time.time())
        png_url = storage_service.upload_file(temp_png, f"clippings/{clipping_id}_{timestamp}.png")
        pdf_url = storage_service.upload_file(temp_pdf, f"clippings/{clipping_id}_{timestamp}.pdf")
        
        mp4_url = None
        video_url = data.get("video_url") or data.get("videoUrl")
        print(f"[DEBUG VIDEO] video_url: {video_url}")
        print(f"[DEBUG VIDEO] hero_box: {hero_box}")
        print(f"[DEBUG VIDEO] overlay_box: {overlay_box}")
        if video_url and hero_box:
            temp_video = None
            temp_mp4 = None
            temp_bg_video = None
            temp_overlay_video = None
            try:
                _update_stage_sync("Generating Video (This takes 1-2 minutes)...", 90)
                import urllib.request
                import subprocess
                import gc
                from PIL import Image
                from imageio_ffmpeg import get_ffmpeg_exe
                
                gc.collect()

                temp_video = f"temp_{clipping_id}.mp4"
                temp_mp4 = f"temp_out_{clipping_id}.mp4"
                print(f"[BACKGROUND] Downloading video from {video_url}...")
                req = urllib.request.Request(video_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=60) as response, open(temp_video, 'wb') as out_file:
                    import shutil
                    shutil.copyfileobj(response, out_file)
                
                # Low-memory video optimization:
                # Downscale background PNG to max width 720 to prevent FFmpeg OOM on Render 512MB RAM
                scale_factor = 1.0
                temp_bg_video = temp_png
                try:
                    with Image.open(temp_png) as im:
                        orig_w, orig_h = im.size
                        if orig_w > 720:
                            scale_factor = 720.0 / float(orig_w)
                            target_w = int(orig_w * scale_factor)
                            target_h = int(orig_h * scale_factor)
                            target_w -= target_w % 2
                            target_h -= target_h % 2
                            resized_bg = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
                            temp_bg_video = f"temp_bg_{clipping_id}.png"
                            resized_bg.save(temp_bg_video)
                except Exception as resize_err:
                    print(f"[BACKGROUND VIDEO WARN] Could not downscale bg image: {resize_err}")
                    temp_bg_video = temp_png
                    scale_factor = 1.0

                x = int(float(hero_box['x']) * scale_factor)
                y = int(float(hero_box['y']) * scale_factor)
                w = int(float(hero_box['width']) * scale_factor)
                h = int(float(hero_box['height']) * scale_factor)
                # Ensure even dimensions for yuv420p
                x -= x % 2
                y -= y % 2
                w = max(2, w - (w % 2))
                h = max(2, h - (h % 2))
                
                print(f"[BACKGROUND] Running FFmpeg overlay at {x},{y} ({w}x{h}) on {temp_bg_video}")
                ffmpeg_exe = get_ffmpeg_exe()
                gc.collect()

                # Low-memory FFmpeg flags:
                # -tune zerolatency, -bf 0: Eliminates lookahead and B-frame buffers in RAM
                # -threads 1: Avoids multi-thread buffer bloat
                # fps=24: Reduces decoding frame queue from 60fps
                # -t 60: Caps maximum render duration
                vc = data.get("video_crop") or data.get("videoCrop") or {}
                fit_mode = vc.get("fitMode") or "crop"
                if fit_mode == "fit":
                    vid_filter = f"[1:v]fps=24,scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black[vid]"
                elif "width" in vc and "height" in vc and (vc.get("width", 100) < 99 or vc.get("height", 100) < 99 or vc.get("x", 0) > 1 or vc.get("y", 0) > 1):
                    cx = max(0.0, min(1.0, float(vc.get("x", 0)) / 100.0))
                    cy = max(0.0, min(1.0, float(vc.get("y", 0)) / 100.0))
                    cw = max(0.1, min(1.0, float(vc.get("width", 100)) / 100.0))
                    ch = max(0.1, min(1.0, float(vc.get("height", 100)) / 100.0))
                    vid_filter = f"[1:v]fps=24,crop=iw*{cw:.4f}:ih*{ch:.4f}:iw*{cx:.4f}:ih*{cy:.4f},scale={w}:{h}[vid]"
                else:
                    vid_filter = f"[1:v]fps=24,scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}[vid]"

                has_overlay = temp_overlay and os.path.exists(temp_overlay) and overlay_box
                if has_overlay:
                    temp_overlay_video = temp_overlay
                    if scale_factor != 1.0:
                        try:
                            with Image.open(temp_overlay) as o_im:
                                o_orig_w, o_orig_h = o_im.size
                                o_target_w = int(o_orig_w * scale_factor)
                                o_target_h = int(o_orig_h * scale_factor)
                                o_target_w -= o_target_w % 2
                                o_target_h -= o_target_h % 2
                                resized_overlay = o_im.resize((o_target_w, o_target_h), Image.Resampling.LANCZOS)
                                temp_overlay_video = f"temp_overlay_scaled_{clipping_id}.png"
                                resized_overlay.save(temp_overlay_video)
                        except Exception as oe:
                            print(f"[BACKGROUND VIDEO WARN] Could not downscale overlay: {oe}")
                            temp_overlay_video = temp_overlay

                    ox = int(float(overlay_box['x']) * scale_factor)
                    oy = int(float(overlay_box['y']) * scale_factor)
                    ox -= ox % 2
                    oy -= oy % 2
                    vf_filter = f"{vid_filter};[0:v][vid]overlay={x}:{y}:shortest=1[tmp];[tmp][2:v]overlay={ox}:{oy},pad=ceil(iw/2)*2:ceil(ih/2)*2[outv]"
                else:
                    vf_filter = f"{vid_filter};[0:v][vid]overlay={x}:{y}:shortest=1,pad=ceil(iw/2)*2:ceil(ih/2)*2[outv]"

                cmd = [
                    ffmpeg_exe, "-y",
                    "-loop", "1", "-i", temp_bg_video,
                    "-t", "60",
                    "-i", temp_video,
                ]
                if has_overlay:
                    cmd.extend(["-i", temp_overlay_video])
                cmd.extend([
                    "-filter_complex", vf_filter,
                    "-map", "[outv]", "-map", "1:a?",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-tune", "zerolatency",
                    "-bf", "0",
                    "-threads", "1",
                    "-max_muxing_queue_size", "1024",
                    "-bufsize", "1M",
                    "-maxrate", "1.5M",
                    "-crf", "26",
                    "-c:a", "aac",
                    "-b:a", "96k",
                    "-shortest",
                    "-pix_fmt", "yuv420p",
                    temp_mp4
                ])
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=180)
                
                mp4_url = storage_service.upload_file(temp_mp4, f"clippings/{clipping_id}_{timestamp}.mp4", "video/mp4")
            except Exception as vid_err:
                print(f"[BACKGROUND ERROR] Failed to generate MP4: {vid_err}")
                import traceback
                traceback.print_exc()
            finally:
                if temp_video and os.path.exists(temp_video): os.remove(temp_video)
                if temp_mp4 and os.path.exists(temp_mp4): os.remove(temp_mp4)
                if temp_bg_video and temp_bg_video != temp_png and os.path.exists(temp_bg_video): os.remove(temp_bg_video)
                if temp_overlay_video and temp_overlay_video != temp_overlay and os.path.exists(temp_overlay_video): os.remove(temp_overlay_video)
                import gc
                gc.collect()

        if os.path.exists(temp_png):
            os.remove(temp_png)
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)
        if temp_overlay and os.path.exists(temp_overlay):
            os.remove(temp_overlay)
        
        # 6. Update Database Status to 'completed'
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    "UPDATE clippings SET status = %s, png_url = %s, pdf_url = %s, mp4_url = %s, template_id = %s, publication_name = %s, publication_date = %s, state = %s, district = %s WHERE id = %s",
                    ['completed', png_url, pdf_url, mp4_url, template_id, render_data["publication_name"], render_data["publication_date"], render_data.get("state"), render_data.get("district"), clipping_id]
                )
            except Exception as db_err:
                print(f"[BACKGROUND ERROR] Failed to update mp4_url or extra columns: {db_err}")
                connection.rollback()
                cursor.execute(
                    "UPDATE clippings SET status = %s, png_url = %s, pdf_url = %s WHERE id = %s",
                    ['completed', png_url, pdf_url, clipping_id]
                )
            if not connection.in_atomic_block:
                connection.commit()
            
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT custom_layout FROM clippings WHERE id = %s", [clipping_id])
                row = cursor.fetchone()
                custom_layout = {}
                if row and row[0]:
                    custom_layout = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                custom_layout['stage'] = 'Complete'
                custom_layout['progress'] = 100
                if mp4_url:
                    custom_layout['mp4_url'] = mp4_url
                cursor.execute(
                    "UPDATE clippings SET custom_layout = %s::jsonb WHERE id = %s",
                    [json.dumps(custom_layout), clipping_id]
                )
                if not connection.in_atomic_block:
                    connection.commit()
        except Exception as cl_err:
            print(f"[STAGE COMPLETE ERROR] {cl_err}")
            
        print(f"[BACKGROUND] Finished clipping generation for {clipping_id}")
        
    except Exception as e:
        print(f"[BACKGROUND ERROR] Error generating clipping {clipping_id}: {e}")
        import traceback
        traceback.print_exc()
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE clippings SET status = %s, custom_layout = %s::jsonb WHERE id = %s",
                    ['failed', json.dumps({"error": str(e), "stage": "Processing Error"}), clipping_id]
                )
                if not connection.in_atomic_block:
                    connection.commit()
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
        custom_layout_data = {
            **data,
            "videoUrl": data.get("video_url") or data.get("videoUrl"),
            "video_url": data.get("video_url") or data.get("videoUrl"),
            "reporterName": data.get("reporter_name"),
            "imageUrls": data.get("image_urls", [])
        }
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO clippings (
                    id, user_id, headline, article_content, language, template_id, status, created_at, custom_layout, state, district
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s::jsonb, %s, %s)
            """, [clipping_id, user_id, headline, article_content, language, template_id, 'processing', json.dumps(custom_layout_data), data.get('state'), data.get('district')])
            
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

