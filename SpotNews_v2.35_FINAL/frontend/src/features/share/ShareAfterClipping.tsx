// Bottom sheet shown to the reporter right after a clipping is generated (and in "My stories").
// Tabs: క్లిప్పింగ్ | రిపోర్టర్ కార్డ్ | స్టేటస్ (9:16)  →  WhatsApp · Instagram · Facebook · X · More
import { useEffect, useRef, useState } from "react";
import { ReporterCard, type ReporterCardData } from "./ReporterCard";
import { nodeToImage, shareImage, shareVideo, captureVideoFrame, type Channel } from "./shareImage";
import { newsLink, videoNewsLink, shareCaption } from "./links";
import "./shareSheet.css";

type Tab = "clipping" | "square" | "story";

export interface SharePostData {
  id: number | string;
  headline: string;
  place: string;
  date: string;
  clippingUrl: string;
  thumbUrl?: string;
  videoUrl?: string;
}

export function ShareAfterClipping(props: {
  post: SharePostData;
  reporter: ReporterCardData["reporter"] & { id: string; slug: string };
  onClose: () => void;
}) {
  const { post, reporter } = props;
  const link = newsLink(post.id, reporter.slug);
  const isVideo = Boolean(post.videoUrl);

  // Default to clipping tab so the generated clipping is immediately visible and shareable
  const [tab, setTab] = useState<Tab>("clipping");
  const [images, setImages] = useState<Partial<Record<Tab, string>>>(() => ({
    clipping: post.clippingUrl || "",
  }));
  const [videoThumb, setVideoThumb] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const squareRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);

  const cardData: ReporterCardData = {
    reporter,
    post: {
      headline: post.headline,
      place: post.place,
      date: post.date,
      thumbUrl: videoThumb || post.thumbUrl || post.clippingUrl,
    },
    link,
  };

  // build images / capture video frame
  useEffect(() => {
    let cancelled = false;

    // 1. Immediately ensure clipping is populated so user never waits
    if (post.clippingUrl) {
      setImages((prev) => ({ ...prev, clipping: post.clippingUrl }));
    }

    // 2. Video thumbnail capture in background
    if (post.videoUrl) {
      captureVideoFrame(post.videoUrl)
        .then((frame) => {
          if (frame && !cancelled) setVideoThumb(frame);
        })
        .catch((e) => console.warn("Could not extract frame from video:", e));
    }

    // 3. Render offscreen Reporter Card and Story Card independently without blocking clipping
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 250)); // let the QR inside the cards render
        if (cancelled) return;

        if (squareRef.current) {
          try {
            const square = await nodeToImage(squareRef.current);
            if (!cancelled && square) {
              setImages((prev) => ({ ...prev, square }));
            }
          } catch (err) {
            console.warn("Square card generation skipped:", err);
          }
        }

        if (storyRef.current) {
          try {
            const story = await nodeToImage(storyRef.current);
            if (!cancelled && story) {
              setImages((prev) => ({ ...prev, story }));
            }
          } catch (err) {
            console.warn("Story card generation skipped:", err);
          }
        }
      } catch (err) {
        console.error("Failed to render background share cards:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post.id, post.clippingUrl, post.videoUrl, link]);

  const go = async (channel: Channel) => {
    // 1. Video clipping share
    if (tab === "clipping" && post.videoUrl) {
      setBusy(true);
      setStatusMsg("వీడియో సిద్ధమవుతోంది...");
      try {
        await shareVideo({
          videoUrl: post.videoUrl,
          caption: shareCaption(post.headline, videoNewsLink(post.id, reporter.slug)),
          channel,
          postId: post.id,
          reporterId: reporter.id,
          onProgress: (msg) => setStatusMsg(msg),
        });
      } catch (err: any) {
        console.error("Video share error:", err);
        alert(`వీడియో షేర్ విఫలమైంది: ${err?.message || err}`);
      } finally {
        setBusy(false);
        setStatusMsg("");
      }
      return;
    }

    // 2. Image share (clipping image / reporter card / story card)
    const dataUrl = tab === "clipping" ? (post.clippingUrl || images.clipping) : images[tab];
    if (!dataUrl) {
      alert("కార్డ్ ఇంకా సిద్ధమవుతోంది, దయచేసి ఒక్క క్షణం ఆగండి");
      return;
    }
    setBusy(true);
    setStatusMsg("కార్డ్ సిద్ధమవుతోంది...");
    try {
      await shareImage({
        dataUrl,
        channel,
        caption: shareCaption(post.headline, link),
        postId: post.id,
        reporterId: reporter.id,
        kind: tab === "clipping" ? "clipping" : tab === "square" ? "reporter_card" : "story_card",
      });
    } catch (err: any) {
      console.error("Image share error:", err);
      alert(`షేర్ విఫలమైంది: ${err?.message || err}`);
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  const tabs: [Tab, string][] = [
    ["clipping", isVideo ? "🎥 వీడియో క్లిప్పింగ్" : "📰 క్లిప్పింగ్"],
    ["square", "🪪 రిపోర్టర్ కార్డ్"],
    ["story", "📱 స్టేటస్ (9:16)"],
  ];

  const currentPreviewImage = tab === "clipping" ? (post.clippingUrl || images.clipping) : images[tab];

  return (
    <div className="ss-backdrop" style={{ zIndex: 100005 }} onClick={props.onClose}>
      <div className="ss" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="ss-title" style={{ margin: 0 }}>
            {isVideo ? "🎬 వీడియో క్లిప్పింగ్ రెడీ — షేర్ చేయండి" : "✅ క్లిప్పింగ్ రెడీ — షేర్ చేయండి"}
          </div>
          <button
            onClick={props.onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="ss-tabs">
          {tabs.map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className={`ss-preview ss-${tab}`}>
          {tab === "clipping" && isVideo ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden relative">
              <video
                src={post.videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                MP4 వీడియో
              </div>
            </div>
          ) : currentPreviewImage ? (
            <img src={currentPreviewImage} alt="Clipping preview" className="w-full h-full object-contain" />
          ) : (
            <div className="ss-wait">తయారవుతోంది…</div>
          )}
        </div>

        {statusMsg && (
          <div className="text-center py-1.5 text-xs font-semibold text-[#015BB3] animate-pulse">
            ⏳ {statusMsg}
          </div>
        )}

        <div className="ss-apps">
          <button disabled={busy} onClick={() => go("whatsapp")} className="wa">
            WhatsApp
          </button>
          <button disabled={busy} onClick={() => go("instagram")} className="ig">
            Instagram
          </button>
          <button disabled={busy} onClick={() => go("facebook")} className="fb">
            Facebook
          </button>
          <button disabled={busy} onClick={() => go("x")} className="x">
            X
          </button>
          <button disabled={busy} onClick={() => go("other")} className="more">
            ఇంకా…
          </button>
        </div>
        {tab === "clipping" && isVideo ? (
          <div className="ss-note" style={{ color: "#015BB3", fontWeight: 600 }}>
            🎬 పూర్తి న్యూస్ వీడియో క్లిప్పింగ్ (MP4) మీ యాప్ ద్వారా డైరెక్ట్‌గా షేర్ అవుతుంది
          </div>
        ) : tab !== "clipping" ? (
          <div className="ss-note">
            కార్డ్‌లో మీ రేటింగ్, వార్త లింక్, QR కోడ్ ఉంటాయి — స్కాన్ చేస్తే యాప్‌లో వార్త తెరుచుకుంటుంది
          </div>
        ) : null}
        <button
          className="ss-link"
          onClick={() => {
            navigator.clipboard?.writeText(link);
            alert("లింక్ కాపీ అయింది!");
          }}
        >
          🔗 లింక్ కాపీ: {link.replace("https://", "")}
        </button>
      </div>
      {/* off-screen full-size cards used to make the images */}
      <ReporterCard ref={squareRef} data={cardData} format="square" />
      <ReporterCard ref={storyRef} data={cardData} format="story" />
    </div>
  );
}
