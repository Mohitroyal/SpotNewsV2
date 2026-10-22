// One place for every link we print or share. "ref" tells us which reporter's share brought the reader.
// Using Supabase edge function URL directly (rtiexpress.in is not configured).
export const SHARE_BASE = "https://rffrqokpnqoycpozrjuc.supabase.co/functions/v1/share-page";

export const newsLink = (postId: number | string, reporterSlug?: string) =>
  `${SHARE_BASE}/n/${postId}${reporterSlug ? `?ref=${encodeURIComponent(reporterSlug)}` : ""}`;

export const reporterLink = (slug: string) => `${SHARE_BASE}/r/${encodeURIComponent(slug)}`;

export const shareCaption = (headline: string, link: string) =>
  `📰 ${headline}\n\nపూర్తి వార్త యాప్‌లో చదవండి 👉 ${link}\n\nRTI Express Spot News 24x7 — మీ ఊరి వార్తలు, మీ చేతుల్లో`;

export const shortLink = (link: string) => link.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
