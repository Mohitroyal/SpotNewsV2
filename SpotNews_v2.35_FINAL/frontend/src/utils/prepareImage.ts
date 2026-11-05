/**
 * prepareImage — one safe path for every reporter photo.
 *
 * Why: phone cameras produce 12–108 MP photos (5–30 MB). Uploading those raw
 * made uploads time out, and cropping them on a full-size canvas ran out of
 * memory inside the Android WebView (the "Processing…" button got stuck).
 *
 * This helper decodes the photo once, applies rotation / crop / black & white,
 * and returns a small JPEG (long edge ≤ 1600 px, usually 250–700 KB) that is
 * sharp enough for a printed-style clipping and uploads in a few seconds on 4G.
 */

export const PHOTO_MAX_EDGE = 1600;
export const PREVIEW_MAX_EDGE = 1280;
const TARGET_BYTES = 900 * 1024;

export type Rotation = 0 | 90 | 180 | 270;

/** Crop rectangle in percent (0–100) of the rotated image. */
export interface PercentCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrepareOptions {
  maxEdge?: number;
  rotation?: Rotation;
  crop?: PercentCrop | null;
  grayscale?: boolean;
  fileName?: string;
}

export class UnsupportedImageError extends Error {
  constructor() {
    super('This photo format is not supported. Please choose a JPG or PNG photo. / ఈ ఫోటో ఫార్మాట్ పనిచేయదు, JPG లేదా PNG ఫోటో ఎంచుకోండి.');
  }
}

function loadImage(file: Blob): Promise<{ img: HTMLImageElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    // Browsers apply the camera's EXIF orientation automatically (image-orientation: from-image).
    img.onload = () => resolve({ img, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UnsupportedImageError());
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
}

function clampCrop(c: PercentCrop): PercentCrop {
  const x = Math.max(0, Math.min(100, c.x));
  const y = Math.max(0, Math.min(100, c.y));
  return {
    x,
    y,
    width: Math.max(1, Math.min(100 - x, c.width)),
    height: Math.max(1, Math.min(100 - y, c.height)),
  };
}

/** True when the crop is (almost) the whole picture. */
export function isFullFrame(c?: PercentCrop | null): boolean {
  if (!c) return true;
  return c.x <= 0.5 && c.y <= 0.5 && c.width >= 99.5 && c.height >= 99.5;
}

export async function prepareImage(file: Blob, opts: PrepareOptions = {}): Promise<File> {
  const maxEdge = opts.maxEdge ?? PHOTO_MAX_EDGE;
  const rotation: Rotation = opts.rotation ?? 0;
  const { img, release } = await loadImage(file);

  try {
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    if (!W || !H) throw new UnsupportedImageError();

    // Size of the picture after rotation
    const turned = rotation === 90 || rotation === 270;
    const rw = turned ? H : W;
    const rh = turned ? W : H;

    // Crop rectangle (pixels, in rotated space)
    const c = clampCrop(opts.crop && !isFullFrame(opts.crop) ? opts.crop : { x: 0, y: 0, width: 100, height: 100 });
    const cx = (c.x / 100) * rw;
    const cy = (c.y / 100) * rh;
    const cw = Math.max(1, (c.width / 100) * rw);
    const ch = Math.max(1, (c.height / 100) * rh);

    // Output size (never upscale)
    const scale = Math.min(1, maxEdge / Math.max(cw, ch));
    const ow = Math.max(1, Math.round(cw * scale));
    const oh = Math.max(1, Math.round(ch * scale));

    const canvas = document.createElement('canvas');
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare the photo (no canvas). Please try again.');

    ctx.fillStyle = '#FFFFFF'; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, ow, oh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const supportsFilter = typeof (ctx as { filter?: unknown }).filter === 'string';
    if (opts.grayscale && supportsFilter) ctx.filter = 'grayscale(1)';

    // scale → move crop origin to (0,0) → rotate around the picture centre → draw
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.translate(rw / 2, rh / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -W / 2, -H / 2, W, H);

    // Old WebViews without ctx.filter: grayscale by hand (canvas is small, so this is fast)
    if (opts.grayscale && !supportsFilter) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const data = ctx.getImageData(0, 0, ow, oh);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
    }

    let blob: Blob | null = null;
    for (const q of [0.86, 0.78, 0.7, 0.62]) {
      blob = await canvasToBlob(canvas, q);
      if (blob && blob.size <= TARGET_BYTES) break;
    }
    if (!blob || blob.size === 0) throw new Error('Could not prepare the photo. Please try again.');

    canvas.width = 0; // free WebView memory right away
    canvas.height = 0;

    const base = (opts.fileName || (file as File).name || 'photo').replace(/\.[^/.]+$/, '');
    return new File([blob], `${base}_${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    release();
  }
}
