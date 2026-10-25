import { useState } from "react";
import type { AdvisoryRow } from "./types";
import "./weather.css";
import type { WeatherData } from "@/services/weatherService";
import { getLastGoodCachedWeather, getWeatherInfo } from "@/services/weatherService";

const LEVEL_TE = { info: "సమాచారం", caution: "జాగ్రత్త", warning: "హెచ్చరిక", danger: "తీవ్ర హెచ్చరిక" } as const;
const LEVEL_EN = { info: "Info", caution: "Caution", warning: "Warning", danger: "Danger" } as const;
const CAT_TE = { health: "ఆరోగ్యం", safety: "భద్రత", surroundings: "మన పరిసరాలు" } as const;

const COND_TE: Record<string, string> = {
  "Clear sky": "స్పష్టమైన ఆకాశం",
  "Mainly clear": "తేలికపాటి మేఘాలు",
  "Partly cloudy": "పాక్షికంగా మేఘావృతం",
  "Cloudy / Overcast": "మేఘావృతం",
  "Cloud": "మేఘావృతం",
  "Fog": "పొగమంచు",
  "Drizzle": "చిరుజల్లులు",
  "Cloud with drizzle": "చిరుజల్లులు",
  "Rain": "వర్షం",
  "Snow": "మంచు",
  "Rain showers": "వర్షపు జల్లులు",
  "Sun with rain showers": "ఎండతో కూడిన వర్షం",
  "Moon with rain showers": "రాత్రి వర్షపు జల్లులు",
  "Thunderstorm": "ఉరుములతో కూడిన వర్షం",
  "Thunderstorm with hail": "వడగండ్ల వాన",
  "Hail with lightning": "వడగండ్లతో కూడిన ఉరుములు",
  "Cloud with sun": "తేలికపాటి ఎండ, మేఘాలు",
  "Cloud with moon": "రాత్రి పాక్షిక మేఘావృతం",
  "Cloudy": "మేఘావృతం",
  "Sun": "ఎండ",
  "Moon": "రాత్రి స్పష్టమైన ఆకాశం",
};

export function AdvisoryStrip({ row, onOpen }: { row: AdvisoryRow; onOpen: () => void }) {
  const top = row.report?.advisories?.[0] || { icon: "☀️" };
  const cached = getLastGoodCachedWeather();
  const info = cached ? getWeatherInfo(cached.weatherCode, cached.isDay) : null;
  return (
    <button className={`adv-strip lvl-${row.max_level || "info"}`} onClick={onOpen}>
      {info?.iconUrl ? (
        <img src={info.iconUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
      ) : (
        <span className="adv-strip-icon">{top.icon}</span>
      )}
      <span className="adv-strip-text">{row.headline_te}</span>
      <span className="adv-strip-go">›</span>
    </button>
  );
}

export function AdvisoryCard({
  row,
  onClose,
  liveWeather,
}: {
  row: AdvisoryRow;
  onClose?: () => void;
  liveWeather?: WeatherData | null;
}) {
  const [en, setEn] = useState(false);
  const r = row.report;

  // Use live weather if available, or fall back to cached live weather reading, or DB report
  const activeWeather: WeatherData | null =
    liveWeather !== undefined ? liveWeather : getLastGoodCachedWeather();

  const tempVal = activeWeather
    ? Math.round(activeWeather.temperature)
    : r.now.temp !== null && r.now.temp !== undefined
    ? Math.round(r.now.temp)
    : null;

  const feelsLikeVal = activeWeather
    ? Math.round(activeWeather.apparentTemperature)
    : r.now.feelsLike !== null && r.now.feelsLike !== undefined
    ? Math.round(r.now.feelsLike)
    : null;

  const humidityVal = activeWeather ? activeWeather.humidity : r.now.humidity ?? null;

  const info = activeWeather ? getWeatherInfo(activeWeather.weatherCode, activeWeather.isDay) : null;
  const conditionDisplay = info
    ? en
      ? info.label
      : COND_TE[info.label] || r.now.condition
    : r.now.condition;

  const share = async () => {
    const lines = (r.advisories || [])
      .filter((a) => a.category !== "surroundings")
      .slice(0, 2)
      .map(
        (a) =>
          `${a.icon} ${en ? a.title_en : a.title_te}\n• ${(en ? a.actions_en : a.actions_te).slice(0, 3).join("\n• ")}`
      );
    const text = `${en ? r.headline_en : r.headline_te}\n\n${lines.join("\n\n")}\n\n— RTI Express Spot News 24x7`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      alert("Advisory copied to clipboard!");
    }
  };

  return (
    <article className={`adv-card lvl-${row.max_level || "info"}`}>
      <header className="adv-head">
        <div>
          <div className="adv-kicker">
            {en ? "WEATHER & HEALTH ADVISORY" : "వాతావరణ ఆరోగ్య సూచనలు"} · {r.district}
          </div>
          <div className="adv-badge">{en ? LEVEL_EN[row.max_level] : LEVEL_TE[row.max_level]}</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="adv-lang" onClick={() => setEn(!en)}>
            {en ? "తెలుగు" : "English"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                cursor: "pointer",
                fontWeight: 900
              }}
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <section className="adv-now">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {info?.iconUrl && (
            <img
              src={info.iconUrl}
              alt={info.label}
              style={{ width: "46px", height: "46px", objectFit: "contain", flexShrink: 0 }}
              draggable={false}
            />
          )}
          <div className="adv-temp">{tempVal !== null ? `${tempVal}°` : "–°"}</div>
        </div>
        <div className="adv-meta">
          <div>
            {en ? "Feels like" : "అనుభూతి"} {feelsLikeVal !== null ? `${feelsLikeVal}°` : "–°"}
          </div>
          <div>💧 {humidityVal !== null ? `${humidityVal}%` : "–%"} · UV {r.now.uv ?? "–"}</div>
          <div className="adv-cond">{conditionDisplay}</div>
        </div>
      </section>

      <section className="adv-list">
        {(r.advisories || []).map((a) => (
          <div key={a.id} className={`adv-item lvl-${a.level} cat-${a.category}`}>
            <div className="adv-item-head">
              <span className="adv-ico">{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="adv-cat">{en ? a.category.toUpperCase() : CAT_TE[a.category]}</div>
                <div className="adv-title">{en ? a.title_en : a.title_te}</div>
                {(en ? a.trigger_en : a.trigger_te) && (
                  <div className="adv-trigger">{en ? a.trigger_en : a.trigger_te}</div>
                )}
              </div>
            </div>
            <ul>
              {(en ? a.actions_en : a.actions_te).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <footer className="adv-foot">
        <span>
          {en ? "Updated" : "అప్‌డేట్"}{" "}
          {new Date(row.generated_at).toLocaleTimeString("te-IN", { hour: "numeric", minute: "2-digit" })} · RTI Spot News
        </span>
        <button className="adv-share" onClick={share}>
          <span>📱</span> {en ? "Share" : "షేర్ చేయండి"}
        </button>
      </footer>
    </article>
  );
}
