import os
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
    Generate clean, print-ready HTML string for A3 Portrait Daily Newspaper.
    Uses CSS Multi-column layout for perfect text/image flowing with no whitespaces.
    """
    telugu_date_formatted = format_telugu_date(edition_date)
    
    # Calculate page split: ~12 articles per page
    total_articles = len(articles)
    articles_per_page = 12
    total_pages = max(1, (total_articles + articles_per_page - 1) // articles_per_page)
    
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

    pages_html = []
    headline_colors = ["#D60000", "#003399", "#8B0055", "#006600", "#111111"]

    for page_num in range(1, total_pages + 1):
        start_idx = (page_num - 1) * articles_per_page
        end_idx = min(start_idx + articles_per_page, total_articles)
        page_articles = ordered_articles[start_idx:end_idx]
        
        is_first_page = (page_num == 1)
        
        # Header construction
        if is_first_page:
            ad_html = ""
            if advertisement_config and advertisement_config.get("image_url"):
                ad_html = f"""
                <div style="width: 28%; padding-left: 10px; text-align: center;">
                    <img src="{advertisement_config['image_url']}" style="max-height: 85px; max-width: 100%; border: 1px solid #ccc; padding: 2px;" />
                </div>
                """
            
            header_block = f"""
            <!-- Masthead -->
            <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 10px 0; border-bottom: 4px solid #D60000; margin-bottom: 4px;">
                <div style="flex: 1; text-align: center;">
                    <img src="{logo_url}" alt="{sanitize_text(publication_name)}" style="max-height: 100px; max-width: 100%; object-fit: contain;" />
                </div>
                {ad_html}
            </div>
            
            <!-- Meta Strip -->
            <div style="display: flex; justify-content: space-between; align-items: center; background: #006600; color: #ffffff; font-size: 13px; font-weight: bold; padding: 5px 15px; margin-bottom: 12px; border-radius: 2px;">
                <div>సంపుటి: {edition_no} &nbsp;|&nbsp; సంచిక: {issue_no} &nbsp;|&nbsp; ఎడిటర్: {sanitize_text(editor_name)}</div>
                <div style="color: #FFEB3B;">పేజీలు: {total_pages} &nbsp;|&nbsp; వెల: {price}</div>
                <div>{telugu_date_formatted} &nbsp;|&nbsp; {sanitize_text(location)}</div>
            </div>
            """
        else:
            header_block = f"""
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #006600; padding-bottom: 5px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="{logo_url}" alt="{sanitize_text(publication_name)}" style="height: 40px; object-fit: contain;" />
                    <span style="font-size: 16px; font-weight: 800; color: #006600;">{sanitize_text(publication_name)} — దినపత్రిక</span>
                </div>
                <div style="font-size: 13px; font-weight: bold; color: #333;">{telugu_date_formatted} &nbsp;|&nbsp; పేజీ {page_num} of {total_pages}</div>
            </div>
            """

        items_html = []
        for idx, art in enumerate(page_articles):
            headline = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
            content = sanitize_text(art.get("content") or art.get("summary") or "")
            reporter = sanitize_text(art.get("reporter_name") or art.get("byline") or "రిపోర్టర్")
            loc = sanitize_text(art.get("location") or art.get("district") or "")
            
            imgs = art.get("image_urls") or []
            if not imgs and art.get("image_url"):
                imgs = [art.get("image_url")]
            
            # The very first article of the very first page can be a full-width lead story
            is_lead = (is_first_page and idx == 0)
            
            color = headline_colors[idx % len(headline_colors)]
            
            if is_lead:
                span_style = "column-span: all; margin-bottom: 15px; border-bottom: 2px solid #D60000; padding-bottom: 10px;"
                head_style = f"font-size: 36px; font-weight: 900; color: {color}; line-height: 1.15; margin-bottom: 8px; text-align: center;"
                # Inner columns for lead story text
                content_style = "column-count: 3; column-gap: 20px; font-size: 13.5px; line-height: 1.55; text-align: justify; color: #111;"
                img_style = "width: 100%; max-height: 350px; object-fit: cover; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid;"
            else:
                span_style = "break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid; margin-bottom: 15px; border-top: 2px solid #ccc; padding-top: 10px;"
                head_style = f"font-size: 18px; font-weight: 800; color: {color}; line-height: 1.25; margin-bottom: 6px;"
                content_style = "font-size: 12px; line-height: 1.45; text-align: justify; color: #111;"
                img_style = "width: 100%; max-height: 200px; object-fit: cover; margin-bottom: 6px; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid;"

            img_html = ""
            if imgs and len(imgs) > 0:
                first_img = imgs[0]
                img_html = f"""
                <div style="text-align: center; margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid;">
                    <img src="{first_img}" style="{img_style}" />
                </div>
                """

            byline_str = f"{loc} &nbsp;|&nbsp; {reporter}" if loc and reporter else (loc or reporter)
            byline_html = f'<div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #eee;">{byline_str}</div>'

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
            items_html.append(item_html)

        # The body of the page uses CSS multi-columns (4 columns) to auto-flow and fill whitespace perfectly.
        page_markup = f"""
        <div class="page-container">
            {header_block}
            <div class="articles-flow" style="column-count: 4; column-gap: 15px; flex: 1;">
                {"".join(items_html)}
            </div>
            <div class="footer-strip">
                <span>{sanitize_text(publication_name)} — TELUGU DAILY</span>
                <span>PAGE {page_num} OF {total_pages}</span>
            </div>
        </div>
        """
        pages_html.append(page_markup)

    full_body = "".join(pages_html)

    html = f"""<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <title>{sanitize_text(publication_name)} - {edition_date}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page {{
            size: 297mm 420mm; /* A3 Portrait */
            margin: 10mm;
        }}
        *, *::before, *::after {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        html, body {{
            background: #ffffff;
            color: #000000;
            font-family: 'Noto Serif Telugu', serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
        .page-container {{
            width: 277mm;
            min-height: 400mm;
            box-sizing: border-box;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            background: #ffffff;
            position: relative;
        }}
        .footer-strip {{
            height: 25px;
            border-top: 2px solid #000000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            font-weight: bold;
            color: #444;
            padding: 0 10px;
            margin-top: 15px;
            font-family: sans-serif;
        }}
    </style>
</head>
<body>
    {full_body}
</body>
</html>
"""
    return html

def render_html_to_pdf(html_content: str, output_path: str) -> bool:
    """Render HTML string to A3 PDF file using Playwright Chromium."""
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--single-process"
                ]
            )
            page = browser.new_page()
            page.set_content(html_content, wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(3000)
            page.pdf(
                path=output_path,
                format="A3",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            browser.close()
            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
    except Exception as e:
        logger.error(f"Playwright PDF rendering error: {e}")
        print(f"Playwright PDF rendering error: {e}")
        return False
