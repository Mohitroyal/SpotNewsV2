"""
Authentic RTI Express Official Telugu Broadsheet Layout Engine & PDF Generator
FIXED DEFAULT TEMPLATE for all Daily Newspaper generation in SpotNews.

Characteristics:
- Page 1 Official Masthead:
  - Bold Purple/Magenta header with white stylized "ఆర్ ఐ పి" & yellow "తెలుగు జాతీయ దినపత్రిక"
  - "ఎక్స్‌ప్రెస్" emblem with fountain pen icon
  - Right-side "విలేకరులు కావలెను" (Wanted Reporters: 7668886666) box
  - Deep Green metadata bar (సంపుటి, సంచిక, ఎడిటర్: కొప్పలపల్లి పోతయ్య, వెల: రూ. 1/-, తేదీ)
- Inner Pages Header (Pages 2, 3, 4, etc.):
  - Black page number badge [ 2 ]
  - Purple RTI Express logo badge [ ఆర్ ఐ పి ఎక్స్‌ప్రెస్ ]
  - Royal Blue center banner [ జనరల్ న్యూస్ ]
  - Golden Yellow date pill [ శనివారం - 21 - నవంబర్ - 2026 ]
- Page 2 Editorial Section (సంపాదకీయం):
  - Yellow editorial badge [ సంపాదకీయం ✍️ ] with magenta headline banner
- NO reporter names (only location/district shown)
- NO blocking bulletin cards or stickers (full column height dedicated to news stories)
- ZERO white space: columns extend 100% from header to footer rule
- Balanced image heights & typography so NO text is ever cut off
- Clean broadsheet column rules (border-right: 1px solid #000)
- Footer with RTI Express AP publication line and authentic CMYK print registration marks
"""
import base64
import html as _html
import math
import os
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

_PDF_LOCK = threading.Lock()

def trim_memory():
    """Force GC and ask glibc to return freed arenas to the OS."""
    import gc
    gc.collect()
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass


def _log(msg: str):
    try:
        print(msg)
    except Exception:
        try:
            print(msg.encode("ascii", errors="replace").decode("ascii"))
        except Exception:
            pass


TELUGU_DAYS = {0: "ఆదివారం", 1: "సోమవారం", 2: "మంగళవారం", 3: "బుధవారం",
               4: "గురువారం", 5: "శుక్రవారం", 6: "శనివారం"}
TELUGU_MONTHS = {1: "జనవరి", 2: "ఫిబ్రవరి", 3: "మార్చి", 4: "ఏప్రిల్", 5: "మే", 6: "జూన్",
                 7: "జులై", 8: "ఆగస్టు", 9: "సెప్టెంబర్", 10: "అక్టోబర్", 11: "నవంబర్", 12: "డిసెంబర్"}


def format_telugu_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_idx = (dt.weekday() + 1) % 7
        return f"{TELUGU_DAYS.get(day_idx, '')} - {dt.day:02d} - {TELUGU_MONTHS.get(dt.month, '')} - {dt.year}"
    except Exception:
        return date_str


def sanitize_text(text: Any) -> str:
    if not text:
        return ""
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", str(text))
    return _html.escape(text.strip(), quote=True)


def _clean_image_urls(raw_urls: Any) -> List[str]:
    if not raw_urls:
        return []
    if isinstance(raw_urls, (list, tuple)):
        items = list(raw_urls)
    else:
        items = [raw_urls]
    cleaned = []
    for u in items:
        s = str(u or "").strip()
        if s and s != "null" and s != "undefined" and s != '""' and (
            s.startswith("http://") or s.startswith("https://") or s.startswith("data:") or s.startswith("/")
        ):
            cleaned.append(s)
    return cleaned


def _render_article_images(imgs: List[str], is_lead: bool = False, max_h: int = 145) -> str:
    valid = _clean_image_urls(imgs)
    if not valid:
        return ""

    if is_lead:
        if len(valid) >= 2:
            return f"""
            <div style="width: 44%; float: left; margin-right: 12px; margin-bottom: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <img src="{valid[0]}" style="width: 100%; height: 180px; object-fit: cover; background: #fafafa; border: 1.5px solid #111; padding: 1px; display: block;" alt="" />
              <img src="{valid[1]}" style="width: 100%; height: 180px; object-fit: cover; background: #fafafa; border: 1.5px solid #111; padding: 1px; display: block;" alt="" />
            </div>
            """
        return f"""
        <div style="width: 40%; float: left; margin-right: 12px; margin-bottom: 6px;">
          <img src="{valid[0]}" style="width: 100%; height: 195px; object-fit: cover; background: #fafafa; border: 1.5px solid #111; padding: 1px; display: block;" alt="" />
        </div>
        """

    # Column article
    if len(valid) >= 2:
        dual_h = min(105, round(max_h * 0.78))
        return f"""
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px; flex: 0 0 auto;">
          <img src="{valid[0]}" style="width: 100%; height: {dual_h}px; object-fit: cover; background: #fafafa; border: 1px solid #111; padding: 1px; display: block;" alt="" />
          <img src="{valid[1]}" style="width: 100%; height: {dual_h}px; object-fit: cover; background: #fafafa; border: 1px solid #111; padding: 1px; display: block;" alt="" />
        </div>
        """

    return f"""
    <div style="margin-bottom: 4px; flex: 0 0 auto;">
      <img src="{valid[0]}" style="width: 100%; max-height: {max_h}px; object-fit: cover; background: #fafafa; border: 1px solid #111; padding: 1px; display: block;" alt="" />
    </div>
    """


HEADLINE_COLORS = ["#C8102E", "#111827", "#8B0000", "#111827", "#C8102E"]

REPORTER_CARDS = [
    """
    <div class="reporter-card" style="border: 1.5px solid #C8102E; background: #FFF9F9; border-radius: 3px; padding: 4px 6px; text-align: center; margin-top: auto; margin-bottom: 2px; flex: 0 0 auto;">
      <div style="font-size: 11px; font-weight: 900; color: #C8102E; letter-spacing: 0.5px;">★ వాంటెడ్ రిపోర్టర్స్ ★</div>
      <div style="font-size: 9.5px; color: #333; line-height: 1.35; margin-top: 2px;">మీ ప్రాంతంలో RTI Express రిపోర్టర్‌గా పనిచేయుటకు సంప్రదించండి</div>
      <div style="font-size: 11.5px; font-weight: 900; color: #000; margin-top: 2px;">ఫోన్: 7668886666</div>
    </div>
    """,
    """
    <div class="reporter-card" style="border: 1.5px solid #0284c7; background: #F0F9FF; border-radius: 3px; padding: 4px 6px; text-align: center; margin-top: auto; margin-bottom: 2px; flex: 0 0 auto;">
      <div style="font-size: 11px; font-weight: 900; color: #0284c7; letter-spacing: 0.5px;">★ డిజిటల్ ఎడిషన్ • SPOT NEWS 24x7 ★</div>
      <div style="font-size: 9.5px; color: #333; line-height: 1.35; margin-top: 2px;">తాజా వార్తలు, ఈ-పేపర్ పీడీఎఫ్ కోసం ప్లే స్టోర్ లో డౌన్‌లోడ్ చేసుకోండి</div>
      <div style="font-size: 11px; font-weight: 900; color: #0369a1; margin-top: 2px;">ప్లే స్టోర్ లో లభ్యం</div>
    </div>
    """,
    """
    <div class="reporter-card" style="border: 1.5px solid #854d0e; background: #FEFCE8; border-radius: 3px; padding: 4px 6px; text-align: center; margin-top: auto; margin-bottom: 2px; flex: 0 0 auto;">
      <div style="font-size: 11px; font-weight: 900; color: #854d0e; letter-spacing: 0.5px;">★ వాణిజ్య & ప్రకటనలకు ★</div>
      <div style="font-size: 9.5px; color: #333; line-height: 1.35; margin-top: 2px;">మీ వ్యాపార ప్రకటనలు పత్రిక మరియు యాప్ లో ప్రచురించబడును</div>
      <div style="font-size: 11.5px; font-weight: 900; color: #000; margin-top: 2px;">ఫోన్: 7668886666</div>
    </div>
    """,
    """
    <div class="reporter-card" style="border: 1.5px solid #047857; background: #F0FDF4; border-radius: 3px; padding: 4px 6px; text-align: center; margin-top: auto; margin-bottom: 2px; flex: 0 0 auto;">
      <div style="font-size: 11px; font-weight: 900; color: #047857; letter-spacing: 0.5px;">★ విలేకరులు కావలెను ★</div>
      <div style="font-size: 9.5px; color: #333; line-height: 1.35; margin-top: 2px;">ఆంధ్రప్రదేశ్ & తెలంగాణ వ్యాప్తంగా మండల, నియోజకవర్గ విలేకరులు కావలెను</div>
      <div style="font-size: 11.5px; font-weight: 900; color: #000; margin-top: 2px;">సంప్రదించండి: 7668886666</div>
    </div>
    """
]


def _font_css() -> str:
    return (
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=Suranna&family=Tenali+Ramakrishna&family=Noto+Sans+Telugu:wght@400;600;700;800;900&display=swap" rel="stylesheet">'
    )


def build_newspaper_html(
    publication_name: str,
    logo_url: str,
    edition_date: str,
    articles: List[Dict[str, Any]],
    lead_story_id: Optional[str] = None,
    advertisement_config: Optional[Dict[str, Any]] = None,
    edition_info: Optional[Dict[str, Any]] = None,
    page_offset: int = 0,
    total_pages_override: Optional[int] = None,
) -> str:
    pub = sanitize_text(publication_name or "RTI Express")
    tdate = format_telugu_date(edition_date)
    info = edition_info if isinstance(edition_info, dict) else {}
    edition_no = sanitize_text(info.get("edition_no", "01"))
    issue_no = sanitize_text(info.get("issue_no", "320"))
    editor_name = sanitize_text(info.get("editor_name", "కొప్పలపల్లి పోతయ్య"))
    price = sanitize_text(info.get("price", "రూ. 1/-"))

    ordered = [dict(a) for a in (articles or [])]
    if lead_story_id:
        idx = next((i for i, a in enumerate(ordered) if str(a.get("id")) == str(lead_story_id)), -1)
        if idx > 0:
            lead_art = ordered.pop(idx)
            ordered.insert(0, lead_art)

    total_articles = len(ordered)
    # Target 12 articles per page (3 per column across 4 columns)
    num_pages = total_pages_override or max(1, round(total_articles / 12)) if total_articles > 0 else 1

    chunked_pages: List[List[Dict[str, Any]]] = []
    start_idx = 0
    for p in range(num_pages):
        rem_arts = total_articles - start_idx
        rem_pages = num_pages - p
        if rem_pages <= 0:
            break
        count_for_page = math.ceil(rem_arts / rem_pages)
        sl = ordered[start_idx : start_idx + count_for_page]
        if sl:
            chunked_pages.append(sl)
            start_idx += len(sl)

    if not chunked_pages and ordered:
        chunked_pages.append(ordered)
    elif not chunked_pages:
        chunked_pages.append([])

    target_pages = len(chunked_pages)

    def masthead_block(pages_cnt: int) -> str:
        return f"""
        <!-- Top Header: Purple RTI Express Masthead Banner -->
        <div style="background: linear-gradient(135deg, #701050 0%, #881260 50%, #680e46 100%); border: 2px solid #000; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; border-radius: 3px;">
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <div style="font-size: 46px; font-weight: 900; color: #ffffff; line-height: 0.95; letter-spacing: -1px; font-family: 'Arial Black', Impact, sans-serif; text-shadow: 2px 2px 0px #f59e0b, 3px 3px 0px #000;">
                ఆర్ ఐ పి
              </div>
              <div style="background: #fbbf24; color: #701050; font-size: 18px; font-weight: 900; padding: 2px 10px; border-radius: 3px; border: 1.5px solid #000; display: inline-flex; align-items: center; gap: 4px;">
                <span>ఎక్స్‌ప్రెస్</span>
                <span style="font-size: 15px;">✒️</span>
              </div>
            </div>
            <div style="color: #fbbf24; font-size: 12.5px; font-weight: 900; letter-spacing: 1px; margin-top: 3px;">
              తెలుగు జాతీయ దినపత్రిక
            </div>
          </div>

          <!-- Wanted Reporters Badge -->
          <div style="background: #0f172a; border: 1.5px solid #fbbf24; padding: 5px 12px; border-radius: 4px; text-align: center; color: #ffffff;">
            <div style="font-size: 12px; font-weight: 900; color: #fbbf24; text-transform: uppercase;">
              విలేకరులు కావలెను
            </div>
            <div style="font-size: 9.5px; color: #e2e8f0; margin-top: 1px;">
              ఆంధ్రప్రదేశ్ & తెలంగాణ
            </div>
            <div style="font-size: 13px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; margin-top: 2px;">
              7668886666
            </div>
          </div>
        </div>

        <!-- Green Meta Sub-Strip -->
        <div style="background: #047857; border-top: 1.5px solid #000; border-bottom: 2px solid #000; color: #ffffff; padding: 4px 10px; font-weight: 900; font-size: 11px; display: flex; justify-content: space-between; align-items: center; margin-top: 2px; margin-bottom: 4px;">
          <div><strong>సంపుటి:</strong> {edition_no} &nbsp;|&nbsp; <strong>సంచిక:</strong> {issue_no} &nbsp;|&nbsp; <strong>ఎడిటర్:</strong> {editor_name}</div>
          <div><strong>పేజీలు:</strong> {pages_cnt} &nbsp;|&nbsp; <strong>వెల:</strong> {price}</div>
          <div style="color: #fef08a;">{tdate}</div>
        </div>
        """

    pages_html: List[str] = []
    global_idx = 0

    for page_idx, page_articles in enumerate(chunked_pages):
        page_num = page_offset + page_idx + 1
        is_first_page = (page_num == 1)

        # Header
        if is_first_page:
            header_html = masthead_block(target_pages)
        elif page_num % 2 == 0:
            header_html = f"""
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="background: #000000; color: #ffffff; font-size: 16px; font-weight: 900; padding: 2px 10px; border-radius: 2px; line-height: 1.2;">
                  {page_num}
                </div>
                <div style="background: #7c1264; color: #ffffff; font-size: 12px; font-weight: 900; padding: 3px 10px; border-radius: 2px; border: 1px solid #000;">
                  ఆర్ ఐ పి ఎక్స్‌ప్రెస్
                </div>
              </div>
              <div style="background: #0284c7; color: #ffffff; font-size: 14.5px; font-weight: 900; padding: 3px 28px; border-radius: 2px; letter-spacing: 1px; border: 1px solid #000;">
                జనరల్ న్యూస్
              </div>
              <div style="background: #facc15; color: #000000; font-size: 12px; font-weight: 900; padding: 3px 14px; border-radius: 2px; border: 1px solid #000;">
                {tdate}
              </div>
            </div>
            """
        else:
            header_html = f"""
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
              <div style="background: #0284c7; color: #ffffff; font-size: 14.5px; font-weight: 900; padding: 3px 28px; border-radius: 2px; letter-spacing: 1px; border: 1px solid #000;">
                జనరల్ న్యూస్
              </div>
              <div style="background: #facc15; color: #000000; font-size: 12px; font-weight: 900; padding: 3px 14px; border-radius: 2px; border: 1px solid #000;">
                {tdate}
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="background: #7c1264; color: #ffffff; font-size: 12px; font-weight: 900; padding: 3px 10px; border-radius: 2px; border: 1px solid #000;">
                  ఆర్ ఐ పి ఎక్స్‌ప్రెస్
                </div>
                <div style="background: #000000; color: #ffffff; font-size: 16px; font-weight: 900; padding: 2px 10px; border-radius: 2px; line-height: 1.2;">
                  {page_num}
                </div>
              </div>
            </div>
            """

        page_content_html = ""

        if is_first_page and page_articles:
            lead_art = page_articles[0]
            lead_headline = sanitize_text(lead_art.get("headline") or lead_art.get("title") or "ముఖ్యాంశం")
            lead_content = sanitize_text(lead_art.get("content") or lead_art.get("article_content") or lead_art.get("summary") or "")
            lead_loc = sanitize_text(lead_art.get("location") or lead_art.get("district") or "")
            lead_raw_imgs = lead_art.get("image_urls") or lead_art.get("image_url")
            lead_imgs = _clean_image_urls(lead_raw_imgs)

            lead_color = HEADLINE_COLORS[0]
            global_idx += 1

            lead_byline_html = f'<div style="font-size: 10.5px; font-weight: bold; color: #4B5563; margin-bottom: 3px; padding-bottom: 2px; border-bottom: 1px solid #e5e7eb;">{lead_loc}</div>' if lead_loc else ""
            lead_img_html = _render_article_images(lead_imgs, True, 195)

            lead_story_html = f"""
            <div class="lead-story-card" style="border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 4px; flex: 0 0 auto;">
              <h1 style="font-size: 22px; font-weight: 900; color: {lead_color}; line-height: 1.25; margin-bottom: 3px;">
                {lead_headline}
              </h1>
              {lead_byline_html}
              <div style="font-size: 12px; line-height: 1.5; text-align: justify; color: #111;">
                {lead_img_html}
                <p style="margin: 0; text-indent: 14px;">{lead_content}</p>
              </div>
              <div style="clear: both;"></div>
            </div>
            """

            sec_articles = page_articles[1:]
            cols: List[List[Dict[str, Any]]] = [[], [], [], []]
            for idx, art in enumerate(sec_articles):
                cols[idx % 4].append(art)

            cols_html: List[str] = []
            for col_idx, col_articles in enumerate(cols):
                border_style = "border-right: 1px solid #000;" if col_idx < 3 else ""
                article_count = len(col_articles)

                max_img_h = 165 if article_count <= 2 else (140 if article_count == 3 else 115)
                head_font_size = "16.5px" if article_count <= 2 else ("15px" if article_count == 3 else "14px")
                body_font_size = "12.5px" if article_count <= 2 else ("11.8px" if article_count == 3 else "11px")
                body_line_height = "1.55" if article_count <= 2 else ("1.48" if article_count == 3 else "1.42")

                items_html = []
                for item_idx, s_art in enumerate(col_articles):
                    s_head = sanitize_text(s_art.get("headline") or s_art.get("title") or "ముఖ్యాంశం")
                    s_cont = sanitize_text(s_art.get("content") or s_art.get("article_content") or s_art.get("summary") or "")
                    s_loc = sanitize_text(s_art.get("location") or s_art.get("district") or "")
                    s_raw_imgs = s_art.get("image_urls") or s_art.get("image_url")
                    s_imgs = _clean_image_urls(s_raw_imgs)

                    s_color = HEADLINE_COLORS[global_idx % len(HEADLINE_COLORS)]
                    global_idx += 1

                    s_byline_html = f'<div style="font-size: 10px; font-weight: bold; color: #6b7280; margin-bottom: 2px;">{s_loc}</div>' if s_loc else ""
                    s_img_html = _render_article_images(s_imgs, False, max_img_h)

                    item_border = "border-bottom: 1.5px solid #222; padding-bottom: 6px; margin-bottom: 6px;"

                    items_html.append(f"""
                    <div class="news-item" style="{item_border} flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; justify-content: flex-start;">
                      <h2 style="font-size: {head_font_size}; font-weight: 900; color: {s_color}; line-height: 1.25; margin-bottom: 2px; flex: 0 0 auto;">
                        {s_head}
                      </h2>
                      {s_byline_html}
                      {s_img_html}
                      <div class="story-body" style="font-size: {body_font_size}; line-height: {body_line_height}; text-align: justify; color: #111; flex: 1 1 auto; min-height: 0; overflow: hidden;">
                        <p style="margin: 0; text-indent: 10px;">{s_cont}</p>
                      </div>
                    </div>
                    """)

                card_snippet = REPORTER_CARDS[col_idx % len(REPORTER_CARDS)]

                cols_html.append(f"""
                <div class="news-column" style="flex: 1 1 0; min-width: 0; padding: 0 6px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; {border_style}">
                  {''.join(items_html)}
                  {card_snippet}
                </div>
                """)

            page_content_html = f"""
            <div style="flex: 1 1 0; display: flex; flex-direction: column; min-height: 0; width: 100%;">
              {lead_story_html}
              <div class="columns-container" style="flex: 1 1 0; display: flex; min-height: 0; width: 100%;">
                {''.join(cols_html)}
              </div>
              <div style="flex: 0 0 auto; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; background: #fafafa; padding: 3px 6px; margin-top: 3px; font-size: 10.5px; font-weight: bold; color: #C8102E; display: flex; justify-content: space-between; align-items: center;">
                <span>★ మీ ప్రాంత వార్తలు, ప్రకటనల కోసం సంప్రదించండి: 7668886666</span>
                <span style="color: #0A2540;">★ గూగుల్ ప్లే స్టోర్ లో Spot News 24x7 యాప్ ఉచితంగా డౌన్‌లోడ్ చేసుకోండి</span>
                <span>★ RNI NO: APTEL/2026/SPOT</span>
              </div>
            </div>
            """
        else:
            cols: List[List[Dict[str, Any]]] = [[], [], [], []]
            for idx, art in enumerate(page_articles):
                cols[idx % 4].append(art)

            cols_html: List[str] = []
            for col_idx, col_articles in enumerate(cols):
                border_style = "border-right: 1px solid #000;" if col_idx < 3 else ""
                article_count = len(col_articles)
                is_page2_editorial_col = (page_num == 2 and col_idx == 0)

                max_img_h = 175 if article_count <= 2 else (145 if article_count == 3 else 120)
                head_font_size = "17px" if article_count <= 2 else ("15.5px" if article_count == 3 else "14px")
                body_font_size = "12.5px" if article_count <= 2 else ("11.8px" if article_count == 3 else "11px")
                body_line_height = "1.55" if article_count <= 2 else ("1.48" if article_count == 3 else "1.42")

                col_top_header_html = ""
                if is_page2_editorial_col:
                    col_top_header_html = """
                    <div style="background: #facc15; border: 1.5px solid #000; color: #000; font-size: 13.5px; font-weight: 900; padding: 3px 6px; text-align: center; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 6px; flex: 0 0 auto;">
                      <span>సంపాదకీయం</span> <span>✍️</span>
                    </div>
                    """

                items_html = []
                for item_idx, art in enumerate(col_articles):
                    head = sanitize_text(art.get("headline") or art.get("title") or "ముఖ్యాంశం")
                    cont = sanitize_text(art.get("content") or art.get("article_content") or art.get("summary") or "")
                    loc = sanitize_text(art.get("location") or art.get("district") or "")
                    raw_imgs = art.get("image_urls") or art.get("image_url")
                    imgs = _clean_image_urls(raw_imgs)

                    color = HEADLINE_COLORS[global_idx % len(HEADLINE_COLORS)]
                    global_idx += 1

                    byline_html = f'<div style="font-size: 10px; font-weight: bold; color: #6b7280; margin-bottom: 2px;">{loc}</div>' if loc else ""
                    img_html = _render_article_images(imgs, False, max_img_h)

                    item_head_html = f"""
                    <h2 style="font-size: {head_font_size}; font-weight: 900; color: {color}; line-height: 1.25; margin-bottom: 2px; flex: 0 0 auto;">
                      {head}
                    </h2>
                    """
                    if is_page2_editorial_col and item_idx == 0:
                        item_head_html = f"""
                        <div style="background: #e11d48; color: #ffffff; font-size: 13px; font-weight: 900; padding: 3px 8px; margin-bottom: 4px; border-radius: 2px; flex: 0 0 auto;">
                          ▶ {head}
                        </div>
                        """

                    is_last_item = (item_idx == len(col_articles) - 1)
                    item_border = "border-bottom: 1.5px solid #222; padding-bottom: 6px; margin-bottom: 6px;"

                    items_html.append(f"""
                    <div class="news-item" style="{item_border} flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; justify-content: flex-start;">
                      {item_head_html}
                      {byline_html}
                      {img_html}
                      <div class="story-body" style="font-size: {body_font_size}; line-height: {body_line_height}; text-align: justify; color: #111; flex: 1 1 auto; min-height: 0; overflow: hidden;">
                        <p style="margin: 0; text-indent: 10px;">{cont}</p>
                      </div>
                    </div>
                    """)

                card_snippet = REPORTER_CARDS[col_idx % len(REPORTER_CARDS)]

                cols_html.append(f"""
                <div class="news-column" style="flex: 1 1 0; min-width: 0; padding: 0 6px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; {border_style}">
                  {col_top_header_html}
                  {''.join(items_html)}
                  {card_snippet}
                </div>
                """)

            page_content_html = f"""
            <div class="columns-container" style="flex: 1 1 0; display: flex; min-height: 0; width: 100%;">
              {''.join(cols_html)}
            </div>
            """

        page_footer = f"""
        <div class="footer-section" style="flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #000; padding-top: 3px; font-size: 10.5px; color: #333; margin-top: 3px; z-index: 20; background: #ffffff;">
          <div><strong>RTI Express AP</strong> &nbsp;|&nbsp; {sanitize_text(edition_date)} &nbsp;|&nbsp; తెలుగు దినపత్రిక</div>
          <!-- CMYK Print Marks -->
          <div style="display: flex; gap: 3px; align-items: center;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #00FFFF;"></span>
            <span style="display: inline-block; width: 8px; height: 8px; background: #FF00FF;"></span>
            <span style="display: inline-block; width: 8px; height: 8px; background: #FFFF00;"></span>
            <span style="display: inline-block; width: 8px; height: 8px; background: #000000;"></span>
          </div>
          <div style="font-weight: bold; font-size: 11px;">Page {page_num}</div>
        </div>
        """

        is_last_page = (page_idx == len(chunked_pages) - 1)
        page_break_style = "" if is_last_page else "page-break-after: always; break-after: page;"

        page_html = f"""
        <div id="page-{page_num}" class="pdf-page" style="width: 297mm; height: 420mm; max-height: 420mm; padding: 7mm 8mm; background: #ffffff; margin: 0 auto; box-sizing: border-box; position: relative; display: flex; flex-direction: column; overflow: hidden; page-break-inside: avoid; break-inside: avoid; {page_break_style}">
          <div class="header-section" style="flex: 0 0 auto;">
            {header_html}
          </div>
          {page_content_html}
          {page_footer}
        </div>
        """
        pages_html.append(page_html)

    return f"""<!DOCTYPE html>
<html lang="te">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1122, initial-scale=1.0">
  <title>{pub} - {sanitize_text(edition_date)}</title>
  {_font_css()}
  <style>
    @page {{
      size: A3 portrait;
      margin: 0;
    }}
    * {{
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    html, body {{
      margin: 0;
      padding: 0;
      background: #e5e7eb;
      font-family: 'Noto Sans Telugu', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #000000;
      -webkit-font-smoothing: antialiased;
    }}
    .pdf-page {{
      width: 297mm;
      height: 420mm;
      max-height: 420mm;
      padding: 7mm 8mm;
      background: #ffffff;
      margin: 0 auto 15px auto;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    h1, h2, h3, h4, p {{
      margin-top: 0;
    }}
    .news-item {{
      word-wrap: break-word;
      overflow-wrap: break-word;
    }}
    @media print {{
      body {{
        background: transparent;
      }}
      .pdf-page {{
        margin: 0;
        box-shadow: none;
      }}
    }}
  </style>
</head>
<body>
  {chr(10).join(pages_html)}
</body>
</html>"""


# --------------------------------------------------------------------------- Chromium helpers

def _get_chromium_executable() -> Optional[str]:
    import glob
    browsers_path = os.getenv("PLAYWRIGHT_BROWSERS_PATH")
    if not browsers_path:
        if os.path.isdir("/opt/render/project/.playwright"):
            browsers_path = "/opt/render/project/.playwright"
        else:
            return None
    for pattern in (
        "chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell",
        "chromium-*/chrome-linux/chrome",
        "chromium-*/chrome-linux/chromium",
        "chromium-*/chrome",
        "chromium-*/chrome-win/chrome.exe",
        "chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"
    ):
        matches = glob.glob(os.path.join(browsers_path, pattern))
        if matches:
            return matches[0]
    return None


def _launch_kwargs() -> Dict[str, Any]:
    kw = {"headless": True, "args": [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
        "--disable-software-rasterizer", "--no-zygote", "--renderer-process-limit=1",
        "--js-flags=--max-old-space-size=64", "--disk-cache-size=1", "--media-cache-size=1",
        "--disable-site-isolation-trials",
        "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,Translate,OptimizationHints,BackForwardCache,MediaRouter",
        "--disable-extensions", "--disable-background-networking", "--disable-default-apps",
        "--disable-sync", "--disable-translate", "--mute-audio"]}
    path = _get_chromium_executable()
    if path:
        kw["executable_path"] = path
    return kw


def _wait_assets(page, img_timeout_ms: int = 15000):
    try:
        page.wait_for_function("document.fonts.status === 'loaded'", timeout=10000)
    except Exception:
        pass
    try:
        page.wait_for_function(
            "Array.from(document.images).every(i => i.complete)", timeout=img_timeout_ms)
    except Exception:
        pass


def _print_pdf(page, path: str):
    page.pdf(
        path=path,
        width="297mm",
        height="420mm",
        print_background=True,
        prefer_css_page_size=True,
        display_header_footer=False,
        margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
    )


# --------------------------------------------------------------------------- public API

def render_html_to_pdf(html_content: str, output_path: str) -> bool:
    """Render HTML from build_newspaper_html to an A3 PDF."""
    if not _PDF_LOCK.acquire(timeout=180):
        _log("[PDF Generator] Another PDF generation is active.")
        return False
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(**_launch_kwargs())
            ctx = browser.new_context(viewport={"width": 1123, "height": 1588}, device_scale_factor=1)
            page = ctx.new_page()
            page.set_content(html_content, wait_until="load", timeout=60000)
            _wait_assets(page)
            _print_pdf(page, output_path)
            ctx.close()
            browser.close()

        size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        _log(f"[PDF Generator] PDF written: {output_path} ({size} bytes)")
        return size > 100
    except Exception as e:
        _log(f"[PDF Generator] Rendering error: {e}")
        return False
    finally:
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
    max_articles_per_chunk: int = 12,
) -> bool:
    html = build_newspaper_html(
        publication_name=publication_name,
        logo_url=logo_url,
        edition_date=edition_date,
        articles=articles,
        lead_story_id=lead_story_id,
        advertisement_config=advertisement_config,
        edition_info=edition_info
    )
    return render_html_to_pdf(html, output_path)
