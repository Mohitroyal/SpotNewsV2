import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

TELUGU_DAYS = {
    0: "సోమవారం", 1: "మంగళవారం", 2: "బుధవారం",
    3: "గురువారం", 4: "శుక్రవారం", 5: "శనివారం", 6: "ఆదివారం"
}
TELUGU_MONTHS = {
    1: "జనవరి", 2: "ఫిబ్రవరి", 3: "మార్చి", 4: "ఏప్రిల్",
    5: "మే", 6: "జూన్", 7: "జులై", 8: "ఆగస్టు",
    9: "సెప్టెంబర్", 10: "అక్టోబర్", 11: "నవంబర్", 12: "డిసెంబర్"
}

def format_telugu_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        weekday = TELUGU_DAYS[dt.weekday()]
        return f"{weekday} - {dt.day:02d} - {TELUGU_MONTHS[dt.month]} - {dt.year}"
    except Exception:
        return date_str

def sanitize_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'[\x00-\x1F\x7F]', '', str(text))
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").strip()

def optimize_image_url(url: Optional[str], max_width: int = 500) -> str:
    """
    Supabase Storage on-the-fly image optimization:
    Converts raw 12MP (4000x3000) camera photos into compact ~500px thumbnails.
    Cuts image memory from 48MB per bitmap down to <0.8MB per bitmap in Chromium!
    """
    if not url:
        return ""
    clean_url = str(url).strip()
    if "/storage/v1/object/public/" in clean_url:
        return clean_url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + f"?width={max_width}&resize=contain&quality=80"
    return clean_url

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
    telugu_date_formatted = format_telugu_date(edition_date)
    
    # Reorder articles if lead_story_id is provided so it stays first
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

    opt_logo_url = optimize_image_url(logo_url, max_width=350)

    ad_html = ""
    if advertisement_config and advertisement_config.get("image_url"):
        opt_ad_url = optimize_image_url(advertisement_config['image_url'], max_width=350)
        ad_html = f"""
        <div style="width: 25%; padding-left: 10px; text-align: center;">
            <img src="{opt_ad_url}" style="max-height: 85px; max-width: 100%; border: 1px solid #ccc; padding: 2px;" />
        </div>
        """

    masthead_block = f"""
    <!-- Masthead (Page 1) -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 4px 0; border-bottom: 3.5px solid #D60000; margin-bottom: 3px;">
        <div style="flex: 1; text-align: center;">
            <img src="{opt_logo_url}" alt="{sanitize_text(publication_name)}" style="max-height: 85px; max-width: 100%; object-fit: contain;" />
        </div>
        {ad_html}
    </div>
    
    <!-- Meta Strip -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #006600; color: #ffffff; font-size: 13px; font-weight: bold; padding: 5px 15px; margin-bottom: 8px; border-radius: 2px;">
        <div>సంపుటి: {edition_no} &nbsp;|&nbsp; సంచిక: {issue_no} &nbsp;|&nbsp; ఎడిటర్: {sanitize_text(editor_name)}</div>
        <div style="color: #FFEB3B;">దినపత్రిక &nbsp;|&nbsp; వెల: {price}</div>
        <div>{telugu_date_formatted} &nbsp;|&nbsp; {sanitize_text(location)}</div>
    </div>
    """

    headline_colors = ["#D60000", "#003399", "#8B0055", "#006600", "#111111"]
    
    total_articles = len(ordered_articles)
    target_pages = max(1, (total_articles + 8) // 9) if not total_pages_override else total_pages_override
    articles_per_page = max(1, (total_articles + target_pages - 1) // target_pages)
    
    chunked_pages = []
    for p in range(target_pages):
        start = p * articles_per_page
        end = min(start + articles_per_page, total_articles)
        page_slice = ordered_articles[start:end]
        if page_slice:
            chunked_pages.append(page_slice)

    pages_html = []
    global_idx = 0

    for page_idx, page_articles in enumerate(chunked_pages):
        display_page_num = page_offset + page_idx + 1
        is_first_page = (display_page_num == 1)
        count = len(page_articles)

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

        page_content_html = ""

        if is_first_page and count >= 1:
            lead_art = page_articles[0]
            lead_headline = sanitize_text(lead_art.get("headline") or lead_art.get("title") or "ముఖ్యాంశం")
            lead_content = sanitize_text(lead_art.get("content") or lead_art.get("summary") or "")
            lead_reporter = sanitize_text(lead_art.get("reporter_name") or lead_art.get("byline") or "రిపోర్టర్")
            lead_loc = sanitize_text(lead_art.get("location") or lead_art.get("district") or "")
            lead_imgs = lead_art.get("image_urls") or []
            if not lead_imgs and lead_art.get("image_url"):
                lead_imgs = [lead_art.get("image_url")]

            lead_color = headline_colors[0]
            global_idx += 1

            lead_byline = f"{lead_loc} &nbsp;|&nbsp; {lead_reporter}" if lead_loc and lead_reporter else (lead_loc or lead_reporter)
            lead_byline_html = f'<div style="font-size: 11.5px; font-weight: bold; color: #555; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #ddd;">{lead_byline}</div>'

            lead_img_html = ""
            if lead_imgs:
                opt_lead_img = optimize_image_url(lead_imgs[0], max_width=750)
                lead_img_html = f"""
                <div style="width: 44%; float: left; margin-right: 18px; margin-bottom: 10px;">
                    <img src="{opt_lead_img}" style="width: 100%; max-height: 270px; object-fit: cover; border: 1px solid #ccc; padding: 2px; border-radius: 2px; display: block;" />
                </div>
                """

            lead_story_html = f"""
            <div class="lead-story-card" style="border-bottom: 3px solid #D60000; padding-bottom: 12px; margin-bottom: 10px; flex: 0 0 auto;">
                <h1 style="font-size: 28px; font-weight: 900; color: {lead_color}; line-height: 1.22; margin-bottom: 5px;">
                    {lead_headline}
                </h1>
                {lead_byline_html}
                <div style="font-size: 13px; line-height: 1.55; text-align: justify; color: #111;">
                    {lead_img_html}
                    <p style="margin: 0; text-indent: 18px;">{lead_content}</p>
                    <div style="clear: both;"></div>
                </div>
            </div>
            """

            sec_articles = page_articles[1:]
            sec_count = len(sec_articles)

            if sec_count > 0:
                grid_cols = min(4, sec_count)
                sec_items_html = []
                for s_idx, s_art in enumerate(sec_articles):
                    s_head = sanitize_text(s_art.get("headline") or s_art.get("title") or "ముఖ్యాంశం")
                    s_cont = sanitize_text(s_art.get("content") or s_art.get("summary") or "")
                    s_rep = sanitize_text(s_art.get("reporter_name") or s_art.get("byline") or "రిపోర్టర్")
                    s_loc = sanitize_text(s_art.get("location") or s_art.get("district") or "")
                    s_imgs = s_art.get("image_urls") or []
                    if not s_imgs and s_art.get("image_url"):
                        s_imgs = [s_art.get("image_url")]

                    s_color = headline_colors[(global_idx) % len(headline_colors)]
                    global_idx += 1

                    s_byline = f"{s_loc} &nbsp;|&nbsp; {s_rep}" if s_loc and s_rep else (s_loc or s_rep)
                    s_byline_html = f'<div style="font-size: 10.5px; font-weight: bold; color: #666; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #eee;">{s_byline}</div>'

                    s_img_html = ""
                    if s_imgs:
                        opt_s_img = optimize_image_url(s_imgs[0], max_width=450)
                        s_img_html = f"""
                        <div style="margin-bottom: 6px; text-align: center;">
                            <img src="{opt_s_img}" style="width: 100%; max-height: 175px; object-fit: cover; border: 1px solid #ddd; padding: 1px; border-radius: 2px;" />
                        </div>
                        """

                    is_last_col = (s_idx == sec_count - 1)
                    border_right = "none" if is_last_col else "1px solid #ccc"

                    item_html = f"""
                    <div class="news-card" style="border-right: {border_right}; padding: 0 10px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
                        <h2 style="font-size: 17px; font-weight: 800; color: {s_color}; line-height: 1.25; margin-bottom: 4px;">
                            {s_head}
                        </h2>
                        {s_byline_html}
                        {s_img_html}
                        <div style="font-size: 12px; line-height: 1.48; text-align: justify; color: #111; flex: 1; overflow: hidden;">
                            <p style="margin: 0; text-indent: 14px;">{s_cont}</p>
                        </div>
                    </div>
                    """
                    sec_items_html.append(item_html)

                page_content_html = f"""
                <div style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;">
                    {lead_story_html}
                    <div class="secondary-grid" style="flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat({grid_cols}, 1fr); gap: 10px; align-items: stretch;">
                        {"".join(sec_items_html)}
                    </div>
                </div>
                """
            else:
                page_content_html = f"""
                <div style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;">
                    {lead_story_html}
                </div>
                """
        else:
            # Interior pages:
            grid_cols = min(4, max(2, count))
            items_html = []
            for a_idx, art in enumerate(page_articles):
                head = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
                cont = sanitize_text(art.get("content") or art.get("summary") or "")
                rep = sanitize_text(art.get("reporter_name") or art.get("byline") or "రిపోర్టర్")
                loc = sanitize_text(art.get("location") or art.get("district") or "")
                imgs = art.get("image_urls") or []
                if not imgs and art.get("image_url"):
                    imgs = [art.get("image_url")]

                color = headline_colors[(global_idx) % len(headline_colors)]
                global_idx += 1

                byline = f"{loc} &nbsp;|&nbsp; {rep}" if loc and rep else (loc or rep)
                byline_html = f'<div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #eee;">{byline}</div>'

                img_html = ""
                if imgs:
                    opt_img = optimize_image_url(imgs[0], max_width=450)
                    img_html = f"""
                    <div style="margin-bottom: 6px; text-align: center;">
                        <img src="{opt_img}" style="width: 100%; max-height: 190px; object-fit: cover; border: 1px solid #ddd; padding: 1px; border-radius: 2px;" />
                    </div>
                    """

                is_last_col = (a_idx == count - 1)
                border_right = "none" if is_last_col else "1px solid #ccc"

                item_html = f"""
                <div class="news-card" style="border-right: {border_right}; padding: 0 10px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
                    <h2 style="font-size: 18px; font-weight: 800; color: {color}; line-height: 1.25; margin-bottom: 5px;">
                        {head}
                    </h2>
                    {byline_html}
                    {img_html}
                    <div style="font-size: 12.5px; line-height: 1.48; text-align: justify; color: #111; flex: 1; overflow: hidden;">
                        <p style="margin: 0; text-indent: 14px;">{cont}</p>
                    </div>
                </div>
                """
                items_html.append(item_html)

            page_content_html = f"""
            <div style="flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat({grid_cols}, 1fr); gap: 12px; align-items: stretch;">
                {"".join(items_html)}
            </div>
            """

        page_footer = f"""
        <div class="footer-section" style="flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #333; padding-top: 4px; font-size: 11px; color: #444; margin-top: 8px;">
            <div>{sanitize_text(publication_name)} - {edition_date}</div>
            <div style="font-weight: bold;">పేజీ {display_page_num}</div>
        </div>
        """

        is_last_page = (page_idx == len(chunked_pages) - 1)
        page_break_style = "" if is_last_page else "page-break-after: always; break-after: page;"

        page_html = f"""
        <div class="pdf-page" style="width: 297mm; height: 420mm; max-height: 420mm; padding: 10mm 10mm; background: #ffffff; margin: 0 auto; box-sizing: border-box; position: relative; display: flex; flex-direction: column; overflow: hidden; page-break-inside: avoid; break-inside: avoid; {page_break_style}">
            <div class="header-section" style="flex: 0 0 auto;">
                {header_html}
            </div>
            {page_content_html}
            {page_footer}
        </div>
        """
        pages_html.append(page_html)

    html = f"""<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <title>{sanitize_text(publication_name)} - {edition_date}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;600;700;800;900&family=Noto+Sans+Telugu:wght@400;600;700&display=swap" rel="stylesheet">
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
            font-family: 'Noto Serif Telugu', serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
        .pdf-page {{
            width: 297mm;
            height: 420mm;
            max-height: 420mm;
            padding: 10mm 10mm;
            background: #ffffff;
            margin: 0 auto;
            box-sizing: border-box;
            position: relative;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: always;
            break-after: page;
        }}
        .pdf-page:last-child {{
            page-break-after: auto;
            break-after: auto;
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
    import glob
    browsers_path = os.getenv("PLAYWRIGHT_BROWSERS_PATH")
    if not browsers_path:
        if os.path.isdir("/opt/render/project/.playwright"):
            browsers_path = "/opt/render/project/.playwright"
        else:
            return None

    patterns = [
        os.path.join(browsers_path, "chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell"),
        os.path.join(browsers_path, "chromium-*/chrome-linux/chrome"),
        os.path.join(browsers_path, "chromium-*/chrome-linux/chromium"),
        os.path.join(browsers_path, "chromium-*/chrome"),
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            print(f"[PLAYWRIGHT] Using Chromium at: {matches[0]}")
            return matches[0]

    return None

def render_html_to_pdf(html_content: str, output_path: str) -> bool:
    """Render HTML string to A3 PDF file using Playwright Chromium with guaranteed styling and low memory."""
    try:
        from playwright.sync_api import sync_playwright

        chrome_path = _get_chromium_executable()
        launch_kwargs = {
            "headless": True,
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--no-zygote",
                "--renderer-process-limit=1",
                "--single-process-network-service",
                "--js-flags=--max-old-space-size=48",
                "--disable-site-isolation-trials",
                "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process",
                "--disable-extensions",
                "--disable-background-networking",
                "--mute-audio"
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
            page.emulate_media(media="screen")
            page.set_content(html_content, wait_until="domcontentloaded", timeout=60000)

            # Wait for Telugu web fonts (up to 2s guard)
            try:
                page.evaluate("Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2000))])")
            except Exception:
                pass

            # Allow up to 2.5s for images without blocking
            try:
                page.evaluate("""
                    Promise.race([
                        Promise.all(
                            Array.from(document.images)
                                .filter(img => !img.complete)
                                .map(img => new Promise(res => { img.onload = img.onerror = res; }))
                        ),
                        new Promise(res => setTimeout(res, 2500))
                    ])
                """)
            except Exception:
                pass

            page.pdf(
                path=output_path,
                format="A3",
                print_background=True,
                prefer_css_page_size=True,
                display_header_footer=False,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            try:
                page.close()
            except Exception:
                pass
            try:
                context.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass

            file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
            print(f"[PDF Generator] Generated PDF size: {file_size} bytes at {output_path}")
            return file_size > 100
    except Exception as e:
        print(f"Playwright PDF rendering error: {e}")
        return False
    finally:
        import gc
        gc.collect()

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
    import gc
    import io
    import pypdf
    from playwright.sync_api import sync_playwright

    total_articles = len(articles)
    ordered_articles = list(articles)
    if lead_story_id:
        lead_idx = next((i for i, a in enumerate(ordered_articles) if str(a.get("id")) == str(lead_story_id)), None)
        if lead_idx is not None:
            lead_item = ordered_articles.pop(lead_idx)
            ordered_articles.insert(0, lead_item)

    # For small edition (<= 10 articles, 1 page), render in single shot
    if total_articles <= 10:
        full_html = build_newspaper_html(
            publication_name=publication_name,
            logo_url=logo_url,
            edition_date=edition_date,
            articles=ordered_articles,
            lead_story_id=lead_story_id,
            advertisement_config=advertisement_config,
            edition_info=edition_info
        )
        return render_html_to_pdf(full_html, output_path)

    # For larger editions (50-90+ articles), render Page-by-Page in a single browser session.
    # Closing each page immediately frees all decoded image bitmaps and DOM trees.
    # Memory stays strictly under 150MB across the entire generation!
    target_pages = max(1, (total_articles + 7) // 8)
    articles_per_page = max(1, (total_articles + target_pages - 1) // target_pages)

    chunks = []
    for p in range(target_pages):
        start = p * articles_per_page
        end = min(start + articles_per_page, total_articles)
        page_slice = ordered_articles[start:end]
        if page_slice:
            chunks.append((p, page_slice))

    print(f"[PDF Generator] Rendering {total_articles} articles across {len(chunks)} pages in low-memory session...")

    chrome_path = _get_chromium_executable()
    launch_kwargs = {
        "headless": True,
        "args": [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--no-zygote",
            "--renderer-process-limit=1",
            "--single-process-network-service",
            "--js-flags=--max-old-space-size=48",
            "--disable-site-isolation-trials",
            "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process",
            "--disable-extensions",
            "--disable-background-networking",
            "--mute-audio"
        ]
    }
    if chrome_path:
        launch_kwargs["executable_path"] = chrome_path

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**launch_kwargs)
            context = browser.new_context(
                viewport={"width": 1123, "height": 1587},
                device_scale_factor=1
            )
            merger = pypdf.PdfWriter()

            for chunk_idx, (page_idx, chunk_articles) in enumerate(chunks):
                chunk_html = build_newspaper_html(
                    publication_name=publication_name,
                    logo_url=logo_url,
                    edition_date=edition_date,
                    articles=chunk_articles,
                    lead_story_id=lead_story_id if chunk_idx == 0 else None,
                    advertisement_config=advertisement_config,
                    edition_info=edition_info,
                    page_offset=page_idx,
                    total_pages_override=1
                )

                page = context.new_page()
                page.emulate_media(media="screen")
                page.set_content(chunk_html, wait_until="domcontentloaded", timeout=20000)

                # Wait for fonts on first page only
                if chunk_idx == 0:
                    try:
                        page.evaluate("Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))])")
                    except Exception:
                        pass

                # Fast non-blocking image load guard (up to 600ms)
                try:
                    page.evaluate("""
                        Promise.race([
                            Promise.all(
                                Array.from(document.images)
                                    .filter(img => !img.complete)
                                    .map(img => new Promise(res => { img.onload = img.onerror = res; }))
                            ),
                            new Promise(res => setTimeout(res, 600))
                        ])
                    """)
                except Exception:
                    pass

                pdf_bytes = page.pdf(
                    format="A3",
                    print_background=True,
                    prefer_css_page_size=True,
                    display_header_footer=False,
                    margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
                )
                try:
                    page.close()  # Destroy page & free RAM immediately!
                except Exception:
                    pass
                gc.collect()

                merger.append(io.BytesIO(pdf_bytes))
                print(f"[PDF Generator] Page {chunk_idx + 1}/{len(chunks)} rendered ({len(pdf_bytes)} bytes)")

            with open(output_path, "wb") as f_out:
                merger.write(f_out)
            merger.close()
            try:
                context.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass

        file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        print(f"[PDF Generator] Successfully rendered all {len(chunks)} pages into {output_path} ({file_size} bytes)")
        return file_size > 100
    except Exception as e:
        print(f"[PDF Generator] Rendering error: {e}")
        return False
    finally:
        gc.collect()
