import os
from pathlib import Path
import re
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# TELUGU MONTHS AND DAYS MAP
TELUGU_DAYS = {
    0: "సోమవారం",
    1: "మంగళవారం",
    2: "బుధవారం",
    3: "గురువారం",
    4: "శుక్రవారం",
    5: "శనివారం",
    6: "ఆదివారం"
}

TELUGU_MONTHS = {
    1: "జనవరి",
    2: "ఫిబ్రవరి",
    3: "మార్చి",
    4: "ఏప్రిల్",
    5: "మే",
    6: "జూన్",
    7: "జులై",
    8: "ఆగస్టు",
    9: "సెప్టెంబర్",
    10: "అక్టోబర్",
    11: "నవంబర్",
    12: "డిసెంబర్"
}

def format_telugu_date(date_str: str) -> str:
    """Format YYYY-MM-DD string into Telugu full date format."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        weekday = TELUGU_DAYS[dt.weekday()]
        day = dt.day
        month = TELUGU_MONTHS[dt.month]
        year = dt.year
        return f"{weekday} - {day:02d} - {month} - {year}"
    except Exception:
        return date_str

def sanitize_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    return text.strip()

def build_newspaper_html(
    publication_name: str,
    logo_url: str,
    edition_date: str,
    articles: List[Dict[str, Any]],
    lead_story_id: Optional[str] = None,
    advertisement_config: Optional[Dict[str, Any]] = None,
    edition_info: Optional[Dict[str, Any]] = None,
    page_offset: int = 0,
    total_pages_override: Optional[int] = None
) -> str:
    """
    Generate clean, print-ready HTML string for a CONTINUOUS Daily Newspaper.
    Uses CSS Multi-column layout so articles flow naturally across pages with ZERO whitespace gaps.
    """
    telugu_date_formatted = format_telugu_date(edition_date)
    
    # Reorder articles if lead_story_id is provided
    ordered_articles = list(articles)
    if lead_story_id:
        lead_idx = next((i for i, a in enumerate(ordered_articles) if str(a.get("id")) == str(lead_story_id)), None)
        if lead_idx is not None:
            lead_item = ordered_articles.pop(lead_idx)
            ordered_articles.insert(0, lead_item)

    edition_no = edition_info.get("edition_no", "01") if edition_info else "01"
    issue_no = edition_info.get("issue_no", "266") if edition_info else "266"
    editor_name = edition_info.get("editor_name", "స్పాట్ న్యూస్") if edition_info else "స్పాట్ న్యూస్"
    price = edition_info.get("price", "రూ. 1.50/-") if edition_info else "రూ. 1.50/-"
    location = edition_info.get("location", "హైదరాబాద్ / ఆంధ్రప్రదేశ్ & తెలంగాణ") if edition_info else "హైదరాబాద్ / ఆంధ్రప్రదేశ్ & తెలంగాణ"

    ad_html = ""
    if advertisement_config and advertisement_config.get("image_url"):
        ad_html = f"""
        <div style="width: 28%; padding-left: 10px; text-align: center;">
            <img src="{advertisement_config['image_url']}" style="max-height: 85px; max-width: 100%; border: 1px solid #ccc; padding: 2px;" />
        </div>
        """
    
    masthead_block = f"""
    <!-- Masthead (Only appears on Page 1) -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 10px 0; border-bottom: 4px solid #D60000; margin-bottom: 4px;">
        <div style="flex: 1; text-align: center;">
            <img src="{logo_url}" alt="{sanitize_text(publication_name)}" style="max-height: 100px; max-width: 100%; object-fit: contain;" />
        </div>
        {ad_html}
    </div>
    
    <!-- Meta Strip -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #006600; color: #ffffff; font-size: 13px; font-weight: bold; padding: 5px 15px; margin-bottom: 12px; border-radius: 2px;">
        <div>సంపుటి: {edition_no} &nbsp;|&nbsp; సంచిక: {issue_no} &nbsp;|&nbsp; ఎడిటర్: {sanitize_text(editor_name)}</div>
        <div style="color: #FFEB3B;">దినపత్రిక &nbsp;|&nbsp; వెల: {price}</div>
        <div>{telugu_date_formatted} &nbsp;|&nbsp; {sanitize_text(location)}</div>
    </div>
    """

    headline_colors = ["#D60000", "#003399", "#8B0055", "#006600", "#111111"]
    
    used_ids = set([str(a.get("id")) for a in ordered_articles if a.get("id")])
    
    remaining_primary = []
    for idx, art in enumerate(ordered_articles):
        headline = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
        content = sanitize_text(art.get("content") or art.get("summary") or "")
        imgs = art.get("image_urls") or []
        if not imgs and art.get("image_url"):
            imgs = [art.get("image_url")]
            
        is_lead = (idx == 0)
        img_cost = 0
        if imgs:
            img_cost = 1500 if is_lead else 400
            
        weight = len(content) + int(len(headline) * (4 if is_lead else 2)) + img_cost
        remaining_primary.append({
            "art": art,
            "weight": weight,
            "is_filler": False
        })

    total_articles = len(ordered_articles)
    # Dynamic target page count: 9 to 10 articles per A3 page (5 columns),
    # matching the user's mobile preview and ensuring dense, balanced layout across all pages
    target_pages = max(1, (total_articles + 8) // 9)
    articles_per_page = max(1, (total_articles + target_pages - 1) // target_pages)
    
    chunked_pages = []
    for p in range(target_pages):
        start = p * articles_per_page
        end = min(start + articles_per_page, total_articles)
        page_slice = ordered_articles[start:end]
        if page_slice:
            chunked_pages.append([{"art": a, "weight": 1000, "is_filler": False} for a in page_slice])

    global_idx = 0
    pages_html = []
    for page_idx, page_group in enumerate(chunked_pages):
        display_page_num = page_offset + page_idx + 1
        is_first_page = (display_page_num == 1)
        lead_story_html = ""
        articles_html = []
        
        for local_idx, item in enumerate(page_group):
            art = item["art"]
            headline = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
            content = sanitize_text(art.get("content") or art.get("summary") or "")
            reporter = sanitize_text(art.get("reporter_name") or art.get("byline") or "రిపోర్టర్")
            loc = sanitize_text(art.get("location") or art.get("district") or "")
            
            imgs = art.get("image_urls") or []
            if not imgs and art.get("image_url"):
                imgs = [art.get("image_url")]
            
            is_lead = (is_first_page and local_idx == 0)
            color = headline_colors[global_idx % len(headline_colors)]
            global_idx += 1
            
            img_html = ""
            if imgs and len(imgs) > 0:
                first_img = imgs[0]
                img_style = "width: 100%; max-height: 180px; object-fit: cover; margin-bottom: 5px; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid;"
                if is_lead:
                    img_style = "width: 100%; max-height: 300px; object-fit: cover; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid;"
                img_html = f"""
                <div style="text-align: center; margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid;">
                    <img src="{first_img}" style="{img_style}" />
                </div>
                """

            byline_str = f"{loc} &nbsp;|&nbsp; {reporter}" if loc and reporter else (loc or reporter)
            byline_html = f'<div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #eee;">{byline_str}</div>'

            if is_lead:
                head_style = f"font-size: 24px; font-weight: 900; color: {color}; line-height: 1.2; margin-bottom: 6px;"
                lead_story_html = f"""
                <div class="article-cell lead-cell" style="margin-bottom: 12px; border-bottom: 2px solid #D60000; padding-bottom: 8px; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid;">
                    <h2 style="{head_style}">
                        {headline}
                    </h2>
                    {byline_html}
                    {img_html}
                    <div style="font-size: 12px; line-height: 1.45; text-align: justify; color: #111;">
                        <p style="margin: 0;">{content}</p>
                    </div>
                </div>
                """
                articles_html.append(lead_story_html)
            else:
                span_style = "margin-bottom: 10px; border-top: 2px solid #ccc; padding-top: 8px;"
                head_style = f"font-size: 17px; font-weight: 800; color: {color}; line-height: 1.2; margin-bottom: 4px; break-after: avoid; page-break-after: avoid;"
                content_style = "font-size: 12px; line-height: 1.4; text-align: justify; color: #111;"
                
                item_html = f"""
                <div class="article-cell" style="{span_style}">
                    <h2 style="{head_style}">
                        {headline}
                    </h2>
                    {byline_html}
                    <div style="{content_style}">
                        {img_html}
                        <p style="margin: 0; text-indent: 15px;">{content}</p>
                    </div>
                </div>
                """
                articles_html.append(item_html)
            
        if is_first_page:
            header_html = masthead_block
        else:
            header_html = f"""
            <div style="display: flex; justify-content: space-between; align-items: center; background: #006600; color: #ffffff; font-size: 13px; font-weight: bold; padding: 6px 15px; margin-bottom: 8px; border-radius: 2px;">
                <div>{sanitize_text(publication_name)}</div>
                <div>{telugu_date_formatted}</div>
                <div>పేజీ {display_page_num}</div>
            </div>
            """

        page_num_str = f"పేజీ {display_page_num}"
        custom_footer = f"""
        <div class="footer-section" style="flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ccc; padding-top: 4px; font-size: 11px; color: #555; margin-top: 6px;">
            <div>{sanitize_text(publication_name)} - {edition_date}</div>
            <div style="font-weight: bold;">{page_num_str}</div>
        </div>
        """
        
        is_last_page = (page_idx == len(chunked_pages) - 1)
        page_break_style = "" if is_last_page else "page-break-after: always; break-after: page;"
        
        page_html = f"""
        <div class="pdf-page" style="width: 297mm; height: 420mm; max-height: 420mm; padding: 12mm 10mm; background: #ffffff; margin: 0 auto; box-sizing: border-box; position: relative; display: flex; flex-direction: column; overflow: hidden; page-break-inside: avoid; break-inside: avoid; {page_break_style}">
            <div class="header-section" style="flex: 0 0 auto;">
                {header_html}
            </div>
            <div class="flex-wrapper" style="flex: 1 1 0; min-height: 0; position: relative; margin-top: 5px;">
                <div class="cols" style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; column-count: 5; column-gap: 10px; column-rule: 1px solid #ccc; column-fill: auto; orphans: 2; widows: 2;">
                    {"".join(articles_html)}
                </div>
            </div>
            {custom_footer}
        </div>
        """
        pages_html.append(page_html)

    # Return the raw HTML structure.
    html = f"""<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <title>{sanitize_text(publication_name)} - {edition_date}</title>
    <link href="https://fonts.googleapis.com/css2?family=Suranna&family=Ramabhadra&display=swap" rel="stylesheet">
    <style>
        @page {{
            size: 297mm 420mm;
            margin: 0;
        }}
        *, *::before, *::after {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        html, body {{
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: 'Suranna', 'Ramabhadra', serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
        .pdf-page {{
            width: 297mm;
            height: 420mm;
            max-height: 420mm;
            padding: 12mm 10mm;
            background: #ffffff;
            margin: 0 auto;
            box-sizing: border-box;
            position: relative;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
    </style>
</head>
<body>
    <div style="padding: 0; width: 297mm;">
        {"".join(pages_html)}
    </div>
</body>
</html>
"""
    return html

def _get_chromium_executable() -> Optional[str]:
    """Locate the Chromium executable installed by Playwright on Render/Linux or return None for local auto-detect."""
    import glob
    browsers_path = os.getenv("PLAYWRIGHT_BROWSERS_PATH")
    if not browsers_path:
        if os.path.isdir("/opt/render/project/.playwright"):
            browsers_path = "/opt/render/project/.playwright"
        else:
            return None

    patterns = [
        os.path.join(browsers_path, "chromium-*/chrome-linux/chrome"),
        os.path.join(browsers_path, "chromium-*/chrome-linux/chromium"),
        os.path.join(browsers_path, "chromium-*/chrome"),
        os.path.join(browsers_path, "chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell"),
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            print(f"[PLAYWRIGHT] Using Chromium at: {matches[0]}")
            return matches[0]

    return None

def render_html_to_pdf(html_content: str, output_path: str) -> bool:
    """Render HTML string to A3 PDF file using Playwright Chromium with guaranteed styling, low memory, and image compression."""
    try:
        import os
        from playwright.sync_api import sync_playwright

        chrome_path = _get_chromium_executable()
        launch_kwargs = {
            "headless": True,
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
                "--disable-extensions",
                "--disable-background-networking",
                "--mute-audio",
                "--font-render-hinting=none"
            ]
        }
        if chrome_path:
            launch_kwargs["executable_path"] = chrome_path

        with sync_playwright() as p:
            browser = p.chromium.launch(**launch_kwargs)
            context = browser.new_context(
                viewport={"width": 1123, "height": 1587},
                device_scale_factor=1
            )
            page = context.new_page()

            # Compress high-resolution images on-the-fly to prevent Out-Of-Memory on 512MB RAM instances
            def route_image_compress(route, request):
                if request.resource_type == "image":
                    try:
                        response = route.fetch()
                        body = response.body()
                        if len(body) > 60_000:
                            import io
                            from PIL import Image
                            im = Image.open(io.BytesIO(body))
                            im.thumbnail((450, 450), Image.Resampling.LANCZOS)
                            out_buf = io.BytesIO()
                            im.convert("RGB").save(out_buf, format="JPEG", quality=65)
                            route.fulfill(response=response, body=out_buf.getvalue(), headers={"content-type": "image/jpeg"})
                            return
                        route.fulfill(response=response)
                    except Exception:
                        route.continue_()
                elif request.resource_type in ["media", "websocket", "eventsource"]:
                    route.abort()
                else:
                    route.continue_()

            page.route("**/*", route_image_compress)

            # Emulate screen media so CSS flexbox & multi-columns layout identically to browser preview
            page.emulate_media(media="screen")
            page.set_content(html_content, wait_until="domcontentloaded", timeout=60000)

            # Wait for Telugu web fonts to finish rendering
            try:
                page.evaluate("document.fonts ? document.fonts.ready : Promise.resolve()")
            except Exception:
                pass

            # Allow up to 3 seconds for images to finish loading without blocking if slow/missing
            try:
                page.evaluate("""
                    Promise.race([
                        Promise.all(
                            Array.from(document.images)
                                .filter(img => !img.complete)
                                .map(img => new Promise(res => { img.onload = img.onerror = res; }))
                        ),
                        new Promise(res => setTimeout(res, 3000))
                    ])
                """)
            except Exception:
                pass

            page.wait_for_timeout(800)

            body_text = page.evaluate("() => document.body ? document.body.innerText.length : 0")
            print(f"[PDF Generator] Page body text length: {body_text}")

            page.pdf(
                path=output_path,
                format="A3",
                print_background=True,
                prefer_css_page_size=True,
                display_header_footer=False,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            browser.close()
            file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
            print(f"[PDF Generator] Generated PDF size: {file_size} bytes at {output_path}")
            return file_size > 100
    except Exception as e:
        logger.error(f"Playwright PDF rendering error: {e}")
        print(f"Playwright PDF rendering error: {e}")
        return False


def generate_chunked_daily_newspaper_pdf(
    publication_name: str,
    logo_url: str,
    edition_date: str,
    articles: List[Dict[str, Any]],
    output_path: str,
    lead_story_id: Optional[str] = None,
    advertisement_config: Optional[Dict[str, Any]] = None,
    edition_info: Optional[Dict[str, Any]] = None,
    max_articles_per_chunk: int = 8
) -> bool:
    """
    Render large newspapers (e.g. 50-100+ articles, 10+ pages) safely on memory-constrained servers (Render 512MB RAM).
    Splits articles into chunks of ~8-9 articles (exactly 1 A3 page per chunk), renders each chunk in an isolated Chromium
    instance to avoid accumulating Chromium memory, and merges them using pypdf.
    """
    import gc
    import pypdf

    total_articles = len(articles)
    if total_articles <= 8:
        # Single chunk is lightweight and safe
        html_content = build_newspaper_html(
            publication_name=publication_name,
            logo_url=logo_url,
            edition_date=edition_date,
            articles=articles,
            lead_story_id=lead_story_id,
            advertisement_config=advertisement_config,
            edition_info=edition_info
        )
        return render_html_to_pdf(html_content, output_path)

    # Reorder articles if lead_story_id is provided so it stays first
    ordered_articles = list(articles)
    if lead_story_id:
        lead_idx = next((i for i, a in enumerate(ordered_articles) if str(a.get("id")) == str(lead_story_id)), None)
        if lead_idx is not None:
            lead_item = ordered_articles.pop(lead_idx)
            ordered_articles.insert(0, lead_item)

    # Dynamic target page count: ~9-10 articles per page
    target_pages = max(1, (total_articles + 8) // 9)
    articles_per_page = max(1, (total_articles + target_pages - 1) // target_pages)

    # Group into single-page chunks (each page has articles_per_page articles)
    chunks = []
    for p in range(target_pages):
        start = p * articles_per_page
        end = min(start + articles_per_page, total_articles)
        page_slice = ordered_articles[start:end]
        if page_slice:
            chunks.append((p, page_slice))

    print(f"[PDF Generator] Rendering {total_articles} articles across {len(chunks)} chunks for memory safety...")
    temp_dir = os.path.dirname(output_path)
    base_name = os.path.splitext(os.path.basename(output_path))[0]
    
    merger = pypdf.PdfWriter()
    temp_files = []

    try:
        for chunk_idx, (page_idx, chunk_articles) in enumerate(chunks):
            chunk_pdf = os.path.join(temp_dir, f"{base_name}_chunk_{chunk_idx}.pdf")
            temp_files.append(chunk_pdf)

            chunk_html = build_newspaper_html(
                publication_name=publication_name,
                logo_url=logo_url,
                edition_date=edition_date,
                articles=chunk_articles,
                lead_story_id=lead_story_id if chunk_idx == 0 else None,
                advertisement_config=advertisement_config,
                edition_info=edition_info,
                page_offset=page_idx,
                total_pages_override=target_pages
            )

            ok = render_html_to_pdf(chunk_html, chunk_pdf)
            if not ok or not os.path.exists(chunk_pdf):
                raise RuntimeError(f"Failed to render chunk {chunk_idx + 1}/{len(chunks)}")

            merger.append(chunk_pdf)
            gc.collect()

        with open(output_path, "wb") as f_out:
            merger.write(f_out)
        merger.close()
        print(f"[PDF Generator] Successfully merged all {len(chunks)} chunks into {output_path} ({os.path.getsize(output_path)} bytes)")
        return True
    except Exception as e:
        logger.error(f"[PDF Generator] Chunked rendering error: {e}")
        print(f"[PDF Generator] Chunked rendering error: {e}")
        return False
    finally:
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass
        gc.collect()

