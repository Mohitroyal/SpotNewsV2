// Supabase Edge Function: share-page
// Redirects directly into the Spot News app via Android Intent
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
);
const PACKAGE = "com.newscraft.mobile";
const FALLBACK_DOMAIN = "https://news-frount.vercel.app";

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const m = u.pathname.match(/\/(n|r)\/([^/]+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  const [, kind, id] = m;

  // Best effort link open logging
  db.from("link_opens").insert({
    path: `/${kind}/${id}`,
    ref: u.searchParams.get("ref"),
    user_agent: req.headers.get("user-agent"),
    opened_in: "web"
  }).then(() => {});

  const fallbackUrl = `${FALLBACK_DOMAIN}/preview/${id}`;
  const userAgent = req.headers.get("user-agent") || "";
  const isAndroid = /Android/i.test(userAgent);

  if (isAndroid) {
    // Direct Android Intent to open the Spot News feed directly
    const intentUrl = `intent://feed?clipId=${id}#Intent;scheme=spotnews;package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": intentUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // Desktop / iOS: redirect to Web preview
  return Response.redirect(fallbackUrl, 302);
});
