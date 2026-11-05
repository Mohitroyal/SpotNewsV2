// One place for every link we print or share. "ref" tells us which reporter's share brought the reader.
//
// Share links are short: https://spotnewsv2.onrender.com/n/<22-letter code>
// That page (already on the Django backend) shows the WhatsApp preview, opens the app if it
// is installed, and otherwise sends the reader to the Play Store to download it.
// To use your own domain or the Vercel page (share-landing/), set VITE_SHARE_BASE.
import { shortenId } from "./shortId";

const ENV_BASE = (import.meta.env.VITE_SHARE_BASE as string | undefined)?.trim().replace(/\/$/, '');
export const SHARE_BASE = ENV_BASE || "https://spotnewsv2.onrender.com";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.newscraft.mobile";

const isLegacyBase = SHARE_BASE.includes("godaddysites.com");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const newsLink = (postId: number | string, _reporterSlug?: string) => {
  if (isLegacyBase) return `${SHARE_BASE}/?clipId=${postId}`;
  return `${SHARE_BASE}/n/${shortenId(String(postId))}`;
};

export const reporterLink = (slug: string) =>
  isLegacyBase
    ? `${SHARE_BASE}/?reporter=${encodeURIComponent(slug)}`
    : `${SHARE_BASE}/r/${encodeURIComponent(slug)}`;

export const shareCaption = (headline: string, link: string) =>
  `${headline}\n\n📲 పూర్తి వార్త చదవండి: ${link}\n\nRTI Express Spot News 24x7`;

export const shortLink = (link: string) => link.replace(/^https?:\/\//, "").replace(/\/$/, "");
