import os
import re
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional

_PDF_LOCK = threading.Lock()

def trim_memory():
    """Forces Python garbage collection and instructs Linux glibc to release unused memory arenas back to the OS."""
    import gc
    gc.collect()
    try:
        import ctypes
        libc = ctypes.CDLL("libc.so.6")
        libc.malloc_trim(0)
    except Exception:
        pass

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

def optimize_image_url(url: Optional[str], max_width: int = 350, quality: int = 65) -> str:
    """
    Supabase Storage on-the-fly image optimization:
    Converts raw 12MP (4000x3000) camera photos into compact ~350px thumbnails.
    Cuts image memory from 48MB per bitmap down to <0.3MB per bitmap in Chromium!
    """
    if not url:
        return ""
    clean_url = str(url).strip()
    if "/storage/v1/object/public/" in clean_url:
        return clean_url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + f"?width={max_width}&resize=contain&quality={quality}"
    if "/storage/v1/object/sign/" in clean_url:
        return clean_url.replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/") + f"&width={max_width}&resize=contain&quality={quality}"
    return clean_url

def estimate_article_card_height(art: Dict[str, Any], is_lead: bool = False) -> float:
    head = art.get("headline") or art.get("title") or ""
    cont = art.get("content") or art.get("summary") or ""
    imgs = art.get("image_urls") or []
    if not imgs and art.get("image_url"):
        imgs = [art.get("image_url")]

    h_head = 45 if is_lead else 36
    h_byline = 18
    if len(imgs) >= 2:
        h_img = 150 if is_lead else 115
    elif len(imgs) == 1:
        h_img = 170 if is_lead else 125
    else:
        h_img = 0
    h_text = max(30, len(cont) / 3.2)
    return h_head + h_byline + h_img + h_text + 14

def render_article_card_html(art: Dict[str, Any], is_lead: bool = False) -> str:
    head = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
    cont = sanitize_text(art.get("content") or art.get("summary") or "")
    rep = sanitize_text(art.get("reporter_name") or art.get("byline") or "")
    loc = sanitize_text(art.get("location") or art.get("district") or "")
    imgs = art.get("image_urls") or []
    if not imgs and art.get("image_url"):
        imgs = [art.get("image_url")]

    byline = f"{loc} &nbsp;|&nbsp; {rep}" if loc and rep else (loc or rep)
    byline_html = f'<div style="font-size: 9.5px; font-weight: bold; color: #555; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px solid #eee;">{byline}</div>' if byline else ''

    banner_fs = "22px" if is_lead else "14px"
    banner_pad = "6px 8px" if is_lead else "3.5px 6px"
    headline_html = f"""
    <div style="background-color: #CC2222; border: 1.5px solid #CC2222; border-radius: 2px; text-align: center; padding: {banner_pad}; margin-bottom: 3px; box-sizing: border-box;">
        <h2 style="font-size: {banner_fs}; font-weight: 800; line-height: 1.2; color: #FFFFFF; margin: 0;">{head}</h2>
    </div>
    """

    font_size = "11.5px" if len(cont) < 250 else ("11px" if len(cont) < 650 else "10.2px")
    line_height = "1.44" if len(cont) < 250 else ("1.38" if len(cont) < 650 else "1.32")

    # Complete uncropped images with object-fit: contain so 100% of the image is shown without half/cropped images!
    if len(imgs) >= 2:
        img_max_h = "150px" if is_lead else "105px"
        opt1 = optimize_image_url(imgs[0], max_width=400, quality=65)
        opt2 = optimize_image_url(imgs[1], max_width=400, quality=65)
        img_block = f"""
        <div style="margin-bottom: 3px; width: 100%;">
            <div style="display: flex; gap: 5px; justify-content: center; align-items: center;">
                <div style="flex: 1; text-align: center; min-width: 0;">
                    <img src="{opt1}" style="max-width: 100%; max-height: {img_max_h}; width: auto; height: auto; object-fit: contain; border: 1px solid #ccc; padding: 1px; display: inline-block; vertical-align: middle;" />
                    <div style="font-size: 8px; color: #555; font-style: italic; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">కార్యక్రమానికి సంబంధించిన ముఖ్య చిత్రం.</div>
                </div>
                <div style="flex: 1; text-align: center; min-width: 0;">
                    <img src="{opt2}" style="max-width: 100%; max-height: {img_max_h}; width: auto; height: auto; object-fit: contain; border: 1px solid #ccc; padding: 1px; display: inline-block; vertical-align: middle;" />
                    <div style="font-size: 8px; color: #555; font-style: italic; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">తాజా పరిణామంపై అదనపు దృశ్యం.</div>
                </div>
            </div>
        </div>
        """
        if len(cont) > 180:
            text_block = f"""
            <div style="column-count: 2; column-gap: 8px; text-align: justify; font-size: {font_size}; line-height: {line_height}; color: #111;">
                <p style="margin: 0; text-indent: 8px;">{cont}</p>
            </div>
            """
        else:
            text_block = f"""
            <div style="text-align: justify; font-size: {font_size}; line-height: {line_height}; color: #111;">
                <p style="margin: 0; text-indent: 8px;">{cont}</p>
            </div>
            """
        body_html = f"{img_block}{text_block}"
    elif len(imgs) == 1:
        img_max_h = "180px" if is_lead else "120px"
        opt = optimize_image_url(imgs[0], max_width=400, quality=65)
        body_html = f"""
        <div style="font-size: {font_size}; line-height: {line_height}; text-align: justify; color: #111;">
            <div style="width: 46%; float: left; margin-right: 7px; margin-bottom: 2px; text-align: center;">
                <img src="{opt}" style="max-width: 100%; max-height: {img_max_h}; width: auto; height: auto; object-fit: contain; border: 1px solid #ccc; padding: 1px; display: inline-block; vertical-align: middle;" />
                <div style="font-size: 8px; color: #555; font-style: italic; margin-top: 1px;">కార్యక్రమానికి సంబంధించిన ముఖ్య చిత్రం.</div>
            </div>
            <p style="margin: 0; text-indent: 8px;">{cont}</p>
            <div style="clear: both;"></div>
        </div>
        """
    else:
        if len(cont) > 180:
            body_html = f"""
            <div style="column-count: 2; column-gap: 8px; text-align: justify; font-size: {font_size}; line-height: {line_height}; color: #111;">
                <p style="margin: 0; text-indent: 8px;">{cont}</p>
            </div>
            """
        else:
            body_html = f"""
            <div style="text-align: justify; font-size: {font_size}; line-height: {line_height}; color: #111;">
                <p style="margin: 0; text-indent: 8px;">{cont}</p>
            </div>
            """

    card_border = "border: 1px solid #d0d0d0; background: #fff; padding: 5px 7px; border-radius: 2px; box-sizing: border-box;"

    return f"""
    <div class="news-card" style="{card_border} display: block; overflow: hidden; flex: 0 0 auto;">
        {headline_html}
        {byline_html}
        {body_html}
    </div>
    """

def balance_into_two_columns(articles_list: List[Dict[str, Any]]) -> tuple:
    col_left = []
    col_right = []
    h_left = 0.0
    h_right = 0.0

    for art in articles_list:
        h = estimate_article_card_height(art, is_lead=False)
        if h_left <= h_right:
            col_left.append(art)
            h_left += h
        else:
            col_right.append(art)
            h_right += h

    cards_left = [render_article_card_html(a, is_lead=False) for a in col_left]
    cards_right = [render_article_card_html(a, is_lead=False) for a in col_right]

    return cards_left, cards_right

def partition_articles_into_pages(ordered_articles: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    total = len(ordered_articles)
    if total <= 9:
        return [ordered_articles]

    # Page 1 holds up to 9 articles (lead + 4 in each column)
    # Subsequent pages hold up to 12 articles (6 in each column)
    subsequent_pages = max(1, (total - 9 + 11) // 12)
    total_pages = 1 + subsequent_pages

    if total_pages == 2:
        p1_count = min(9, max(5, total // 2))
        return [ordered_articles[:p1_count], ordered_articles[p1_count:]]

    p1_count = min(9, max(8, (total + total_pages - 1) // total_pages))
    remaining = ordered_articles[p1_count:]
    rem_total = len(remaining)
    rem_per_page = max(1, (rem_total + subsequent_pages - 1) // subsequent_pages)

    pages = [ordered_articles[:p1_count]]
    for i in range(subsequent_pages):
        start = i * rem_per_page
        end = min(start + rem_per_page, rem_total)
        page_slice = remaining[start:end]
        if page_slice:
            pages.append(page_slice)
    return pages

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

    opt_logo_url = optimize_image_url(logo_url, max_width=250, quality=70)

    ad_html = ""
    if advertisement_config and advertisement_config.get("image_url"):
        opt_ad_url = optimize_image_url(advertisement_config['image_url'], max_width=250, quality=70)
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

    if total_pages_override == 1:
        chunked_pages = [ordered_articles]
    else:
        chunked_pages = partition_articles_into_pages(ordered_articles)

    pages_html = []

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
            sec_articles = page_articles[1:]

            if sec_articles:
                lead_story_html = f"""
                <div style="flex: 0 0 auto; margin-bottom: 6px;">
                    {render_article_card_html(lead_art, is_lead=True)}
                </div>
                """
                cards_left, cards_right = balance_into_two_columns(sec_articles)
                page_content_html = f"""
                <div style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;">
                    {lead_story_html}
                    <div class="secondary-grid" style="flex: 1 1 0; min-height: 0; display: flex; gap: 8px; align-items: stretch;">
                        <div class="newspaper-col" style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
                            {''.join(cards_left)}
                        </div>
                        <div class="newspaper-col" style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
                            {''.join(cards_right)}
                        </div>
                    </div>
                </div>
                """
            else:
                page_content_html = f"""
                <div style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;">
                    {render_article_card_html(lead_art, is_lead=True)}
                </div>
                """
        else:
            if count == 1:
                page_content_html = f"""
                <div style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;">
                    {render_article_card_html(page_articles[0], is_lead=True)}
                </div>
                """
            else:
                cards_left, cards_right = balance_into_two_columns(page_articles)
                page_content_html = f"""
                <div class="secondary-grid" style="flex: 1 1 0; min-height: 0; display: flex; gap: 8px; align-items: stretch;">
                    <div class="newspaper-col" style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
                        {''.join(cards_left)}
                    </div>
                    <div class="newspaper-col" style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
                        {''.join(cards_right)}
                    </div>
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
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&display=swap" rel="stylesheet">
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
    acquired = _PDF_LOCK.acquire(timeout=120)
    if not acquired:
        print("[PDF Generator] Concurrency lock timeout: another PDF generation is currently active.")
        return False
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
                "--js-flags=--max-old-space-size=32",
                "--disk-cache-size=1",
                "--media-cache-size=1",
                "--disable-site-isolation-trials",
                "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,Translate,OptimizationHints,BackForwardCache,MediaRouter",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-sync",
                "--disable-translate",
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
        if _PDF_LOCK.locked():
            _PDF_LOCK.release()
        trim_memory()

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
    import tempfile
    import pypdf
    from playwright.sync_api import sync_playwright

    acquired = _PDF_LOCK.acquire(timeout=120)
    if not acquired:
        print("[PDF Generator] Concurrency lock timeout: another generation is active.")
        return False

    try:
        total_articles = len(articles)
        ordered_articles = list(articles)
        if lead_story_id:
            lead_idx = next((i for i, a in enumerate(ordered_articles) if str(a.get("id")) == str(lead_story_id)), None)
            if lead_idx is not None:
                lead_item = ordered_articles.pop(lead_idx)
                ordered_articles.insert(0, lead_item)

        # For small edition (<= 9 articles, 1 page), render in single shot
        if total_articles <= 9:
            full_html = build_newspaper_html(
                publication_name=publication_name,
                logo_url=logo_url,
                edition_date=edition_date,
                articles=ordered_articles,
                lead_story_id=lead_story_id,
                advertisement_config=advertisement_config,
                edition_info=edition_info
            )
            _PDF_LOCK.release()
            return render_html_to_pdf(full_html, output_path)

        page_slices = partition_articles_into_pages(ordered_articles)
        chunks = [(p, sl) for p, sl in enumerate(page_slices)]

        print(f"[PDF Generator] Rendering {total_articles} articles across {len(chunks)} pages in low-memory batched session...")

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
                "--js-flags=--max-old-space-size=32",
                "--disk-cache-size=1",
                "--media-cache-size=1",
                "--disable-site-isolation-trials",
                "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,Translate,OptimizationHints,BackForwardCache,MediaRouter",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-sync",
                "--disable-translate",
                "--mute-audio"
            ]
        }
        if chrome_path:
            launch_kwargs["executable_path"] = chrome_path

        page_files = []
        with tempfile.TemporaryDirectory() as temp_dir:
            with sync_playwright() as p:
                BATCH_SIZE = 1  # Recycle browser every 1 page to guarantee strict <180MB RAM on Render free tier
                for batch_start in range(0, len(chunks), BATCH_SIZE):
                    batch_chunks = chunks[batch_start:batch_start + BATCH_SIZE]
                    browser = p.chromium.launch(**launch_kwargs)
                    context = browser.new_context(
                        viewport={"width": 1123, "height": 1587},
                        device_scale_factor=1
                    )

                    for chunk_idx, (page_idx, chunk_articles) in enumerate(batch_chunks, start=batch_start):
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

                        if chunk_idx == 0:
                            try:
                                page.evaluate("Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))])")
                            except Exception:
                                pass

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

                        page_pdf_path = os.path.join(temp_dir, f"chunk_{chunk_idx}.pdf")
                        page.pdf(
                            path=page_pdf_path,
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

                        page_files.append(page_pdf_path)
                        print(f"[PDF Generator] Page {chunk_idx + 1}/{len(chunks)} rendered to disk ({os.path.getsize(page_pdf_path)} bytes)")

                    try:
                        context.close()
                    except Exception:
                        pass
                    try:
                        browser.close()
                    except Exception:
                        pass
                    trim_memory()

            # Merge disk-backed PDF files cleanly into destination
            merger = pypdf.PdfWriter()
            for pf in page_files:
                merger.append(pf)

            with open(output_path, "wb") as f_out:
                merger.write(f_out)
            merger.close()
            del merger
            trim_memory()

        file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        print(f"[PDF Generator] Successfully rendered all {len(chunks)} pages into {output_path} ({file_size} bytes)")
        return file_size > 100
    except Exception as e:
        print(f"[PDF Generator] Rendering error: {e}")
        return False
    finally:
        if _PDF_LOCK.locked():
            _PDF_LOCK.release()
        trim_memory()
