"""
Daily newspaper (e-paper) generator — newspaper-style, gap-free layout.

How the layout works
--------------------
Every page has a fixed-height body area laid out as real newspaper columns
(CSS multi-column, column-fill:auto). Stories flow down column 1, then column 2,
and so on. A small JavaScript paginator, run inside Chromium, measures the real
rendered text with the real Telugu font:

  * it adds stories to a page until the columns are full;
  * the story that does not fit is SPLIT word-by-word at the exact point where
    the page ends, with "మిగతా Nవ పేజీలో" at the cut and a "…తరువాయి" header
    where it continues on the next page (how printed newspapers do it);
  * page design follows a printed Telugu daily: inner pages carry a header with page
    number, small logo, section band ("జనరల్ న్యూస్", edition_info["section_name"])
    and a date pill; every page opens with a PAGE LEAD — large centred coloured
    headline, large photo(s) (two-photo stories show both photos side by side,
    same height, with captions from image_captions) and text beside the photos;
  * below the page lead, the page is made of BLOCKS like a printed daily: each page uses a
    pattern of a wide section (stories with headline across, text in 2 columns) and a
    single-column side section, or two wide sections (patterns alternate page to page);
    a two-photo story shows both photos side by side across its block;
    some stories get a light tint box; photo captions come from image_captions;
  * every story is one continuous paragraph; headlines are bold coloured text on a light band;
  * free space (end of a page, or the bottom of a column when a headline+photo had
    to move to the next column) is filled with stickers sized to the gap:
    "రిపోర్టర్లు కావలెను / వార్తలు పంపండి / ప్రకటనల కోసం / యాప్" + contact phone
    (edition_info["stickers"], edition_info["contact_phone"]);
  * the type size is tuned per edition (5 steps around 12.7px) so the last page
    comes out full, the way an editor adjusts the paper.

Because every photo has a fixed-size frame, the layout does not depend on
image loading. That allows a two-pass render that keeps memory low:

  Pass 1 – one Chromium page with ALL stories reads each photo's real shape
           (small resized photos), runs the paginator and returns the finished
           HTML of every page. Every photo frame takes the photo's own aspect
           ratio, so the full photo is printed — nothing is cropped.
  Pass 2 – each finished page is printed to PDF on its own (images loaded),
           recycling the browser between batches, then the PDFs are merged.

Public API is unchanged:
  build_newspaper_html(...)               -> HTML (self-paginating; works as live preview)
  render_html_to_pdf(html, output_path)   -> bool
  generate_chunked_daily_newspaper_pdf(...) -> bool

Optional environment variables
  NEWSPAPER_FONT_REGULAR / NEWSPAPER_FONT_BOLD : paths to Telugu .ttf files to
      embed (recommended on servers: no dependency on Google Fonts, identical
      measurement in both passes).
  NEWSPAPER_PAGES_PER_BROWSER : pass-2 pages per browser launch (default 1).
"""
import base64
import html as _html
import json
import os
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

_PDF_LOCK = threading.Lock()

# --------------------------------------------------------------------------- utils

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


TELUGU_DAYS = {0: "సోమవారం", 1: "మంగళవారం", 2: "బుధవారం", 3: "గురువారం",
               4: "శుక్రవారం", 5: "శనివారం", 6: "ఆదివారం"}
TELUGU_MONTHS = {1: "జనవరి", 2: "ఫిబ్రవరి", 3: "మార్చి", 4: "ఏప్రిల్", 5: "మే", 6: "జూన్",
                 7: "జులై", 8: "ఆగస్టు", 9: "సెప్టెంబర్", 10: "అక్టోబర్", 11: "నవంబర్", 12: "డిసెంబర్"}


def format_telugu_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{TELUGU_DAYS[dt.weekday()]} - {dt.day:02d} - {TELUGU_MONTHS[dt.month]} - {dt.year}"
    except Exception:
        return date_str


def sanitize_text(text: Any) -> str:
    if not text:
        return ""
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", str(text))
    return _html.escape(text.strip(), quote=True)


def optimize_image_url(url: Optional[str], max_width: int = 350, quality: int = 65) -> str:
    """Supabase Storage on-the-fly resize (needs Supabase image transformations enabled)."""
    if not url:
        return ""
    clean_url = str(url).strip()
    if "/storage/v1/object/public/" in clean_url:
        return clean_url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + \
            f"?width={max_width}&resize=contain&quality={quality}"
    if "/storage/v1/object/sign/" in clean_url:
        return clean_url.replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/") + \
            f"&width={max_width}&resize=contain&quality={quality}"
    return clean_url


_TELUGU_RE = re.compile(r"[ఀ-౿]")


def _looks_like_gibberish(text: str) -> bool:
    """Test posts like 'Dhshsksksbsbssjsnnsn' — no Telugu and almost no vowels."""
    if _TELUGU_RE.search(text):
        return False
    letters = re.findall(r"[A-Za-z]", text)
    if len(letters) < 8:
        return False
    vowels = sum(1 for ch in letters if ch.lower() in "aeiou")
    return vowels / len(letters) < 0.22


def clean_articles(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drop duplicate and junk/test stories, keep order."""
    seen, out, kept_words = set(), [], []
    for a in articles or []:
        head = str(a.get("headline") or a.get("title") or "").strip()
        body = str(a.get("content") or a.get("summary") or "").strip()
        if not head and not body:
            continue
        if _looks_like_gibberish(f"{head} {body}") or (not _TELUGU_RE.search(head + body) and len(body) < 40):
            _log(f"[PDF Generator] Skipped junk story: {head[:40]!r}")
            continue
        key = re.sub(r"\W+", "", (head + body[:300]).lower())
        words = set(re.findall(r"[\w\u0C00-\u0C7F]+", (head + " " + body).lower()))
        # re-posted / slightly edited copies of the same story: same words for the most part
        dup = key in seen or any(len(words & w) / max(1, len(words | w)) >= 0.6 for w in kept_words)
        if dup:
            _log(f"[PDF Generator] Skipped duplicate story: {head[:40]!r}")
            continue
        seen.add(key)
        kept_words.append(words)
        out.append(a)
    return out


def _order_articles(articles, lead_story_id):
    ordered = list(articles)
    if lead_story_id:
        idx = next((i for i, a in enumerate(ordered) if str(a.get("id")) == str(lead_story_id)), None)
        if idx is not None:
            ordered.insert(0, ordered.pop(idx))
    return ordered


def _as_list(v) -> List[str]:
    """Accept a list, a JSON list string, a Postgres array literal '{a,b}' or comma/newline separated URLs."""
    if not v:
        return []
    if isinstance(v, (list, tuple)):
        out = []
        for x in v:
            out.extend(_as_list(x) if isinstance(x, (list, tuple)) else ([str(x)] if x else []))
        return out
    s = str(v).strip()
    if s.startswith("["):
        try:
            return _as_list(json.loads(s))
        except Exception:
            pass
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1]
    return [p.strip().strip('"') for p in re.split(r'[,\n]\s*(?=https?:|data:|/)', s) if p.strip().strip('"')]


def _images_of(art) -> List[str]:
    imgs = (_as_list(art.get("image_urls")) or _as_list(art.get("images")) or _as_list(art.get("photos")))
    for k in ("image_url_2", "second_image_url"):
        if art.get(k):
            imgs += _as_list(art.get(k))
    if not imgs and art.get("image_url"):
        imgs = _as_list(art.get("image_url"))
    seen, out = set(), []
    for u in imgs:
        if u and u not in seen and not u.lower().split("?")[0].endswith((".mp4", ".mov", ".webm")):
            seen.add(u); out.append(u)
    return out[:2]


def _captions_of(art) -> List[str]:
    return [re.sub(r"\s+", " ", c).strip() for c in _as_list(art.get("image_captions") or art.get("captions"))]


def _paragraphs_html(text: str) -> str:
    # newspaper style: one continuous paragraph per story (no blank lines between paragraphs)
    one = re.sub(r"\s+", " ", str(text or "")).strip()
    return f"<p>{sanitize_text(one)}</p>"


def _head_and_body(art):
    """Some reporters paste a whole paragraph as the headline: keep a short headline, move the rest into the story."""
    head = re.sub(r"\s+", " ", str(art.get("headline") or art.get("title") or "")).strip() or "ముఖ్యాంశం"
    body = str(art.get("content") or art.get("summary") or "")
    if len(head) > 110:
        cut = head[:100]
        m = re.search(r"^(.{30,100}?[.!?।])\s", head + " ")
        short = m.group(1) if m else cut[:cut.rfind(" ")].rstrip(" ,.-") + "…"
        if not re.sub(r"\s+", " ", body).strip().startswith(head[:40]):
            body = head + " " + body
        head = short
    return head, body


def _byline(art) -> str:
    rep = sanitize_text(art.get("reporter_name") or art.get("byline") or "")
    loc = sanitize_text(art.get("location") or art.get("district") or "")
    if loc and rep:
        return f"{loc} &nbsp;|&nbsp; {rep}"
    return loc or rep


# --------------------------------------------------------------------------- fonts

def _font_css() -> str:
    reg, bold = os.getenv("NEWSPAPER_FONT_REGULAR"), os.getenv("NEWSPAPER_FONT_BOLD")
    faces = []
    for path, weight in ((reg, "400"), (bold, "700 900")):
        if path and os.path.exists(path):
            with open(path, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
            faces.append(f"@font-face{{font-family:'NP Telugu';font-weight:{weight};"
                         f"src:url(data:font/ttf;base64,{b64}) format('truetype');}}")
    if faces:
        return "<style>" + "".join(faces) + "</style>"
    return ('<link rel="preconnect" href="https://fonts.googleapis.com">'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;700;800'
            '&display=block" rel="stylesheet">')


# --------------------------------------------------------------------------- CSS

_CSS = """
@page { size: 297mm 420mm; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background:#fff; color:#111; font-family:'NP Telugu','Noto Serif Telugu',serif;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
#pool, template { display:none; }
.pdf-page { width:297mm; height:420mm; padding:9mm 9mm 7mm; background:#fff; margin:0 auto;
  display:flex; flex-direction:column; overflow:hidden; position:relative;
  break-after:page; page-break-after:always; }
.pdf-page:last-child { break-after:auto; page-break-after:auto; }

/* masthead */
.masthead { display:flex; align-items:center; gap:10px; border-bottom:3.5px solid #D60000; padding:2px 0 4px; margin-bottom:3px; }
.logo-box { flex:1; height:92px; position:relative; display:flex; align-items:center; justify-content:center; }
.logo-box .logo-text { font-size:44px; font-weight:900; color:#D60000; letter-spacing:.5px; }
.logo-box img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; background:#fff; }
.ad-box { width:25%; height:92px; display:flex; align-items:center; justify-content:center; }
.ad-box img { max-height:88px; max-width:100%; border:1px solid #ccc; padding:2px; }
.meta { display:flex; justify-content:space-between; align-items:center; background:#006600; color:#fff;
  font-size:13px; font-weight:700; padding:5px 14px; margin-bottom:7px; border-radius:2px; }
.meta .price { color:#FFEB3B; }
.page-strip { display:flex; justify-content:space-between; align-items:center; background:#006600; color:#fff;
  font-size:13px; font-weight:700; padding:6px 14px; margin-bottom:7px; border-radius:2px; flex:0 0 auto; }

/* inner page header — like a printed daily: page number, small logo, section band, date pill */
.page-head { flex:0 0 auto; display:flex; align-items:center; gap:10px; height:50px; margin-bottom:6px;
  border-bottom:3px solid #C8102E; padding-bottom:4px; }
.page-head .pno { font-size:38px; font-weight:900; color:#111; min-width:40px; text-align:center; line-height:1; }
.page-head .hl { height:44px; width:auto; max-width:200px; object-fit:contain; }
.page-head .hl-t { font-size:24px; font-weight:900; color:#C8102E; }
.page-head .sect { flex:1; height:42px; display:flex; align-items:center; padding:0 16px; color:#fff; font-size:25px;
  font-weight:900; background:linear-gradient(90deg,#0B3D91,#1E56C8 60%,#3B82F6); border-radius:4px; }
.page-head .dpill { background:#FFE14D; color:#7A0000; border:2px solid #C8102E; border-radius:22px; padding:5px 16px;
  font-size:14px; font-weight:800; white-space:nowrap; }

/* page lead / feature: big centred coloured headline, large photo(s), text beside */
.feature { flex:0 0 auto; margin-bottom:7px; padding-bottom:7px; border-bottom:2.5px solid #222; }
.feature h1 { font-size:31px; font-weight:900; line-height:1.32; text-align:center; margin:0 0 4px; }
.feature .byline { text-align:center; border:0; font-size:11.5px; }
.feat-row { display:flex; gap:5mm; align-items:flex-start; }
.feat-fig { flex:0 0 46%; }
.feat-fig.two { flex-basis:60%; display:grid; grid-template-columns:1fr 1fr; gap:4px; align-items:start; }
.feat-text { flex:1; column-count:2; column-gap:4mm; column-rule:.6px solid #c8c8c8; }
.feat-text p { font-size:calc(var(--fs) + .6px); line-height:var(--lh); }
.feature.t0 h1 { color:#C8102E; } .feature.t1 h1 { color:#0B3D91; } .feature.t2 h1 { color:#7A1F5C; }
.feature.t3 h1 { color:#0B6B1E; } .feature.t4 h1 { color:#B4540A; } .feature.t5 h1 { color:#1F2937; }

/* body: wide blocks (2 sub-columns) and single-column side sections */
.flow { flex:1 1 auto; min-height:0; display:flex; gap:4mm; overflow:hidden; }
.stack { overflow:hidden; }
.stack + .stack { border-left:.8px solid #9a9a9a; padding-left:4mm; }
.stack.k2 > .story { column-count:2; column-gap:4.5mm; column-rule:.5px solid #d4d4d4; }
.story h2, .story .byline, .story .cont-kicker, .stack.k2 .story .fig.two { column-span:all; }
.stack.k2 .fig.two { display:grid; grid-template-columns:1fr 1fr; gap:4.5mm; align-items:start; }
.stack.k2 .fig.two .pic + .pic { margin-top:0; }
.stack.k2 .story h2 { font-size:19px; }
.stack.k1 .story h2 { font-size:17px; }
.story { padding-bottom:6px; margin-bottom:7px; border-bottom:1.3px solid #9a9a9a; -webkit-box-decoration-break:clone; box-decoration-break:clone; }
.story.tint0 { background:#FFF4F6; } .story.tint1 { background:#F3F1FF; } .story.tint2 { background:#F2FAF4; }
.story[class*="tint"] { padding:5px 5px 6px; }
.story h2 { font-size:16px; font-weight:900; line-height:1.32; margin-bottom:4px; break-after:avoid; break-inside:avoid;
  padding:4px 7px 5px; border-left:5px solid currentColor; border-radius:2px; }
.story.t0 h2 { color:#C8102E; background:#FDE8EB; } .story.t1 h2 { color:#0B3D91; background:#E7EEFC; }
.story.t2 h2 { color:#7A1F5C; background:#F6E8F1; } .story.t3 h2 { color:#0B6B1E; background:#E5F4E8; }
.story.t4 h2 { color:#B4540A; background:#FDF0E2; } .story.t5 h2 { color:#1F2937; background:#ECEEF2; }
.byline { font-size:10.5px; font-weight:700; color:#666; border-bottom:1px solid #e3e3e3; padding-bottom:2px;
  margin-bottom:4px; break-after:avoid; break-inside:avoid; }
.fig { break-inside:avoid; margin:2px 0 5px; }
.fig.two .pic + .pic { margin-top:4px; }          /* two photos: stacked, full column width (not tiny side by side) */
.pic { margin:0; }
.cap { font-size:10.5px; line-height:1.35; color:#333; font-weight:600; padding:2px 1px 0; text-align:center; }
.ph { aspect-ratio:4 / 3; background:#fff; overflow:hidden; border:1px solid #d5d5d5; }
.ph img { width:100%; height:100%; object-fit:cover; display:block; }
.ph img.fit { object-fit:contain; }
.body p, .feat-text p { text-align:justify; text-indent:1.3em; orphans:1; widows:1; text-wrap:pretty; }
:root { --fs:12.2px; --lh:1.48; }
.body p { font-size:var(--fs); line-height:var(--lh); }
.body p.noind, .feat-text p.noind { text-indent:0; }
.contd { break-inside:avoid; font-size:10.5px; font-weight:700; color:#D60000; text-align:right; margin-top:2px; }
.cont-kicker { font-size:12px; font-weight:800; color:#003399; background:#e8eeff; border-left:4px solid #003399; padding:3px 6px;
  margin-bottom:4px; break-after:avoid; break-inside:avoid; }

/* stickers that fill free space: reporters wanted, send news, ads, app */
.sticker { break-inside:avoid; border:2px dashed currentColor; border-radius:7px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center; padding:6px 8px; overflow:hidden; margin-bottom:8px; }
.sticker .st-t { font-size:19px; font-weight:900; line-height:1.3; }
.sticker .st-s { font-size:12px; font-weight:700; line-height:1.45; margin-top:3px; color:#222; }
.sticker .st-p { font-size:17px; font-weight:900; margin-top:5px; background:#fff; padding:1px 12px; border-radius:14px;
  border:1.5px solid currentColor; white-space:nowrap; }
.sticker.sm .st-s { display:none; }
.sticker.xs { flex-direction:row; gap:8px; padding:2px 6px; }
.sticker.xs .st-s { display:none; }
.sticker.xs .st-t { font-size:13.5px; white-space:nowrap; }
.sticker.xs .st-p { font-size:12.5px; margin-top:0; padding:0 8px; }
.sticker.lg .st-t { font-size:26px; }
.sticker.lg .st-s { font-size:14px; }
.sticker.lg .st-p { font-size:22px; }
.sticker.v0 { background:#FFF3B0; color:#C40000; }
.sticker.v1 { background:#E6F6EA; color:#0B6B1E; }
.sticker.v2 { background:#E8EEFF; color:#0A2E8A; }
.sticker.v3 { background:#FFE8EC; color:#A3082A; }
.end-promo { flex:1 1 auto; min-height:0; margin-top:6px; display:flex; gap:5mm; overflow:hidden; }
.end-promo .sticker { margin:0; border-width:3px; }
.end-promo .sticker .st-t { font-size:30px; }
.end-promo .sticker .st-s { font-size:15px; }
.end-promo .sticker .st-p { font-size:26px; }

.footer { flex:0 0 auto; display:flex; justify-content:space-between; align-items:center;
  border-top:1.5px solid #333; padding-top:3px; font-size:11px; color:#444; margin-top:6px; }
"""

# --------------------------------------------------------------------------- paginator (runs in the browser)

_PAGINATOR_JS = r"""
(async function(){
  const CFG = JSON.parse(document.getElementById('np-cfg').textContent);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    await Promise.race([document.fonts.ready, sleep(10000)]);
    const fam = getComputedStyle(document.body).fontFamily;
    await Promise.race([Promise.all([
      document.fonts.load('400 13px ' + fam, 'తెలుగు'), document.fonts.load('700 13px ' + fam, 'తెలుగు'),
      document.fonts.load('800 17px ' + fam, 'తెలుగు')]), sleep(10000)]);
  } catch (e) {}

  const out = document.getElementById('pages');
  // Read every photo's real shape first, so each frame gets the photo's own aspect ratio
  // and the whole photo is shown (no cropping), while the layout stays fixed for printing.
  const RATIO = {};
  {
    const srcs = new Set();
    document.querySelectorAll('#pool .ph img').forEach(i => srcs.add(i.getAttribute('src')));
    const t1 = document.getElementById('tpl-first');
    if (t1) t1.content.querySelectorAll('.ph img').forEach(i => srcs.add(i.getAttribute('src')));
    await Promise.race([Promise.all(Array.from(srcs).map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => { if (im.naturalWidth) RATIO[src] = im.naturalHeight / im.naturalWidth; res(); };
      im.onerror = res; im.src = src;
    }))), sleep(25000)]);
  }
  function applyRatios(root, maxR){
    root.querySelectorAll('.ph img').forEach(img => {
      let r = RATIO[img.getAttribute('src')]; if (!r) return;
      const box = img.parentElement.dataset.box;
      if (box) {                                   // show only the photo part of a clipping image
        const [cw, ch] = box.split(',').map(Number);
        r = r * ch / cw;
        img.parentElement.style.aspectRatio = '1 / ' + Math.min(Math.max(r, 0.42), maxR + 0.2).toFixed(4);
        return;
      }
      const c = Math.min(Math.max(r, 0.42), maxR);
      img.parentElement.style.aspectRatio = '1 / ' + c.toFixed(4);
      if (Math.abs(c - r) > 0.01) img.classList.add('fit');   // very tall/wide photo: show it whole inside the frame
    });
  }

  const POOL_HTML = document.getElementById('pool').innerHTML;
  document.getElementById('pool').remove();
  let pool = [];
  let curV = [12.2, 1.48, 0];
  const MINW = 14;                  // never leave fewer than ~2 lines at a cut
  let pageNo = CFG.pageOffset;
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');


  // ---- page patterns: wide blocks (2 sub-columns) mixed with a single-column side section
  // [width share, sub-columns]
  const PATTERNS = [
    [[0.64, 2], [0.36, 1]],
    [[0.5, 2], [0.5, 2]],
    [[0.36, 1], [0.64, 2]],
    [[0.5, 2], [0.5, 2]],
  ];
  const fits = f => f.scrollWidth <= f.clientWidth + 1 && f.scrollHeight <= f.clientHeight + 1;
  const used = st => {
    const l = st.lastElementChild;
    return l ? Math.ceil(l.getBoundingClientRect().bottom - st.getBoundingClientRect().top) + 8 : 0;
  };

  function newPage(first){
    const tpl = document.getElementById(first ? 'tpl-first' : 'tpl-inner');
    const pg = tpl.content.firstElementChild.cloneNode(true);
    const idx = pageNo - CFG.pageOffset;
    pageNo++;
    pg.querySelectorAll('[data-pno]').forEach(e => e.textContent = String(pageNo));
    pg.style.setProperty('--fs', curV[0] + 'px'); pg.style.setProperty('--lh', String(curV[1]));
    out.appendChild(pg);
    buildFeature(pg, first);
    const f = pg.querySelector('.flow');
    const H = Math.floor(f.getBoundingClientRect().height);
    f.style.height = H + 'px'; f.style.flex = '0 0 auto';
    const pat = PATTERNS[idx % PATTERNS.length];
    return pat.map(([w, k]) => {
      const st = document.createElement('div');
      st.className = 'stack k' + k;
      st.style.flex = '0 0 calc(' + (w * 100).toFixed(2) + '% - 2mm)';
      st.style.height = H + 'px';
      f.appendChild(st);
      return st;
    });
  }

  // cut a story so it exactly fills the free space at the bottom of a block; the rest goes to the next page
  function splitInto(story, st){
    const room = st.clientHeight - used(st) - 4;
    if (room < 90) return null;
    const ws = wordsOf(story);
    if (ws.length < MINW * 2) return null;
    const head = story.dataset.head || '';
    const isCont = story.classList.contains('cont');
    const hasFig = !!story.querySelector('.fig');
    const nextP = pageNo + 1;
    const make = (k, withFig) => {
      const c = story.cloneNode(true);
      if (!withFig) c.querySelectorAll('.fig').forEach(x => x.remove());
      c.querySelector('.body').innerHTML = wordsHTML(ws.slice(0, k), isCont) +
        '<div class="contd">మిగతా ' + nextP + 'వ పేజీలో ▸</div>';
      c.style.height = room + 'px'; c.style.columnFill = 'auto'; c.style.overflow = 'hidden';
      return c;
    };
    const ok = c => fits(c) && fits(st);
    for (const withFig of (hasFig ? [true, false] : [false])) {
      let c = make(MINW, withFig); st.appendChild(c); const good = ok(c); c.remove();
      if (!good) continue;
      let lo = MINW, hi = ws.length - MINW, best = MINW;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        c = make(mid, withFig); st.appendChild(c);
        if (ok(c)) { best = mid; lo = mid + 1; } else hi = mid - 1;
        c.remove();
      }
      st.appendChild(make(best, withFig));
      const rest = document.createElement('article');
      rest.className = story.className.replace(/\btint\d\b/g, '') + ' cont';
      rest.dataset.head = head;
      rest.dataset.imgs = '0';
      const figs = withFig ? '' : Array.from(story.querySelectorAll('.fig')).map(x => x.outerHTML).join('');
      rest.innerHTML = '<div class="cont-kicker">' + esc(head) + ' — ' + pageNo + 'వ పేజీ తరువాయి</div>' +
        figs + '<div class="body">' + wordsHTML(ws.slice(best), true) + '</div>';
      return rest;
    }
    return null;
  }

  // free space at the bottom of a block: a sticker of exactly that height
  function fillRest(st){
    let room = st.clientHeight - used(st) - 2;
    if (room < 30) return;
    const sk = makeSticker();
    st.appendChild(sk);
    while (room >= 30) { sizeSticker(sk, room); if (fits(st)) return; room -= 4; }
    sk.remove(); stickerNo--;
  }

  function fillPage(stacks){
    const open = new Set(stacks);
    let carry = null;
    while (open.size && pool.length) {
      const st = Array.from(open).sort((a, b) => used(a) - used(b))[0];
      const s = pool[0];
      st.appendChild(s);
      if (fits(st)) { pool.shift(); continue; }
      s.remove();
      let took = false;                      // a later story that fits whole
      for (let j = 1; j < Math.min(pool.length, 15); j++) {
        const b = pool[j]; st.appendChild(b);
        if (fits(st)) { pool.splice(j, 1); took = true; break; }
        b.remove();
      }
      if (took) continue;
      if (!carry) {
        const r = splitInto(s, st);
        if (r) { pool.shift(); carry = r; open.delete(st); fillRest(st); continue; }
      }
      if (!st.children.length) { st.appendChild(s); pool.shift(); open.delete(st); continue; }  // safety
      fillRest(st); open.delete(st);
    }
    if (carry) pool.unshift(carry);
    return open;
  }

  function layout(v){
    curV = v;
    out.innerHTML = '';
    const tmp = document.createElement('div'); tmp.innerHTML = POOL_HTML;
    applyRatios(tmp, 1.2);
    tmp.querySelectorAll('.fig.two').forEach(fg => {   // two photos in a block: same height
      const phs = Array.from(fg.querySelectorAll('.ph'));
      const rs = phs.map(ph => { const m = (ph.style.aspectRatio || '').match(/1 \/ ([\d.]+)/); return m ? +m[1] : 0.75; });
      const r = Math.min(Math.max(rs.reduce((x, y) => x + y, 0) / rs.length, 0.6), 0.95);
      phs.forEach(ph => { ph.style.aspectRatio = '1 / ' + r.toFixed(4); });
    });
    pool = Array.from(tmp.children);
    pageNo = CFG.pageOffset; stickerNo = 0;
    let first = CFG.firstPage, fill = 1;
    while (pool.length) {
      const stacks = newPage(first); first = false;
      const open = fillPage(stacks);
      if (!pool.length) {                     // last page
        const H = stacks[0].clientHeight;
        fill = stacks.reduce((a, st) => a + Math.min(1, used(st) / H), 0) / stacks.length;
        open.forEach(st => fillRest(st));
      }
    }
    return { pages: out.querySelectorAll('.pdf-page').length, fill };
  }
  function wordsOf(story){
    const ws = [];
    story.querySelectorAll('.body p').forEach((p, pi) => {
      (p.textContent || '').split(/\s+/).filter(Boolean).forEach(w => ws.push([pi, w]));
    });
    return ws;
  }
  function wordsHTML(ws, firstNoIndent){
    let html = '', cur = -1, buf = [];
    const flush = () => { if (buf.length) html += '<p' + (firstNoIndent && html === '' ? ' class="noind"' : '') + '>' + esc(buf.join(' ')) + '</p>'; buf = []; };
    ws.forEach(([pi, w]) => { if (pi !== cur) { flush(); cur = pi; } buf.push(w); });
    flush();
    return html;
  }

  // Page lead ("feature"): every page opens with one story shown big — large centred headline,
  // large photo(s) (two photos side by side), text in two columns beside the photos.
  // Page 1 uses the chosen lead story; other pages pick a story with two photos first, then a long one with a photo.
  function pickFeature(first){
    if (first) return pool.findIndex(x => x.dataset && x.dataset.lead === '1');
    let best = -1, bs = -1e9;
    for (let i = 0; i < Math.min(pool.length, 24); i++) {
      const x = pool[i];
      if (x.classList.contains('cont') || x.classList.contains('sticker')) continue;
      const n = +x.dataset.imgs || 0, w = +x.dataset.words || 0;
      if (!n || w < 60) continue;
      const sc = (n >= 2 ? 600 : 0) + Math.min(w, 350) - i * 12;
      if (sc > bs) { bs = sc; best = i; }
    }
    return best;
  }
  function buildFeature(pg, first){
    const slot = pg.querySelector('.feature-slot');
    const idx = pickFeature(first);
    if (idx < 0) { slot.remove(); return; }
    const src = pool.splice(idx, 1)[0];
    const pics = Array.from(src.querySelectorAll('.pic'));
    const two = pics.length >= 2;
    const tone = ((src.className.match(/\bt(\d)\b/) || [])[1]) || '0';
    const ft = document.createElement('div');
    ft.className = 'feature t' + tone;
    const by = src.querySelector('.byline');
    ft.innerHTML = '<h1>' + esc(src.dataset.head || '') + '</h1>' + (by ? by.outerHTML : '') +
      '<div class="feat-row">' + (pics.length ? '<div class="feat-fig' + (two ? ' two' : '') + '"></div>' : '') +
      '<div class="feat-text"></div></div>';
    const fig = ft.querySelector('.feat-fig');
    pics.forEach(p => fig.appendChild(p));
    slot.replaceWith(ft);
    applyRatios(ft, two ? 1.0 : 0.8);
    if (two) {                                   // two photos side by side: same height, like a printed page
      const phs = Array.from(ft.querySelectorAll('.ph'));
      const rs = phs.map(ph => { const m = (ph.style.aspectRatio || '').match(/1 \/ ([\d.]+)/); return m ? +m[1] : 0.75; });
      const r = Math.min(Math.max(rs.reduce((x, y) => x + y, 0) / rs.length, 0.6), 0.95);
      phs.forEach(ph => { ph.style.aspectRatio = '1 / ' + r.toFixed(4); });
    }
    const ws = wordsOf(src);
    const lt = ft.querySelector('.feat-text');
    const H = fig ? Math.ceil(fig.getBoundingClientRect().height) : 0;
    lt.innerHTML = wordsHTML(ws, false);
    let best = ws.length;
    if (H > 40) {
      lt.style.height = H + 'px'; lt.style.columnFill = 'auto'; lt.style.overflow = 'hidden';
      const ok = () => lt.scrollWidth <= lt.clientWidth + 1 && lt.scrollHeight <= lt.clientHeight + 1;
      if (!ok()) {
        let lo = 1, hi = ws.length; best = 0;
        while (lo <= hi) { const m = (lo + hi) >> 1; lt.innerHTML = wordsHTML(ws.slice(0, m), false); if (ok()) { best = m; lo = m + 1; } else hi = m - 1; }
        lt.innerHTML = wordsHTML(ws.slice(0, best), false);
      } else {
        fillGap(lt);                       // short story: a sticker fills the space beside the photo
      }
    }
    if (best < ws.length) {
      const rest = document.createElement('article');
      rest.className = 'story cont t' + tone;
      rest.dataset.head = src.dataset.head || '';
      rest.innerHTML = '<div class="body">' + wordsHTML(ws.slice(best), true) + '</div>';
      let at = 0;
      while (at < pool.length && pool[at].classList.contains('cont') && !pool[at].dataset.fresh) at++;
      rest.dataset.fresh = '1';
      pool.splice(at, 0, rest);
    }
  }

  let stickerNo = 0;
  function makeSticker(){
    const tpls = document.querySelectorAll('template.tpl-sticker');
    const t = tpls[stickerNo++ % tpls.length];
    return t.content.firstElementChild.cloneNode(true);
  }
  function sizeSticker(st, h){
    st.style.height = h + 'px';
    st.classList.toggle('xs', h < 62);
    st.classList.toggle('sm', h >= 62 && h < 118);
    st.classList.toggle('lg', h >= 230);
    const t = st.querySelector('.st-t');
    if (t && t.dataset.short) t.textContent = h < 62 ? t.dataset.short : t.dataset.full;
  }

  // free space at the end of the page (last column)
  function fillGap(f){
    const st = makeSticker();
    f.appendChild(st);
    let lo = 0, hi = f.clientHeight, best = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; sizeSticker(st, m); if (fits(f)) { best = m; lo = m + 1; } else hi = m - 1; }
    if (best < 30) { st.remove(); stickerNo--; return; }
    sizeSticker(st, best);
  }


  const CANDS = [[12.1, 1.46, 0], [12.4, 1.48, 0], [12.7, 1.5, 0], [13.0, 1.52, 0], [13.3, 1.54, 0]];
  // fewest pages first (a tight paper), then the fullest last page, then the size closest to normal
  let best = null;
  CANDS.forEach((v, k) => {
    const r = layout(v);
    const score = -r.pages * 10 + r.fill - Math.abs(k - 2) * 0.04;
    if (!best || score > best.score) best = { k, score, r };
  });
  if (best.k !== CANDS.length - 1) layout(CANDS[best.k]);
  console.log('[newspaper] chosen size', CANDS[best.k], best.r);
  // Freeze every multi-column block at the size measured here. Chrome balances columns differently
  // when it prints (paged media), which pushed text out of blocks near the bottom of the page.
  // With a fixed height and column-fill:auto the printed page is exactly what was measured.
  out.querySelectorAll('.stack.k2 > .story, .feat-text').forEach(el => {
    if (!el.style.height) {
      el.style.height = Math.ceil(el.getBoundingClientRect().height) + 'px';
    }
    el.style.columnFill = 'auto';
    el.style.overflow = 'hidden';
  });
  out.querySelectorAll('.stack > .story, .stack > .sticker').forEach(el => { el.style.breakInside = 'avoid'; });
  window.__NP_DONE = true;
  window.__NP_PAGES = Array.from(out.querySelectorAll('.pdf-page')).map(p => p.outerHTML);
})();
"""


# --------------------------------------------------------------------------- HTML builders

# (text colour, pastel band colour) — headlines like a printed Telugu daily: bold coloured text on a light band
HEADLINE_TONES = [("#C8102E", "#FDE8EB"), ("#0B3D91", "#E7EEFC"), ("#7A1F5C", "#F6E8F1"),
                  ("#0B6B1E", "#E5F4E8"), ("#B4540A", "#FDF0E2"), ("#1F2937", "#ECEEF2")]
HEADLINE_COLORS = [t for t, _ in HEADLINE_TONES]


# --------------------------------------------------------------------------- photo crop
# Reporters' images are often the full app clipping (photo on top, then headline, text and
# footer). For the newspaper only the PHOTO part is wanted. We download a small copy of each
# image, find the photo block (rows that are not white paper with text) and print just that.

_CROP_CACHE: Dict[str, Optional[tuple]] = {}


def _detect_photo_box(data: bytes) -> Optional[tuple]:
    """Return (x0, y0, x1, y1) as fractions of the image for the photo part, or None to keep the whole image."""
    try:
        import io
        import numpy as np
        from PIL import Image
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im.thumbnail((320, 1600))
        a = np.asarray(im).astype(np.int16)
    except Exception:
        return None
    H, W = a.shape[:2]
    if H < 60 or W < 60:
        return None
    white = (a.min(axis=2) > 232)                          # paper-white pixels
    rw = white.mean(axis=1)                                # white fraction per row
    k = max(3, H // 80)
    rws = np.convolve(rw, np.ones(k) / k, mode="same")
    photo_rows = rws < 0.72
    # longest run of photo-like rows
    best, cur, start = (0, 0, 0), 0, 0
    for y, v in enumerate(photo_rows):
        if v:
            if cur == 0:
                start = y
            cur += 1
            if cur > best[0]:
                best = (cur, start, y + 1)
        else:
            cur = 0
    run, y0, y1 = best
    if run < 0.15 * H:
        return None                                       # no clear photo block: keep whole image
    if run > 0.9 * H:
        return None                                       # it is already a plain photo
    # bright parts of a photo (sky, white walls) can look like paper: extend the photo upwards
    # until a real blank paper band (several fully white rows) is found
    band = max(3, H // 60)
    y = y0
    blank = 0
    while y > 0:
        y -= 1
        blank = blank + 1 if rw[y] > 0.985 else 0
        if blank >= band:
            y += blank
            break
    y0 = y if blank < band else y0 if y >= y0 else y
    # trim white side margins inside the photo rows
    cw = white[y0:y1].mean(axis=0)
    cols = np.where(cw < 0.9)[0]
    x0, x1 = (int(cols[0]), int(cols[-1]) + 1) if len(cols) else (0, W)
    if x1 - x0 < 0.5 * W:
        x0, x1 = 0, W
    pad = 1
    return (max(0, x0 + pad) / W, max(0, y0 + pad) / H, min(W, x1 - pad) / W, min(H, y1 - pad) / H)


def _prepare_photo_crops(urls: List[str]):
    """Analyse all images in parallel (small copies) and fill _CROP_CACHE."""
    if os.getenv("NEWSPAPER_PHOTO_CROP", "1") == "0":
        return
    todo = [u for u in dict.fromkeys(urls) if u and u not in _CROP_CACHE]
    if not todo:
        return
    import urllib.request
    from concurrent.futures import ThreadPoolExecutor

    def work(u):
        try:
            req = urllib.request.Request(optimize_image_url(u, max_width=320, quality=60),
                                         headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as r:
                return u, _detect_photo_box(r.read(6_000_000))
        except Exception:
            return u, None

    with ThreadPoolExecutor(max_workers=8) as ex:
        for u, box in ex.map(work, todo):
            _CROP_CACHE[u] = box
    if len(_CROP_CACHE) > 3000:
        _CROP_CACHE.clear()


def _ph_html(u: str, w: int, caption: str = "") -> str:
    cap = f'<div class="cap">{sanitize_text(caption)}</div>' if caption else ""
    return f'<figure class="pic">{_ph_inner(u, w)}{cap}</figure>'


def _ph_inner(u: str, w: int) -> str:
    src = sanitize_text(optimize_image_url(u, max_width=w))
    box = _CROP_CACHE.get(u)
    if not box:
        return f'<div class="ph"><img src="{src}" alt="" loading="eager"></div>'
    x0, y0, x1, y1 = box
    cw, ch = x1 - x0, y1 - y0
    style = (f"position:absolute;max-width:none;object-fit:fill;width:{100 / cw:.3f}%;height:{100 / ch:.3f}%;"
             f"left:{-x0 / cw * 100:.3f}%;top:{-y0 / ch * 100:.3f}%")
    return (f'<div class="ph crop" data-box="{cw:.5f},{ch:.5f}" style="position:relative">'
            f'<img src="{src}" alt="" loading="eager" style="{style}"></div>')


def _fig_html(imgs, captions=None, lead=False) -> str:
    if not imgs:
        return ""
    captions = captions or []
    w = 900 if (lead or len(imgs) >= 2) else 640
    cls = "fig" + (" two" if len(imgs) >= 2 else "")
    return f'<div class="{cls}">' + "".join(
        _ph_html(u, w, captions[i] if i < len(captions) else "") for i, u in enumerate(imgs[:2])) + '</div>'


def _story_html(art, k: int, lead: bool = False) -> str:
    head_raw, content = _head_and_body(art)
    head = sanitize_text(head_raw)
    by = _byline(art)
    imgs = _images_of(art)
    words = len(str(content).split())
    tone = k % len(HEADLINE_TONES)
    tint = " tint" + str(k % 3) if k % 4 == 3 else ""
    return (f'<article class="story t{tone}{tint}" data-head="{head}" data-imgs="{len(imgs)}" data-words="{words}"'
            + (' data-lead="1"' if lead else "") + '>'
            f'<h2>{head}</h2>'
            + (f'<div class="byline">{by}</div>' if by else "")
            + _fig_html(imgs, _captions_of(art), lead)
            + f'<div class="body">{_paragraphs_html(content)}</div></article>')


def build_newspaper_html(
    publication_name: str,
    logo_url: str,
    edition_date: str,
    articles: List[Dict[str, Any]],
    lead_story_id: Optional[str] = None,
    advertisement_config: Optional[Dict[str, Any]] = None,
    edition_info: Optional[Dict[str, Any]] = None,
    page_offset: int = 0,
    total_pages_override: Optional[int] = None,   # kept for backward compatibility (unused)
) -> str:
    """Self-paginating HTML. Open it in a browser (preview) or feed it to the PDF renderer."""
    info = edition_info if isinstance(edition_info, dict) else {}
    edition_no = sanitize_text(info.get("edition_no", "01"))
    issue_no = sanitize_text(info.get("issue_no", "266"))
    editor_name = sanitize_text(info.get("editor_name", "స్పాట్ న్యూస్"))
    price = sanitize_text(info.get("price", "రూ. 1.50/-"))
    location = sanitize_text(info.get("location", "హైదరాబాద్ / ఆంధ్రప్రదేశ్ & తెలంగాణ"))
    phone = sanitize_text(info.get("contact_phone", "7668886666"))
    stickers = info.get("stickers") or [
        {"title": "రిపోర్టర్లు కావలెను!", "short": "రిపోర్టర్లు కావలెను", "text": "మీ మండలంలో RTI Express రిపోర్టర్‌గా చేరండి"},
        {"title": "మీ ఊరి వార్తలు పంపండి", "short": "వార్తలు పంపండి", "text": "ఫోటోలు, సమస్యలు, శుభవార్తలు — వాట్సాప్ చేయండి"},
        {"title": "ప్రకటనల కోసం సంప్రదించండి", "short": "ప్రకటనల కోసం", "text": "మీ వ్యాపారం ప్రతి ఊరికి చేరాలంటే"},
        {"title": "RTI Express Spot News యాప్", "short": "యాప్ డౌన్‌లోడ్", "text": "గూగుల్ ప్లేలో ఉచితంగా డౌన్‌లోడ్ చేసుకోండి"},
    ]
    sticker_tpls = "".join(
        f'<template class="tpl-sticker"><div class="sticker v{k % 4}"><div class="st-t" data-full="{sanitize_text(st.get("title"))}" data-short="{sanitize_text(st.get("short") or st.get("title"))}">{sanitize_text(st.get("title"))}</div>'
        f'<div class="st-s">{sanitize_text(st.get("text"))}</div><div class="st-p">ఫోన్: {sanitize_text(st.get("phone") or phone)}</div></div></template>'
        for k, st in enumerate(stickers))
    pub = sanitize_text(publication_name)
    tdate = format_telugu_date(edition_date)

    ordered = clean_articles(_order_articles(articles, lead_story_id))   # lead first, so its copies are the ones dropped
    _prepare_photo_crops([u for a in ordered for u in _images_of(a)])
    first_page = page_offset == 0
    stories = "".join(_story_html(a, i, lead=(i == 0 and first_page)) for i, a in enumerate(ordered))
    section = sanitize_text(info.get("section_name", "జనరల్ న్యూస్"))
    small_logo = (f'<img class="hl" src="{sanitize_text(optimize_image_url(logo_url, max_width=300, quality=80))}" alt="">'
                  if logo_url else f'<span class="hl-t">{sanitize_text(publication_name)}</span>')

    ad_html = ""
    if advertisement_config and advertisement_config.get("image_url"):
        ad_html = (f'<div class="ad-box"><img src="{sanitize_text(optimize_image_url(advertisement_config["image_url"], 300, 70))}" alt=""></div>')
    logo_src = sanitize_text(optimize_image_url(logo_url, max_width=600, quality=80)) if logo_url else ""

    footer = (f'<div class="footer"><div>{pub} - {sanitize_text(edition_date)}</div>'
              f'<div style="font-weight:700">పేజీ <span data-pno></span></div></div>')
    end_promo = ('<div class="end-promo" style="display:none">'
                 + "".join(f'<div class="sticker v{k % 4}"><div class="st-t">{sanitize_text(st.get("title"))}</div>'
                           f'<div class="st-s">{sanitize_text(st.get("text"))}</div><div class="st-p">ఫోన్: {sanitize_text(st.get("phone") or phone)}</div></div>'
                           for k, st in enumerate(stickers[:4]))
                 + '</div>')

    tpl_first = (
        '<div class="pdf-page">'
        '<div class="masthead"><div class="logo-box">'
        f'<span class="logo-text">{pub}</span>'
        + (f'<img src="{logo_src}" alt="">' if logo_src else "")
        + f'</div>{ad_html}</div>'
        f'<div class="meta"><div>సంపుటి: {edition_no} &nbsp;|&nbsp; సంచిక: {issue_no} &nbsp;|&nbsp; ఎడిటర్: {editor_name}</div>'
        f'<div class="price">దినపత్రిక &nbsp;|&nbsp; వెల: {price}</div>'
        f'<div>{tdate} &nbsp;|&nbsp; {location}</div></div>'
        f'<div class="feature-slot"></div><div class="flow"></div>{end_promo}{footer}</div>')
    tpl_inner = (
        '<div class="pdf-page">'
        f'<div class="page-head"><div class="pno" data-pno></div>{small_logo}'
        f'<div class="sect">{section}</div><div class="dpill">{tdate}</div></div>'
        f'<div class="feature-slot"></div><div class="flow"></div>{end_promo}{footer}</div>')

    cfg = json.dumps({"pageOffset": page_offset, "firstPage": first_page})

    return f"""<!DOCTYPE html>
<html lang="te"><head><meta charset="UTF-8">
<title>{pub} - {sanitize_text(edition_date)}</title>
{_font_css()}
<style>{_CSS}</style>
</head><body>
<div id="pages"></div>
<div id="pool">{stories}</div>
<template id="tpl-first">{tpl_first}</template>
<template id="tpl-inner">{tpl_inner}</template>
{sticker_tpls}
<script type="application/json" id="np-cfg">{cfg}</script>
<script>{_PAGINATOR_JS}</script>
</body></html>"""


def _page_document(head_html: str, page_html: str) -> str:
    return f'<!DOCTYPE html><html lang="te"><head>{head_html}</head><body><div id="pages">{page_html}</div></body></html>'


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


_VIEWPORT = {"width": 1123, "height": 1588}


def _paginate(p, full_html: str):
    """Pass 1: lay out every page with images blocked; return (head_html, [page_html, ...])."""
    browser = p.chromium.launch(**_launch_kwargs())
    try:
        ctx = browser.new_context(viewport=_VIEWPORT, device_scale_factor=1)
        page = ctx.new_page()
        page.route("**/*", lambda r: r.abort() if r.request.resource_type == "media" else r.continue_())
        page.set_content(full_html, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("window.__NP_DONE === true", timeout=120000)
        pages = page.evaluate("window.__NP_PAGES")
        head = page.evaluate("document.head.innerHTML")
        ctx.close()
        return head, pages
    finally:
        browser.close()


def _wait_assets(page, img_timeout_ms: int = 20000):
    try:
        page.wait_for_function("document.fonts.status === 'loaded'", timeout=15000)
    except Exception:
        pass
    try:
        page.wait_for_function(
            "Array.from(document.images).every(i => i.complete)", timeout=img_timeout_ms)
    except Exception:
        print("[PDF Generator] Some images did not load in time; their frames stay blank.")


def _print_pdf(page, path):
    page.pdf(path=path, width="297mm", height="420mm", print_background=True,
             prefer_css_page_size=True, display_header_footer=False,
             margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"})


def _render_pages(p, head_html: str, pages: List[str], temp_dir: str) -> List[str]:
    """Pass 2: print each finished page (images loaded), recycling the browser for low memory."""
    per_browser = max(1, int(os.getenv("NEWSPAPER_PAGES_PER_BROWSER", "1")))
    files = []
    for start in range(0, len(pages), per_browser):
        browser = p.chromium.launch(**_launch_kwargs())
        try:
            ctx = browser.new_context(viewport=_VIEWPORT, device_scale_factor=1)
            for i in range(start, min(start + per_browser, len(pages))):
                page = ctx.new_page()
                page.emulate_media(media="screen")
                try:
                    page.set_content(_page_document(head_html, pages[i]), wait_until="load", timeout=45000)
                except Exception:
                    pass
                _wait_assets(page)
                out = os.path.join(temp_dir, f"page_{i:03d}.pdf")
                _print_pdf(page, out)
                page.close()
                files.append(out)
                print(f"[PDF Generator] Page {i + 1}/{len(pages)} rendered ({os.path.getsize(out)} bytes)")
            ctx.close()
        finally:
            browser.close()
            trim_memory()
    return files


def _merge(files: List[str], output_path: str):
    import pypdf
    writer = pypdf.PdfWriter()
    for f in files:
        writer.append(f)
    with open(output_path, "wb") as fh:
        writer.write(fh)
    writer.close()


# --------------------------------------------------------------------------- public API

def render_html_to_pdf(html_content: str, output_path: str) -> bool:
    """Render HTML from build_newspaper_html (or any HTML) to an A3 PDF."""
    if not _PDF_LOCK.acquire(timeout=180):
        print("[PDF Generator] Another PDF generation is active.")
        return False
    try:
        import tempfile
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
            if "np-cfg" in html_content:
                head, pages = _paginate(p, html_content)
                files = _render_pages(p, head, pages, tmp)
                _merge(files, output_path)
            else:
                browser = p.chromium.launch(**_launch_kwargs())
                page = browser.new_page(viewport=_VIEWPORT)
                page.set_content(html_content, wait_until="load", timeout=60000)
                _wait_assets(page)
                _print_pdf(page, output_path)
                browser.close()
        size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        print(f"[PDF Generator] PDF written: {output_path} ({size} bytes)")
        return size > 100
    except Exception as e:
        print(f"[PDF Generator] Rendering error: {e}")
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
    max_articles_per_chunk: int = 8,   # kept for backward compatibility (pagination is now automatic)
) -> bool:
    html = build_newspaper_html(
        publication_name=publication_name, logo_url=logo_url, edition_date=edition_date,
        articles=articles, lead_story_id=lead_story_id,
        advertisement_config=advertisement_config, edition_info=edition_info)
    return render_html_to_pdf(html, output_path)
