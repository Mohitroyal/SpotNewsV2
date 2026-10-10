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
    edition_info: Optional[Dict[str, Any]] = None
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

    PAGE1_CAPACITY = 12000
    PAGE_CAPACITY = 16000
    OVERFILL_MARGIN = 4000
    
    chunked_pages = []
    current_page_articles = []
    current_weight = 0
    
    filler_pool = []
    
    def get_fillers(needed_limit=40):
        try:
            from django.db import connection
            import json
            with connection.cursor() as cursor:
                format_strings = ','.join(['%s'] * len(used_ids)) if used_ids else "''"
                query = """
                    SELECT 
                        c.id, c.headline, c.article_content,
                        c.image_url, c.image_urls, c.created_at,
                        p.full_name as reporter_name, c.district
                    FROM clippings c
                    LEFT JOIN profiles p ON c.user_id = p.id
                    WHERE (c.is_posted = true OR c.is_posted IS NULL OR c.status IN ('completed', 'published', 'posted'))
                      AND (c.status IS NULL OR c.status NOT IN ('draft', 'rejected', 'deleted'))
                      AND LENGTH(c.article_content) > 50
                """
                params = []
                if used_ids:
                    query += f" AND c.id::text NOT IN ({format_strings})"
                    params.extend(list(used_ids))
                    
                query += " ORDER BY c.created_at DESC LIMIT %s"
                params.append(needed_limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                new_fillers = []
                for r in rows:
                    raw_imgs = r[4]
                    if isinstance(raw_imgs, str):
                        try:
                            raw_imgs = json.loads(raw_imgs)
                        except:
                            raw_imgs = [raw_imgs]
                    elif not raw_imgs and r[3]:
                        raw_imgs = [r[3]]
                    elif not raw_imgs:
                        raw_imgs = []

                    art_id = str(r[0])
                    art = {
                        "id": art_id,
                        "headline": r[1] or "ముఖ్యాంశం",
                        "content": r[2] or "",
                        "image_url": r[3] or (raw_imgs[0] if raw_imgs else ""),
                        "image_urls": raw_imgs,
                        "reporter_name": r[6] or "రిపోర్టర్",
                        "district": r[7] or "",
                        "location": r[7] or ""
                    }
                    
                    headline_text = sanitize_text(art["headline"])
                    content_text = sanitize_text(art["content"])
                    img_cost = 400 if raw_imgs else 0
                    weight = len(content_text) + int(len(headline_text) * 2) + img_cost
                    
                    new_fillers.append({
                        "art": art,
                        "weight": weight,
                        "is_filler": True
                    })
                    used_ids.add(art_id)
                return new_fillers
        except Exception as e:
            logger.error(f"Error fetching fillers: {e}")
            return []

    while remaining_primary or current_weight > 0:
        capacity = PAGE1_CAPACITY if len(chunked_pages) == 0 else PAGE_CAPACITY
        target_weight = capacity + OVERFILL_MARGIN
        
        placed = False
        for i, item in enumerate(remaining_primary):
            if current_weight + item["weight"] <= capacity:
                current_page_articles.append(item)
                current_weight += item["weight"]
                remaining_primary.pop(i)
                placed = True
                break
                
        if not placed:
            if len(current_page_articles) == 0 and remaining_primary:
                item = remaining_primary.pop(0)
                current_page_articles.append(item)
                
            chunked_pages.append(current_page_articles)
            current_page_articles = []
            current_weight = 0

    global_idx = 0
    pages_html = []
    for page_idx, page_group in enumerate(chunked_pages):
        is_first_page = (page_idx == 0)
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
                head_style = f"font-size: 34px; font-weight: 900; color: {color}; line-height: 1.15; margin-bottom: 6px; text-align: center;"
                content_style = "column-count: 3; column-gap: 18px; font-size: 13px; line-height: 1.5; text-align: justify; color: #111;"
                
                lead_story_html = f"""
                <div style="margin-bottom: 12px; border-bottom: 2px solid #D60000; padding-bottom: 8px;">
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
            
        masthead = masthead_block if is_first_page else ""
        # For the last page, avoid page-break-after to prevent a trailing blank page
        custom_footer = f"""
        <div style="position: absolute; bottom: 12mm; left: 10mm; right: 10mm; font-size: 11px; font-weight: bold; border-top: 2px solid #000; display: flex; justify-content: space-between; font-family: sans-serif; color: #444; padding-top: 4px;">
            <span>{publication_name.upper()} — TELUGU DAILY</span>
            <span>PAGE {page_idx + 1} OF {len(chunked_pages)}</span>
        </div>
        """
        
        page_break = "break-inside: avoid; page-break-inside: avoid;"
        
        page_html = f"""
        <div class="pdf-page" style="width: 297mm; height: 396mm; padding: 12mm 10mm; background: white; margin: 0 auto; box-sizing: border-box; {page_break} position: relative; display: flex; flex-direction: column;">
            <div class="header-section" style="flex: 0 0 auto;">
                {masthead}
                {lead_story_html}
            </div>
            <div style="flex: 1 1 0; min-height: 0; column-count: 5; column-gap: 10px; column-rule: 1px solid #ccc; column-fill: auto; orphans: 2; widows: 2; margin-top: 5px; margin-bottom: 25px;">
                {"".join(articles_html)}
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
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        html, body {{
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: 'Noto Serif Telugu', serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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

def render_html_to_pdf(html_content: str, output_path: str) -> bool:
    """Render HTML string to A3 PDF file using Playwright Chromium with continuous flow pagination."""
    
    header_template = f"""
    <div style="width: 100%; font-size: 11px; font-weight: bold; border-bottom: 2px solid #006600; margin: 0 10mm; padding-bottom: 4px; display: flex; justify-content: space-between; font-family: sans-serif; color: #333;">
        <span style="color: #006600;">స్పాట్ న్యూస్ — దినపత్రిక</span>
        <span>పేజీ <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
    """
    
    footer_template = f"""
    <div style="width: 100%; font-size: 11px; font-weight: bold; border-top: 2px solid #000; margin: 0 10mm; padding-top: 4px; display: flex; justify-content: space-between; font-family: sans-serif; color: #444;">
        <span>స్పాట్ న్యూస్ — TELUGU DAILY</span>
        <span>PAGE <span class="pageNumber"></span> OF <span class="totalPages"></span></span>
    </div>
    """

    try:
        import os
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--font-render-hinting=none"
                ]
            )
            # Set viewport to A3 pixel dimensions (297mm x 420mm at 96dpi = 1123x1587)
            context = browser.new_context(
                viewport={"width": 1123, "height": 1587},
                device_scale_factor=1
            )
            page = context.new_page()
            page.set_content(html_content, wait_until="networkidle", timeout=120000)
            # Wait extra time for fonts and images to render
            page.wait_for_timeout(5000)
            # Log page body text to confirm content exists
            body_text = page.evaluate("() => document.body ? document.body.innerText.length : 0")
            print(f"[PDF Generator] Page body text length: {body_text}")
            page.pdf(
                path=output_path,
                format="A3",
                print_background=True,
                display_header_footer=False,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            browser.close()
            file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
            print(f"[PDF Generator] Generated PDF size: {file_size} bytes at {output_path}")
            return file_size > 100  # Must be more than 100 bytes to be valid
    except Exception as e:
        logger.error(f"Playwright PDF rendering error: {e}")
        print(f"Playwright PDF rendering error: {e}")
        return False
