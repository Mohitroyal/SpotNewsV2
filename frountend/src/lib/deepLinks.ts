// Opens shared links inside the app.
// Handles:
//   https://rtiexpressnews.godaddysites.com/?clipId=<id>  →  news story
//   https://rtiexpressnews.godaddysites.com/n/<id>        →  news story
//   spotnews://feed?clipId=<id>                           →  news story
//   newscraft://feed?clipId=<id>                          →  news story
// Logs every open to link_opens table for attribution tracking.
import { App } from "@capacitor/app";
import { supabase } from "@/lib/supabase";

export function initDeepLinks(navigate: (path: string) => void) {
  const handleUrl = (url: string) => {
    try {
      let clipId: string | null = null;

      // 1. Check query parameter: ?clipId=123, ?id=123, ?n=123
      const paramMatch = url.match(/[?&](?:clipId|id|n)=([^&#]+)/i);
      if (paramMatch) {
        clipId = decodeURIComponent(paramMatch[1]);
      } else {
        // 2. Check path pattern: /n/123, /preview/123, /clip/123
        const pathMatch = url.match(/(?:spotnews:\/\/|newscraft:\/\/|\/)(?:n|preview|clip)\/([^/?#]+)/i);
        if (pathMatch) clipId = decodeURIComponent(pathMatch[1]);
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

      // Reporter profile check
      const repQueryMatch = url.match(/[?&]reporter=([^&#]+)/i);
      const repPathMatch = url.match(/(?:spotnews:\/\/|newscraft:\/\/|\/)r\/([^/?#]+)/i);
      const repSlug = repQueryMatch ? decodeURIComponent(repQueryMatch[1]) : (repPathMatch ? decodeURIComponent(repPathMatch[1]) : null);

      if (repSlug) {
        navigate(`/reporter/${repSlug}`);
      }
    } catch { /* ignore bad links */ }
  };

  // 1. Handle runtime incoming URL (when app is already open or backgrounded)
  const listenerPromise = App.addListener("appUrlOpen", ({ url }) => {
    handleUrl(url);
  });

  // 2. Handle cold start launch URL (when app was closed and opened directly via link)
  App.getLaunchUrl().then((launchUrl) => {
    if (launchUrl && launchUrl.url) {
      handleUrl(launchUrl.url);
    }
  }).catch(() => {});

  return () => {
    listenerPromise.then((handle) => handle.remove()).catch(() => {});
  };
}
