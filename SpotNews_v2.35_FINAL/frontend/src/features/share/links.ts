// One place for every link we print or share.
//
// Shared clipping links use the official GoDaddy domain:
// https://rtiexpressnews.godaddysites.com/?clipId=<id>&ref=<reporterSlug>
// When opened on a phone with the app installed, Android deep links open the story in the app.
// If the app is not installed, the domain landing page displays the clipping preview and download prompt.

export const SHARE_BASE = "https://rtiexpressnews.godaddysites.com";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.newscraft.mobile";

export const newsLink = (postId: number | string, reporterSlug?: string) => {
  const cleanId = String(postId || "").trim();
  const cleanRef = (reporterSlug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const refParam = cleanRef && cleanRef !== "reporter" && cleanRef !== "user" ? `&ref=${encodeURIComponent(cleanRef)}` : "";
  return `${SHARE_BASE}/?clipId=${encodeURIComponent(cleanId)}${refParam}`;
};

export const reporterLink = (slug: string) => {
  const clean = encodeURIComponent((slug || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""));
  return `${SHARE_BASE}/?reporter=${clean}`;
};

export const shareCaption = (headline: string, link: string) =>
  `${headline}\n\n📲 పూర్తి వార్త చదవండి: ${link}\n\nRTI Express Spot News 24x7`;

export const shortLink = (link: string) => link.replace(/^https?:\/\//, "").replace(/\/$/, "");
