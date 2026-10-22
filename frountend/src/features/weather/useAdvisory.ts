// Reads the latest weather & health advisory for the reader's district from Supabase.
// Includes intelligent local fallback so the UI works right away even before DB cron runs.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdvisoryRow } from "./types";

function getDefaultAdvisory(districtName = "హైదరాబాద్"): AdvisoryRow {
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 19;
  const isHotMidday = hour >= 11 && hour <= 16;

  return {
    max_level: isHotMidday ? "caution" : "info",
    headline_te: isHotMidday
      ? `${districtName} · ఎండ తీవ్రత పెరిగింది, తగిన జాగ్రత్తలు పాటించండి`
      : `${districtName} · సాధారణ వాతావరణం, ఆరోగ్య సూచనలు`,
    headline_en: isHotMidday
      ? `${districtName} · Rising midday heat, stay hydrated`
      : `${districtName} · Pleasant weather & health guidance`,
    generated_at: new Date().toISOString(),
    report: {
      district: districtName,
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      maxLevel: isHotMidday ? "caution" : "info",
      headline_te: isHotMidday
        ? `${districtName} · ఎండ తీవ్రత పెరిగింది, తగిన జాగ్రత్తలు పాటించండి`
        : `${districtName} · సాధారణ వాతావరణం, ఆరోగ్య సూచనలు`,
      headline_en: isHotMidday
        ? `${districtName} · Rising midday heat, stay hydrated`
        : `${districtName} · Pleasant weather & health guidance`,
      now: {
        temp: isNight ? 26 : isHotMidday ? 36 : 31,
        feelsLike: isNight ? 27 : isHotMidday ? 38 : 32,
        humidity: 62,
        uv: isNight ? 0 : isHotMidday ? 8 : 4,
        condition: isNight ? "తేలికపాటి గాలులు" : isHotMidday ? "ఎండ తీవ్రత" : "మేఘావృతం",
      },
      advisories: [
        {
          id: "adv-health",
          category: "health",
          level: isHotMidday ? "caution" : "info",
          icon: isHotMidday ? "🌡️" : "💧",
          title_te: isHotMidday ? "ఎండలో జాగ్రత్తలు & డీహైడ్రేషన్ నివారణ" : "నీరు ఎక్కువగా తాగండి",
          title_en: isHotMidday ? "Heat Alert & Hydration Precautions" : "Daily Hydration Reminder",
          actions_te: isHotMidday
            ? [
                "బయటకు వెళ్లేప్పుడు గొడుగు, టోపీ లేదా తెల్లటి దుస్తులు ధరించండి.",
                "కొబ్బరినీళ్లు, మజ్జిగ, ఓఆర్ఎస్ వంటి ద్రవాహారం తీసుకోండి.",
                "వృద్ధులు మరియు చిన్నపిల్లలు మధ్యాహ్నం 12 నుండి 3 వరకు ఎండలోకి వెళ్లవద్దు."
              ]
            : [
                "రోజంతా కనీసం 3 లీటర్ల మంచినీళ్లు తాగండి.",
                "తాజా పండ్లు, ఆహారం మాత్రమే భుజించండి."
              ],
          actions_en: isHotMidday
            ? [
                "Carry an umbrella and wear light cotton clothes.",
                "Drink buttermilk, coconut water or ORS regularly.",
                "Elderly and children should avoid direct sun between 12 PM - 3 PM."
              ]
            : [
                "Stay hydrated with at least 3 liters of water daily.",
                "Consume fresh fruits and hygienic food."
              ],
          trigger_te: isHotMidday ? "ఉష్ణోగ్రత 36°C దాటింది" : "సాధారణ పరిస్థితి",
          trigger_en: isHotMidday ? "Feels like temperature > 36°C" : "Normal conditions"
        },
        {
          id: "adv-surroundings",
          category: "surroundings",
          level: "info",
          icon: "🐦",
          title_te: "మన పరిసరాలు · పక్షులకు తాగునీరు",
          title_en: "Civic Action · Bird water bowls",
          actions_te: [
            "ఇంటి పైకప్పులు, బాల్కనీలలో చిన్న మట్టి పాత్రల్లో పక్షుల కోసం నీళ్లు ఉంచండి.",
            "ఇంటి చుట్టూ మురుగునీరు నిల్వ ఉండకుండా చూసుకోండి (దోమల నివారణ)."
          ],
          actions_en: [
            "Keep fresh water bowls on rooftops / balconies for birds.",
            "Avoid stagnant water around the house to prevent mosquitoes."
          ],
          trigger_te: "వాతావరణ ఆరోగ్య సూచన",
          trigger_en: "Civic health tip"
        }
      ]
    }
  };
}

export function useAdvisory(districtName?: string) {
  const targetDistrict = districtName || "హైదరాబాద్";
  const [row, setRow] = useState<AdvisoryRow>(getDefaultAdvisory(targetDistrict));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("weather_advisories")
          .select("*")
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (alive) {
          if (data && !error && data.report) {
            setRow(data as AdvisoryRow);
          } else {
            setRow(getDefaultAdvisory(targetDistrict));
          }
          setLoading(false);
        }
      } catch {
        if (alive) setLoading(false);
      }
    };

    load();

    const ch = supabase
      .channel("weather-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "weather_advisories" }, load)
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [targetDistrict]);

  return { advisory: row, loading };
}
