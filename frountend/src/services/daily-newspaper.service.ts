import { supabase } from '@/lib/supabase';
import api from '@/lib/axios';
import axios from 'axios';

export interface EligibleArticle {
  id: string;
  headline: string;
  summary: string;
  content: string;
  kicker?: string;
  subheadline?: string;
  image_url?: string;
  image_urls?: string[];
  highlight_list?: string[];
  created_at?: string;
  published_at?: string;
  user_id?: string;
  reporter_name?: string;
  state?: string;
  district?: string;
  location?: string;
  custom_excerpt?: string;
  has_overflow?: boolean;
}

export interface DailyEditionRecord {
  id: string;
  edition_date: string;
  publication_code: string;
  publication_name: string;
  logo_url: string;
  page_count: number;
  article_count: number;
  status: string;
  pdf_url: string;
  version: number;
  created_at: string;
}

export interface DailyNewspaperConfig {
  publication_code: string;
  publication_name: string;
  logo_url: string;
  edition_date: string;
  articles: EligibleArticle[];
  lead_story_id?: string;
  advertisement_config?: {
    image_url?: string;
    title?: string;
    phone?: string;
  };
  edition_info?: {
    edition_no?: string;
    issue_no?: string;
    editor_name?: string;
    price?: string;
    location?: string;
  };
  overwrite_existing?: boolean;
}

/** Fetch a remote image and return it as a base64 data URI so it renders inside blob URLs (no CORS block). */
async function toBase64DataUri(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // fallback to original URL
  }
}

export async function generateClientSidePreviewHtml(config: DailyNewspaperConfig): Promise<{ html: string; total_pages: number; total_articles: number }> {
  const articles = config.articles || [];
  const totalArticles = articles.length;
  const totalPages = Math.max(1, Math.ceil(totalArticles / 9));
  const pubName = config.publication_name || 'RTI Express';
  const logoUrl = config.logo_url || '';
  const dateStr = config.edition_date || new Date().toISOString().split('T')[0];

  const logoBase64 = logoUrl ? await toBase64DataUri(logoUrl) : '';

  const imageBase64Map: Record<string, string> = {};
  await Promise.all(
    articles.map(async (art) => {
      const imgUrl = art.image_url || (Array.isArray(art.image_urls) && art.image_urls[0]) || '';
      if (imgUrl && !imageBase64Map[imgUrl]) {
        imageBase64Map[imgUrl] = await toBase64DataUri(imgUrl);
      }
    })
  );

  const headlineColors = ["#D60000", "#003399", "#8B0055", "#006600", "#111111"];
  const editionNo = config.edition_info?.edition_no || "01";
  const issueNo = config.edition_info?.issue_no || "266";
  const editorName = config.edition_info?.editor_name || "స్పాట్ న్యూస్";
  const price = config.edition_info?.price || "రూ. 1.50/-";
  const location = config.edition_info?.location || "హైదరాబాద్ / ఆంధ్రప్రదేశ్ & తెలంగాణ";

  let adHtml = "";
  if (config.advertisement_config?.image_url) {
    const adBase64 = await toBase64DataUri(config.advertisement_config.image_url);
    adHtml = `
      <div style="width: 28%; padding-left: 10px; text-align: center;">
          <img src="${adBase64}" style="max-height: 85px; max-width: 100%; border: 1px solid #ccc; padding: 2px;" />
      </div>
    `;
  }


  const articlesPerPage = 5;
  // totalPages is already declared at line 83, we just update it if needed, or remove this redeclaration.
  // Wait, let's just use totalPages from line 83!
  
  let pagesHtml = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const startIdx = (pageNum - 1) * articlesPerPage;
    const pageArticles = articles.slice(startIdx, startIdx + articlesPerPage);

    // Find lead article index for this page
    let leadIdx = 0;
    if (pageNum === 1 && config.lead_story_id) {
      const li = pageArticles.findIndex((a) => String(a.id) === String(config.lead_story_id));
      if (li !== -1) leadIdx = li;
    }

    const buildCard = (art: any, isLead: boolean, isSide: boolean) => {
      const headline = art.headline || art.title || 'శీర్షిక';
      const kicker = art.kicker || '';
      const content = art.custom_excerpt || art.content || art.summary || '';
      const reporter = art.reporter_name || 'రిపోర్టర్';
      const loc = art.location || art.district || 'హైదరాబాద్';
      const rawImgUrl = art.image_url || (Array.isArray(art.image_urls) && art.image_urls[0]) || '';
      const imgSrc = rawImgUrl ? (imageBase64Map[rawImgUrl] || rawImgUrl) : '';
      
      const colorIdx = pageArticles.indexOf(art) % headlineColors.length;
      const titleColor = isLead ? '#D60000' : headlineColors[colorIdx];
      const imgHeight = isLead ? '350px' : isSide ? '180px' : '200px';
      const headingSize = isLead ? '28px' : isSide ? '16px' : '18px';
      
      // Limit content length strictly to avoid white spaces and overflow
      const contentLimit = isLead ? 1200 : isSide ? 400 : 500;
      const borderStyle = isLead 
        ? `border-top: 3px solid ${titleColor}; background: #fffcf5;` 
        : `border-top: 2px solid ${titleColor}; background: #fff;`;

      return `
        <div class="article-cell" style="${borderStyle} padding: ${isLead ? '12px' : '10px'}; border: 1px solid #ddd; box-sizing: border-box; display: flex; flex-direction: column; height: 100%; overflow: hidden;">
          ${kicker ? `<div style="font-size: 11px; font-weight: 800; color: #D60000; text-transform: uppercase; margin-bottom: 4px;">${kicker}</div>` : ''}
          <h2 style="font-size: ${headingSize}; font-weight: 900; color: ${titleColor}; margin: 0 0 6px 0; line-height: 1.25;">${headline}</h2>
          ${imgSrc ? `<div style="margin: 6px 0;"><img src="${imgSrc}" style="width: 100%; height: ${imgHeight}; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none'" /></div>` : ''}
          <div style="font-size: 11px; font-weight: bold; color: #555; border-bottom: 1px dashed #ccc; padding-bottom: 4px; margin-bottom: 6px;">${loc} &nbsp;|&nbsp; ${reporter}</div>
          ${content ? `<div style="font-size: 13px; line-height: 1.55; color: #222; text-align: justify; flex: 1;">${content.slice(0, contentLimit)}${content.length > contentLimit ? '...' : ''}</div>` : ''}
        </div>`;
    };

    const leadArt = pageArticles[leadIdx];
    const sideArts = pageArticles.filter((_, i) => i !== leadIdx).slice(0, 2);
    const gridArts = pageArticles.filter((_, i) => i !== leadIdx).slice(2);

    const leadHtml = leadArt ? buildCard(leadArt, true, false) : '';
    const sideHtml = sideArts.map((a) => buildCard(a, false, true)).join('');
    const gridHtml = gridArts.map((a) => buildCard(a, false, false)).join('');

    const logoTag = logoBase64
      ? `<img src="${logoBase64}" alt="${pubName}" style="max-height: 90px; max-width: 250px; object-fit: contain;" />`
      : `<span style="font-size: 32px; font-weight: 900; color: #003399;">${pubName}</span>`;

    const headerHtml = pageNum === 1 ? `
      <div style="background: #fff; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #FFD700;">
        <div>${logoTag}</div>
        ${adHtml}
      </div>
      <div style="background: #006633; color: #fff; font-size: 13px; font-weight: bold; padding: 6px 15px; display: flex; justify-content: space-between;">
        <span>సంపుటి: ${editionNo} &nbsp;|&nbsp; సంచిక: ${issueNo} &nbsp;|&nbsp; ఎడిటర్: ${editorName}</span>
        <span style="color: #FFD700;">పేజీలు: ${totalPages} &nbsp;|&nbsp; వెల: ${price}</span>
        <span>${dateStr} &nbsp;|&nbsp; ${location}</span>
      </div>
    ` : `
      <div style="background: #003399; color: #fff; padding: 6px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #FFD700;">
        <span style="font-size: 18px; font-weight: 900;">${pubName} — దినపత్రిక</span>
        <span style="font-size: 14px; font-weight: bold;">జనరల్ న్యూస్ &nbsp;|&nbsp; ${dateStr} &nbsp;|&nbsp; Page ${pageNum} of ${totalPages}</span>
      </div>
    `;

    // Force exact A3 proportions (1122 x 1587) using min-height so pages perfectly fill A3 PDFs
    pagesHtml += `
      <div class="pdf-page" style="width: 297mm; height: 420mm; background: #fff; margin: 0 auto; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #ccc; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        ${headerHtml}
        
        <div style="flex: 1; display: flex; flex-direction: column; padding: 10px;">
            <!-- Top section: lead (2/3 width) + side stack (1/3 width) -->
            ${(leadHtml || sideHtml) ? `
            <div style="display: grid; grid-template-columns: 2.2fr 1fr; gap: 10px; margin-bottom: 10px; flex: 1;">
              ${leadHtml}
              <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
                  ${sideHtml}
              </div>
            </div>` : ''}
            
            <!-- Bottom grid: remaining articles -->
            ${gridArts.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(${Math.max(1, gridArts.length)}, 1fr); gap: 10px; flex: 0.8;">
              ${gridHtml}
            </div>` : ''}
        </div>

        <!-- Footer -->
        <div style="border-top: 2px solid #000; padding: 6px 15px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #333; margin-top: auto;">
          <span>${pubName} — TELUGU DAILY</span>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span style="display: inline-block; width: 12px; height: 12px; background: #00ffff;"></span>
            <span style="display: inline-block; width: 12px; height: 12px; background: #ff00ff;"></span>
            <span style="display: inline-block; width: 12px; height: 12px; background: #ffff00;"></span>
            <span style="display: inline-block; width: 12px; height: 12px; background: #000;"></span>
          </div>
          <span>PAGE ${pageNum} OF ${totalPages}</span>
        </div>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1122, initial-scale=1.0">
    <title>${pubName} - ${dateStr}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        html, body {
            background: #f0f0f0;
            color: #000000;
            font-family: 'Noto Serif Telugu', serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .pdf-page {
            break-after: page;
        }
    </style>
</head>
    ${pagesHtml}
    <script>
      // Automatically open the browser print dialog so user can Save as PDF
      window.onload = function() {
        setTimeout(function() { window.print(); }, 1500);
      };
    </script>
</body>
</html>`;

  return { html, total_pages: totalPages, total_articles: totalArticles };
}

const getDjangoClient = () => {
  const djangoUrl = import.meta.env.VITE_DJANGO_API_URL || import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com';
  const instance = axios.create({
    baseURL: djangoUrl,
    headers: { "Content-Type": "application/json" }
  });

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("newscraft-auth");
    if (raw) {
      try {
        const { state } = JSON.parse(raw);
        if (state?.token) {
          instance.defaults.headers.common.Authorization = `Bearer ${state.token}`;
        }
      } catch {}
    }
  }
  return instance;
};

export const dailyNewspaperService = {
  /**
   * Fetch all clippings generated on the given date from Supabase,
   * including headline, image_url, image_urls, content, reporter name.
   */
  async getEligibleClippings(dateStr: string): Promise<{ total: number; articles: EligibleArticle[] }> {
    // 1. Try Backend API
    try {
      const client = getDjangoClient();
      const res = await client.get('/api/v1/admin/daily-newspaper/clippings', { params: { date: dateStr } });
      if (res.data && Array.isArray(res.data.articles) && res.data.articles.length > 0) {
        return { total: res.data.total_eligible ?? res.data.articles.length, articles: res.data.articles };
      }
    } catch (err) {
      console.warn('[DailyNewspaper] Backend unavailable:', err);
    }

    // 2. Direct Supabase — all clippings created on this date (IST-aware)
    try {
      // Convert IST date to UTC — Supabase stores in UTC, must query in UTC
      // IST is UTC+5:30, so IST midnight = UTC 18:30 of previous day
      const startUTC = new Date(`${dateStr}T00:00:00+05:30`).toISOString();
      const endUTC   = new Date(`${dateStr}T23:59:59+05:30`).toISOString();

      let { data: clippings } = await supabase
        .from('clippings')
        .select('id, user_id, headline, subheadline, kicker, content, image_url, image_urls, highlight_list, created_at, reporter_name, district, location, state, status')
        .gte('created_at', startUTC)
        .lte('created_at', endUTC)
        .not('status', 'eq', 'draft')
        .not('status', 'eq', 'rejected')
        .order('created_at', { ascending: false })
        .limit(200);

      let clippingsList: any[] = clippings || [];

      // Fallback to recent if nothing found for that date
      if (clippingsList.length === 0) {
        const { data: recent } = await supabase
          .from('clippings')
          .select('id, user_id, headline, subheadline, kicker, content, image_url, image_urls, highlight_list, created_at, reporter_name, district, location, state, status')
          .not('status', 'eq', 'draft')
          .not('status', 'eq', 'rejected')
          .order('created_at', { ascending: false })
          .limit(100);
        clippingsList = recent || [];
      }

      // Enrich with reporter full names from profiles
      const userIds = Array.from(new Set(clippingsList.map((c: any) => c.user_id).filter(Boolean)));
      const profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      const articles: EligibleArticle[] = clippingsList.map((c: any) => {
        const prof = profileMap[c.user_id] || {};
        return {
          id: c.id,
          headline: c.headline || 'శీర్షిక లేదు',
          summary: c.summary || c.content || '',
          content: c.content || c.summary || '',
          kicker: c.kicker || '',
          subheadline: c.subheadline || '',
          image_url: c.image_url || (Array.isArray(c.image_urls) ? c.image_urls[0] : ''),
          image_urls: Array.isArray(c.image_urls) ? c.image_urls : (c.image_url ? [c.image_url] : []),
          highlight_list: Array.isArray(c.highlight_list) ? c.highlight_list : [],
          created_at: c.created_at || '',
          published_at: c.published_at || c.created_at || '',
          user_id: c.user_id || '',
          reporter_name: c.reporter_name || prof.full_name || prof.email?.split('@')[0] || 'రిపోర్టర్',
          district: c.district || '',
          location: c.location || c.district || 'హైదరాబాద్',
          state: c.state || '',
        };
      });

      return { total: articles.length, articles };
    } catch (err) {
      console.error('[DailyNewspaper] Supabase error:', err);
      return { total: 0, articles: [] };
    }
  },

  async preview(config: DailyNewspaperConfig): Promise<{ html: string; total_pages: number; total_articles: number }> {
    try {
      const client = getDjangoClient();
      const res = await client.post('/api/v1/admin/daily-newspaper/preview', config);
      return res.data;
    } catch {
      try {
        const res = await api.post('/api/v1/admin/daily-newspaper/preview', config);
        return res.data;
      } catch {
        return generateClientSidePreviewHtml(config);
      }
    }
  },

  async generate(config: DailyNewspaperConfig): Promise<{
    success: boolean;
    edition_id: string;
    pdf_url: string;
    total_pages: number;
    total_articles: number;
    message: string;
  }> {
    try {
      const preview = await generateClientSidePreviewHtml(config);
      
      // Use an iframe instead of a div because injecting full HTML into a div strips the <style> and <head> tags!
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed'; // Keep in viewport so Capacitor doesn't cull it
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '297mm';
      iframe.style.height = '100vh';
      iframe.style.opacity = '0.01'; // Almost invisible but tricks WebView into painting it
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error("Iframe not initialized");
      
      doc.open();
      doc.write(preview.html);
      doc.close();

      // Wait a moment for layout and images to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0,
        filename: `DailyNewspaper-${config.edition_date}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 1122 }, // 1122px approx 297mm
        jsPDF: { unit: 'mm', format: 'a3', orientation: 'portrait' as const }
      };

      const pdfBlob = await html2pdf().set(opt).from(doc.body).output('blob');
      const pdfBlobUrl = URL.createObjectURL(pdfBlob);
      
      document.body.removeChild(iframe);

      return {
        success: true,
        edition_id: `edition-${Date.now()}`,
        pdf_url: pdfBlobUrl,
        total_pages: preview.total_pages,
        total_articles: preview.total_articles,
        message: `Generated local PDF successfully.`,
      };
    } catch (err: any) {
      console.error('Local PDF Generation Error:', err);
      throw new Error(err.message || 'Failed to generate PDF locally');
    }
  },

  async getDailyEditions(): Promise<DailyEditionRecord[]> {
    try {
      const client = getDjangoClient();
      const res = await client.get('/api/v1/admin/daily-newspaper/editions');
      if (Array.isArray(res.data)) return res.data;
    } catch {
      console.warn('[DailyNewspaper] Backend editions unavailable.');
    }

    try {
      const { data, error } = await supabase
        .from('daily_editions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((d: any) => ({
          id: d.id,
          edition_date: d.edition_date,
          publication_code: d.publication_code,
          publication_name: d.publication_name,
          logo_url: d.logo_url,
          page_count: d.page_count || 1,
          article_count: d.article_count || 0,
          status: d.status || 'completed',
          pdf_url: d.pdf_url || '',
          version: d.version || 1,
          created_at: d.created_at || '',
        }));
      }
    } catch (err) {
      console.error('[DailyNewspaper] Supabase editions error:', err);
    }

    return [];
  },
};
