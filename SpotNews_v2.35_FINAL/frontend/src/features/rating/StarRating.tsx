// Readers rate a story 1–5 stars; the rating counts towards the reporter's average (Bayesian, see SQL view reporter_stats).
// Put it at the bottom of the story card / story page.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function StarRating({ postId, reporterName, compact }: { postId: number | string; reporterName: string; compact?: boolean }) {
  const [mine, setMine] = useState(0);
  const [hover, setHover] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("story_ratings").select("stars").eq("post_id", String(postId)).eq("user_id", user.id).maybeSingle();
      if (data) setMine(data.stars);
    })();
  }, [postId]);

  const rate = async (stars: number) => {
    const { error } = await supabase.rpc("rate_story", { p_post_id: postId, p_stars: stars });
    if (error) return setMsg(
      error.message.includes("login") ? "రేటింగ్ ఇవ్వడానికి లాగిన్ అవ్వండి" :
      error.message.includes("own") ? "మీ స్వంత వార్తకు రేటింగ్ ఇవ్వలేరు" : "మళ్లీ ప్రయత్నించండి"
    );
    setMine(stars); setMsg("ధన్యవాదాలు! మీ రేటింగ్ నమోదైంది");
  };

  if (compact) {
    // One short row that never makes the card taller than the screen
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: '"Noto Sans Telugu", sans-serif', padding: "2px 0" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: msg ? "#15803d" : "#5b6475", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "48%" }}>
          {msg || "ఈ వార్తకు రేటింగ్"}
        </span>
        <span onMouseLeave={() => setHover(0)} style={{ fontSize: 25, letterSpacing: 3, cursor: "pointer", userSelect: "none", lineHeight: 1 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} onMouseEnter={() => setHover(n)} onClick={(e) => { e.stopPropagation(); rate(n); }} style={{ color: n <= (hover || mine) ? "#f5a400" : "#cfd6e2" }}>★</span>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '"Noto Sans Telugu", sans-serif', textAlign: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#5b6475" }}>{reporterName} గారి ఈ వార్తకు మీ రేటింగ్</div>
      <div onMouseLeave={() => setHover(0)} style={{ fontSize: 36, letterSpacing: 6, cursor: "pointer", userSelect: "none" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} onMouseEnter={() => setHover(n)} onClick={() => rate(n)} style={{ color: n <= (hover || mine) ? "#f5a400" : "#d4d9e3" }}>★</span>
        ))}
      </div>
      {msg && <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>{msg}</div>}
    </div>
  );
}
