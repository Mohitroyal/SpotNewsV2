// One place for every link we print or share. "ref" tells us which reporter's share brought the reader.
export const SHARE_BASE = "https://rtiexpressnews.godaddysites.com";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.newscraft.mobile";

export const newsLink = (postId: number | string, reporterSlug?: string) =>
  `${SHARE_BASE}/?clipId=${postId}${reporterSlug ? `&ref=${encodeURIComponent(reporterSlug)}` : ""}`;

export const reporterLink = (slug: string) => `${SHARE_BASE}/?reporter=${encodeURIComponent(slug)}`;

export const shareCaption = (headline: string, link: string) =>
  `📰 ${headline}\n\nపూర్తి వార్త యాప్‌లో చదవండి 👉 ${link}\n\nRTI Express Spot News 24x7 — మీ ఊరి వార్తలు, మీ చేతుల్లో`;

export const shortLink = (link: string) => link.replace(/^https?:\/\//, "").replace(/\/$/, "");
