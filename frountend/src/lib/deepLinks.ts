// Opens shared links inside the app.
// Handles both:
//   https://rffrqokpnqoycpozrjuc.supabase.co/functions/v1/share-page/n/<id>  →  news story
//   https://rffrqokpnqoycpozrjuc.supabase.co/functions/v1/share-page/r/<slug>  →  reporter profile
//   spotnews://n/<id>  →  news story (custom scheme fallback)
// Logs every open to link_opens table for attribution tracking.
import { App } from "@capacitor/app";
import { supabase } from "@/lib/supabase";

export function initDeepLinks(navigate: (path: string) => void) {
  App.addListener("appUrlOpen", ({ url }) => {
    try {
      // Check query param first (e.g. spotnews://feed?clipId=...)
      let clipId: string | null = null;
      const paramMatch = url.match(/[?&]clipId=([^&#]+)/);
      if (paramMatch) {
        clipId = paramMatch[1];
      } else {
        const pathMatch = url.match(/(?:spotnews:\/\/|\/)(n|preview)\/([^/?#]+)/i);
        if (pathMatch) clipId = pathMatch[2];
      }

      if (clipId) {
        supabase.from("link_opens").insert({
          path: `/n/${clipId}`,
          opened_in: "app"
        }).then(() => {});

        // Redirect directly to Feed with the clipping
        navigate(`/?clipId=${clipId}`);
        return;
      }

      const repMatch = url.match(/(?:spotnews:\/\/|\/)r\/([^/?#]+)/i);
      if (repMatch) {
        navigate(`/reporter/${repMatch[1]}`);
      }
    } catch { /* ignore bad links */ }
  });
}
