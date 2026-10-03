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
    articles: list,
    lead_story_id=None,
    advertisement_config=None,
    edition_info=None
) -> str:
    telugu_date_formatted = format_telugu_date(edition_date)
    
    html_parts = []
    html_parts.append("""<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <title>""" + sanitize_text(publication_name) + """ - """ + edition_date + """</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@700;900&family=Noto+Serif+Devanagari:wght@400;700&family=Noto+Serif+Telugu:wght@400;700&display=swap" rel="stylesheet">
    <style>""" + """
        /* ─── DESIGN TOKENS ─────────────────────────────────────── */
        :root {
            --bg:         #FFFFFF;
            --paper:      #FFFFFF;
            --ink:        #000000;
            --accent:     #0a192f;
            --gold:       #b38f32;
            --rule:       #0a192f;
            --muted:      #475569;
            --divider:    #cbd5e1;
            --col-gap:    22px;
            --container-w: 1060px;
            --container-pad: 34px;
        }

        /* ─── RESET ─────────────────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background: var(--bg);
            color: var(--ink);
            font-family: 'Old Standard TT', serif;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
        }

        /* ─── NEWSPAPER CONTAINER ───────────────────────────────── */
        .newspaper-container {
            width: var(--container-w);
            background: var(--paper);
            border: 2px solid #CFE8FF;
            box-shadow: 0 10px 40px rgba(10,25,47,0.08);
            padding: var(--container-pad);
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        /* ─── MASTHEAD / HEADER ─────────────────────────────────── */
        .header-section {
            width: 100%;
            text-align: center;
            margin-bottom: 10px;
        }
        .header-section svg {
            width: 100%;
            height: auto;
            max-height: 120px;
            display: block;
        }

        /* ─── META BAR ──────────────────────────────────────────── */
        .meta-bar {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            gap: 3px;
            border-top: 1.5px solid var(--rule);
            border-bottom: 1.5px solid var(--rule);
            padding: 5px 12px;
            font-family: 'Cinzel', serif;
            font-size: 11.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.6px;
            color: var(--accent);
            margin-bottom: 0;
        }

        /* ─── HEADLINE BLOCK ────────────────────────────────────── */
        .headline-block, .headline-section {
            text-align: center;
            margin: 22px 0 14px !important;
            background-color: #FFF4CC !important;
            padding: 15px !important;
            border: 2px solid #D60000 !important;
            border-left: 2px solid #D60000 !important; /* override injected left-border */
        }
        .headline {
            font-family: 'Playfair Display', serif;
            font-size: 50px;
            font-weight: 900;
            line-height: 1.12;
            letter-spacing: -1px;
            color: #111111;
            display: block;
        }

        /* ─── SUBHEADLINE ───────────────────────────────────────── */
        .subheadline-block {
            text-align: center;
            border-bottom: 0.5px solid var(--divider);
            padding-bottom: 14px;
            margin-bottom: 18px;
        }
        .subheadline {
            font-family: 'Old Standard TT', serif;
            font-size: 18px;
            font-style: italic;
            color: var(--muted);
            line-height: 1.45;
        }

        /* ═══════════════════════════════════════════════════════════
           TOP SECTION: 65% hero image | 35% article text
           ─ Pure CSS grid. No absolute positioning. No overlap.
           ═══════════════════════════════════════════════════════════ */
        .top-section {
            display: grid;
            grid-template-columns: 65% 35%;
            gap: var(--col-gap);
            margin-bottom: 20px;
        }

        /* Hero image column */
        .hero-col {
            /* 65% of container width */
        }
        .hero-image-frame {
            border: 1px solid var(--divider);
            padding: 5px;
            width: 100%;
            height: 380px;          /* fixed slot height */
        }
        .hero-image-frame img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            filter: sepia(25%) grayscale(15%) contrast(103%);
        }
        .hero-caption {
            font-size: 12px;
            font-style: italic;
            color: var(--muted);
            margin-top: 7px;
            line-height: 1.4;
            text-align: center;
        }

        /* Right text column */
        .right-text-col {
            /* 35% of container width */
            overflow: hidden;       /* text NEVER spills outside */
        }
        .byline-bar {
            font-family: 'Cinzel', serif;
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.3px;
            color: var(--accent);
            border-bottom: 0.5px solid var(--divider);
            padding-bottom: 4px;
            margin-bottom: 11px;
        }
        .right-text-col .paragraph {
            font-size: 14.5px;
            line-height: 1.62;
            color: #1e293b;
            margin-bottom: 14px;
            text-align: justify;
            text-indent: 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .right-text-col .paragraph.has-dropcap::first-letter {
            float: left;
            font-family: 'Cinzel', 'Playfair Display', serif;
            font-size: 52px;
            line-height: 40px;
            padding-top: 3px;
            padding-right: 5px;
            font-weight: 900;
            color: var(--accent);
        }
        .dateline { font-weight: 700; }

        /* ═══════════════════════════════════════════════════════════
           MIDDLE SECTION: Diagonal secondary images in fixed slots
           Slots A-D are predefined. No JS movement allowed.
           ═══════════════════════════════════════════════════════════ */
        .middle-section {
            margin-bottom: 20px;
        }
        .middle-section-label {
            font-family: 'Cinzel', serif;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--gold);
            border-top: 1px solid var(--gold);
            border-bottom: 1px solid var(--gold);
            padding: 4px 0;
            margin-bottom: 14px;
            text-align: center;
        }

        /*
         * The diagonal gallery uses a container with a fixed height
         * and position:relative. Each slot is position:absolute with
         * FIXED left/top coordinates — no dynamic calculation.
         * Slot widths are fixed percentages. Height is fixed px.
         */
        .diagonal-gallery {
            position: relative;
            width: 100%;
            height: 740px;          /* tall enough to contain all 4 slots */
            overflow: visible;
        }

        /* SLOT DEFINITIONS — fixed, never recalculated */
        .slot {
            position: absolute;
            width: 28%;             /* each image tile width */
        }

        /* Slot A: top-left */
        .slot-a {
            left: 0%;
            top: 0px;
        }
        /* Slot B: shifted right + down */
        .slot-b {
            left: 15%;
            top: 180px;
        }
        /* Slot C: further right + down */
        .slot-c {
            left: 30%;
            top: 360px;
        }
        /* Slot D: furthest right + down */
        .slot-d {
            left: 45%;
            top: 540px;
        }

        .slot-frame {
            border: 1px solid var(--divider);
            padding: 5px;
            background: var(--paper);
        }
        .slot-frame img {
            width: 100%;
            height: 160px;
            object-fit: cover;
            display: block;
            filter: sepia(25%) grayscale(15%) contrast(103%);
        }
        .slot-caption {
            font-size: 11px;
            font-style: italic;
            color: var(--muted);
            margin-top: 5px;
            line-height: 1.35;
            text-align: center;
        }

        /* ═══════════════════════════════════════════════════════════
           BOTTOM TEXT SECTION: 3-column newspaper text flow
           Text is in independent container blocks, never wrapping
           around irregular image boundaries.
           ═══════════════════════════════════════════════════════════ */
        .bottom-text-section {
            margin-top: 16px;
            border-top: 1.5px solid var(--rule);
            padding-top: 16px;
        }
        .article-content {
            columns: 3;
            column-gap: var(--col-gap);
            column-rule: 0.5px solid var(--divider);
            text-align: justify;
            font-size: 14.5px;
            line-height: 1.62;
            color: #1e293b;
        }
        .article-content .paragraph {
            margin-top: 0;
            margin-bottom: 14px;
            text-indent: 17px;
            break-inside: avoid;
        }
        .article-content .paragraph:first-of-type {
            text-indent: 0;
        }
        .article-content .paragraph.has-dropcap::first-letter {
            float: left;
            font-family: 'Cinzel', 'Playfair Display', serif;
            font-size: 52px;
            line-height: 40px;
            padding-top: 3px;
            padding-right: 5px;
            font-weight: 900;
            color: var(--accent);
        }

        /* ─── FOOTER ────────────────────────────────────────────── */
        .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1.5px solid var(--rule);
            padding-top: 10px;
            margin-top: 24px;
            font-family: 'Cinzel', serif;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #64748b;
        }
    
        @media print {
            @page { size: auto; margin: 0; }
            body { background: #fff !important; }
            .newspaper-container { border: none !important; box-shadow: none !important; }
        }
        .newspaper-container { page-break-after: always; page-break-inside: avoid; margin-bottom: 0; border: none; box-shadow: none; }
""" + """</style>
</head>
<body>
""")

    for page_num, art in enumerate(articles, 1):
        headline = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
        subheadline = sanitize_text(art.get("subheadline") or "")
        content = sanitize_text(art.get("content") or art.get("summary") or "")
        reporter = sanitize_text(art.get("reporter_name") or art.get("byline") or "Special Correspondent")
        loc = sanitize_text(art.get("location") or art.get("district") or "Hyderabad")
        
        imgs = art.get("image_urls") or []
        if not imgs and art.get("image_url"):
            imgs = [art.get("image_url")]
            
        hero_img = imgs[0] if imgs else "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80"
        
        slot_imgs = []
        for i in range(1, 5):
            if len(imgs) > i:
                slot_imgs.append(imgs[i])
            else:
                slot_imgs.append("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80") # default fallback
        
        # Splitting content into paragraphs for the multi-column text flow
        paragraphs = [p.strip() for p in content.split('
') if p.strip()]
        if not paragraphs:
            paragraphs = ["Coverage of this developing story..."]
            
        # Top right text
        top_text_html = ""
        bottom_text_html = ""
        
        if len(paragraphs) > 0:
            top_text_html += f'<p class="paragraph has-dropcap"><span class="dateline">{loc} —</span> {paragraphs[0]}</p>'
        if len(paragraphs) > 1:
            top_text_html += f'<p class="paragraph">{paragraphs[1]}</p>'
        if len(paragraphs) > 2:
            top_text_html += f'<p class="paragraph">{paragraphs[2]}</p>'
            
        # Rest goes to bottom text section
        for p in paragraphs[3:]:
            bottom_text_html += f'<p class="paragraph">{p}</p>'
            
        if not bottom_text_html:
            bottom_text_html = f'<p class="paragraph has-dropcap">Further updates will be reported as the situation develops.</p>'
            
        html_parts.append(f"""
<div class="newspaper-container">
    <!-- ── HEADER / MASTHEAD ─────────────────────────────────── -->
    <header class="header-section" style="padding: 10px 0; background: #fff;">
        <img src="{logo_url}" alt="Logo" style="max-height: 120px; object-fit: contain; width: auto;" />
    </header>

    <!-- ── META BAR ──────────────────────────────────────────── -->
    <div class="meta-bar">
        <span>{sanitize_text(publication_name)} &mdash; {telugu_date_formatted}</span>
        <span>Page {page_num} of {len(articles)}</span>
    </div>

    <!-- ── HEADLINE ──────────────────────────────────────────── -->
    <div class="headline-block">
        <h1 class="headline">{headline}</h1>
    </div>

    <!-- ── SUBHEADLINE ───────────────────────────────────────── -->
    <div class="subheadline-block">
        <h2 class="subheadline">{subheadline}</h2>
    </div>

    <div class="top-section">
        <div class="hero-col">
            <div class="hero-image-frame">
                <img id="hero-img" src="{hero_img}" alt="Hero" loading="eager">
            </div>
            <p class="hero-caption">Photo from the scene <em>(Photo: {reporter})</em></p>
        </div>
        <div class="right-text-col">
            <div class="byline-bar">By {reporter} &nbsp;|&nbsp; {loc}</div>
            {top_text_html}
        </div>
    </div>

    <div class="middle-section">
        <div class="middle-section-label">&#9670; Developing Story — Photo Gallery &#9670;</div>
        <div class="diagonal-gallery" id="diagonal-gallery">
            <div class="slot slot-a">
                <div class="slot-frame">
                    <img src="{slot_imgs[0]}" alt="Slot A" loading="eager">
                </div>
            </div>
            <div class="slot slot-b">
                <div class="slot-frame">
                    <img src="{slot_imgs[1]}" alt="Slot B" loading="eager">
                </div>
            </div>
            <div class="slot slot-c">
                <div class="slot-frame">
                    <img src="{slot_imgs[2]}" alt="Slot C" loading="eager">
                </div>
            </div>
            <div class="slot slot-d">
                <div class="slot-frame">
                    <img src="{slot_imgs[3]}" alt="Slot D" loading="eager">
                </div>
            </div>
        </div>
    </div>

    <div class="bottom-text-section">
        <div class="article-content">
            {bottom_text_html}
        </div>
    </div>

    <footer class="footer-section">
        <div>Page {page_num} &bull; {sanitize_text(publication_name)}</div>
        <div>&copy; 2026 {sanitize_text(publication_name)}</div>
    </footer>
</div>
""")

    html_parts.append("""
<script>
window.__LAYOUT_DONE__ = true;
</script>
</body>
</html>
""")
    return "".join(html_parts)

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
