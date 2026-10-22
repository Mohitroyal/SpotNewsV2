// Share an image (clipping or reporter card) straight to WhatsApp / Instagram / Facebook / X.
// Direct-to-app sharing uses the native TargetShare plugin.
// If that app is not installed (or on the web) it falls back to the normal share sheet.
import { toJpeg } from "html-to-image";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import { supabase } from "@/lib/supabase";

export type Channel = "whatsapp" | "instagram" | "facebook" | "x" | "other";

const PACKAGES: Record<Exclude<Channel, "other">, string> = {
  whatsapp: "com.whatsapp",
  instagram: "com.instagram.android",
  facebook: "com.facebook.katana",
  x: "com.twitter.android",
};

interface TargetSharePlugin {
  share(o: { package: string; fileUri: string; text: string; mime?: string }): Promise<{ ok: boolean }>;
}

const TargetShare = registerPlugin<TargetSharePlugin>("TargetShare");

/** Render an off-screen card element (ReporterCard) to a JPEG data URL at its real size (1080 px wide). */
export async function nodeToImage(node: HTMLElement) {
  await document.fonts.ready;
  return toJpeg(node, { quality: 0.93, pixelRatio: 1, cacheBust: true, style: { left: "0", position: "static" } });
}

async function saveToCache(dataUrl: string, name: string) {
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: dataUrl.split(",")[1],
    directory: Directory.Cache,
  });
  return uri;
}

export async function shareImage(o: {
  dataUrl: string;
  caption: string;
  channel: Channel;
  kind: "clipping" | "reporter_card" | "story_card";
  postId?: number | string;
  reporterId?: string;
}) {
  try {
    supabase
      .from("share_events")
      .insert({
        post_id: o.postId ? String(o.postId) : null,
        reporter_id: o.reporterId,
        channel: o.channel,
        kind: o.kind,
      })
      .then(() => {});
  } catch {
    /* ignore share event logging errors */
  }

  // Web / PWA fallback
  if (!Capacitor.isNativePlatform()) {
    try {
      const blob = await (await fetch(o.dataUrl)).blob();
      const file = new File([blob], "rti-express.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        return await navigator.share({ files: [file], text: o.caption });
      }
    } catch {
      /* continue to fallback */
    }
    const a = document.createElement("a");
    a.href = o.dataUrl;
    a.download = `rti-${o.kind}-${Date.now()}.jpg`;
    a.click();
    return;
  }

  const uri = await saveToCache(o.dataUrl, `rti_${o.kind}_${Date.now()}.jpg`);

  // Instagram ignores captions → copy the caption + link so the reporter can paste it
  if (o.channel === "instagram") {
    try {
      await Clipboard.write({ string: o.caption });
    } catch {}
  }

  if (o.channel !== "other") {
    try {
      await TargetShare.share({
        package: PACKAGES[o.channel],
        fileUri: uri,
        text: o.caption,
        mime: "image/jpeg",
      });
      return;
    } catch {
      /* app not installed → fallback to general share sheet */
    }
  }

  await Share.share({
    text: o.caption,
    files: [uri],
    dialogTitle: "షేర్ చేయండి",
  });
}

/** Capture a preview frame from a video URL via an off-screen video element + canvas */
export function captureVideoFrame(videoUrl: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";

      const timer = setTimeout(() => {
        cleanup();
        resolve("");
      }, 7000);

      const cleanup = () => {
        clearTimeout(timer);
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.src = "";
      };

      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
        } catch {
          cleanup();
          resolve("");
        }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
            cleanup();
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn("Video frame capture canvas error:", e);
        }
        cleanup();
        resolve("");
      };

      video.onerror = () => {
        cleanup();
        resolve("");
      };
    } catch {
      resolve("");
    }
  });
}

/**
 * Share a generated MP4 video directly to WhatsApp / Instagram / Facebook / X.
 * Automatically saves the video to native cache and uses TargetShare or Capacitor Share.
 */
export async function shareVideo(o: {
  videoUrl: string;
  caption: string;
  channel: Channel;
  postId?: number | string;
  reporterId?: string;
  onProgress?: (status: string) => void;
}) {
  try {
    supabase
      .from("share_events")
      .insert({
        post_id: o.postId ? String(o.postId) : null,
        reporter_id: o.reporterId,
        channel: o.channel,
        kind: "clipping_video",
      })
      .then(() => {});
  } catch {
    /* ignore share event logging errors */
  }

  // Web / PWA fallback
  if (!Capacitor.isNativePlatform()) {
    try {
      o.onProgress?.("వీడియో డౌన్‌లోడ్ అవుతోంది...");
      const res = await fetch(o.videoUrl);
      const blob = await res.blob();
      const file = new File([blob], `rti-video-${o.postId || Date.now()}.mp4`, { type: "video/mp4" });
      if (navigator.canShare?.({ files: [file] })) {
        return await navigator.share({ files: [file], text: o.caption });
      }
    } catch {
      /* continue to download fallback */
    }
    const a = document.createElement("a");
    a.href = o.videoUrl;
    a.download = `rti-video-${o.postId || Date.now()}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Native Android / iOS
  o.onProgress?.("వీడియో సిద్ధమవుతోంది...");
  const fileName = `rti_video_${o.postId || Date.now()}.mp4`;
  let fileUri = "";

  try {
    const dlResult = await Filesystem.downloadFile({
      url: o.videoUrl,
      path: fileName,
      directory: Directory.Cache,
    });
    fileUri = dlResult.path || "";
  } catch (dlErr) {
    console.warn("Filesystem.downloadFile failed, fallback to fetch blob:", dlErr);
    const res = await fetch(o.videoUrl);
    const blob = await res.blob();
    const base64data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const writeRes = await Filesystem.writeFile({
      path: fileName,
      data: base64data,
      directory: Directory.Cache,
    });
    fileUri = writeRes.uri;
  }

  if (!fileUri) {
    throw new Error("Could not prepare video file for sharing.");
  }

  // Instagram ignores text captions in send intent → copy to clipboard
  if (o.channel === "instagram") {
    try {
      await Clipboard.write({ string: o.caption });
    } catch {}
  }

  // Direct package sharing if requested
  if (o.channel !== "other") {
    try {
      await TargetShare.share({
        package: PACKAGES[o.channel],
        fileUri: fileUri,
        text: o.caption,
        mime: "video/mp4",
      });
      return;
    } catch (e) {
      console.warn("TargetShare failed or app not installed, using system share:", e);
    }
  }

  // Default native share sheet
  await Share.share({
    text: o.caption,
    files: [fileUri],
    dialogTitle: "వీడియో షేర్ చేయండి",
  });
}
