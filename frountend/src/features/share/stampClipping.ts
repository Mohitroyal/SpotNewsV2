// Adds the "read in app" footer (QR + link) to every generated clipping, before it is saved or shared.
//   Requires: npm i qrcode  (already added via @types/qrcode)
// Call it right after your existing clipping generator produces the image:
//   const stamped = await stampClipping(clippingDataUrl, newsLink(post.id, reporter.slug));
import QRCode from "qrcode";
import { shortLink } from "./links";
import rtiLogo from "@/assets/rti_express_logo.png";

const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => {
  const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = fail; im.src = src;
});

export async function stampClipping(clippingSrc: string, link: string, logoSrc = rtiLogo): Promise<string> {
  await document.fonts.ready;
  const clip = await loadImage(clippingSrc);
  const W = clip.naturalWidth, band = Math.round(W * 0.19), pad = Math.round(W * 0.025);
  const c = document.createElement("canvas");
  c.width = W; c.height = clip.naturalHeight + band;
  const g = c.getContext("2d")!;
  g.drawImage(clip, 0, 0);

  // footer band
  g.fillStyle = "#0e2a66"; g.fillRect(0, clip.naturalHeight, W, band);
  const y0 = clip.naturalHeight;

  // QR (white box)
  const qrSize = band - pad * 2;
  const qr = await loadImage(await QRCode.toDataURL(link, { margin: 1, width: qrSize * 2, errorCorrectionLevel: "M" }));
  g.fillStyle = "#fff"; g.fillRect(pad, y0 + pad, qrSize, qrSize);
  g.drawImage(qr, pad, y0 + pad, qrSize, qrSize);

  // text (Telugu renders with the system Noto Sans Telugu on Android)
  const tx = pad * 2 + qrSize, fs = Math.round(W * 0.03);
  g.textBaseline = "top";
  g.fillStyle = "#ffffff"; g.font = `900 ${fs}px "Noto Sans Telugu", sans-serif`;
  g.fillText("పూర్తి వార్త, మరిన్ని లోకల్ వార్తలు — యాప్‌లో చదవండి", tx, y0 + pad, W - tx - pad * 6);
  g.fillStyle = "#ffd43b"; g.font = `800 ${Math.round(fs * 0.9)}px "Noto Sans Telugu", sans-serif`;
  g.fillText(`🔗 ${shortLink(link)}`, tx, y0 + pad + fs * 1.6, W - tx - pad * 6);
  g.fillStyle = "rgba(255,255,255,.9)"; g.font = `700 ${Math.round(fs * 0.68)}px "Noto Sans Telugu", sans-serif`;
  g.fillText("Spot News 24x7 · QR స్కాన్ చేయండి · Google Play లో లభ్యం", tx, y0 + pad + fs * 3.0, W - tx - pad * 6);

  // logo on the right
  try {
    const logo = await loadImage(logoSrc);
    const ls = Math.round(band * 0.62);
    g.drawImage(logo, W - pad - ls, y0 + (band - ls) / 2, ls, ls);
  } catch { /* logo optional */ }

  return c.toDataURL("image/jpeg", 0.92);
}
