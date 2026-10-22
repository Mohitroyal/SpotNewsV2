// Readers rate a story 1–5 stars; the rating counts towards the reporter's average (Bayesian, see SQL view reporter_stats).
// Put it at the bottom of the story card / story page.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function StarRating({ postId, reporterName }: { postId: number; reporterName: string }) {
  const [mine, setMine] = useState(0);
  const [hover, setHover] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("story_ratings").select("stars").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
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

  return (
    <div style={{ fontFamily: '"Noto Sans Telugu", sans-serif', textAlign: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#5b6475" }}>{reporterName} గారి ఈ వార్తకు మీ రేటింగ్</div>
      <div onMouseLeave={() => setHover(0)} style={{ fontSize: 34, letterSpacing: 6, cursor: "pointer", userSelect: "none" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} onMouseEnter={() => setHover(n)} onClick={() => rate(n)} style={{ color: n <= (hover || mine) ? "#f5a400" : "#d4d9e3" }}>★</span>
        ))}
      </div>
      {msg && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#15803d" }}>{msg}</div>}
    </div>
  );
}
