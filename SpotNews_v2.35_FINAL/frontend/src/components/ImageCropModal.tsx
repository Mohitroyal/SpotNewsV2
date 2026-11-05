import React, { useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import type { PercentCrop as RicPercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCw, Maximize2, Loader2 } from 'lucide-react';
import {
  prepareImage,
  isFullFrame,
  PREVIEW_MAX_EDGE,
  PHOTO_MAX_EDGE,
  type Rotation,
} from '@/utils/prepareImage';

/**
 * Reporter photo crop sheet.
 *
 * Fixes compared with the old version:
 *  - Whatever the reporter selects is exactly what is used (the old 85% rule
 *    silently ignored most top/bottom crops).
 *  - Works on a small preview, then cuts the final photo from the original
 *    file → no full-resolution canvas, no WebView out-of-memory, no stuck
 *    "Processing…" button.
 *  - Aspect presets (Free / 4:3 / 16:9 / 1:1 / 3:4) and Rotate.
 *  - Output is always a light JPEG (≤ 1600 px) ready to upload.
 */

interface ImageCropModalProps {
  file: File;
  grayscale?: boolean;
  onDone: (prepared: File) => void;
  onCancel: () => void;
}

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: 'Free', value: undefined },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
];

const FULL: RicPercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

export const ImageCropModal: React.FC<ImageCropModalProps> = ({ file, grayscale, onDone, onCancel }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<RicPercentCrop>(FULL);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Build a light preview (and rebuild it when the reporter rotates)
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setError(null);
    setPreviewUrl(null);
    prepareImage(file, { maxEdge: PREVIEW_MAX_EDGE, rotation, grayscale })
      .then((p) => {
        if (cancelled) return;
        url = URL.createObjectURL(p);
        setPreviewUrl(url);
        setCrop(FULL);
        setAspect(undefined);
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not open this photo.'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, rotation, grayscale]);

  const applyAspect = (value: number | undefined) => {
    setAspect(value);
    const img = imgRef.current;
    if (!value || !img) {
      setCrop(FULL);
      return;
    }
    const { width, height } = img;
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, value, width, height), width, height));
  };

  const finish = async (useFullPhoto: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareImage(file, {
        maxEdge: PHOTO_MAX_EDGE,
        rotation,
        grayscale,
        crop: useFullPhoto ? null : crop,
      });
      onDone(prepared);
    } catch (e: any) {
      setError(e?.message || 'Could not prepare the photo. Please try again.');
      setBusy(false); // never leave the button stuck
    }
  };

  const cropped = !isFullFrame(crop);
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: active ? '1.5px solid #38BDF8' : '1px solid #334155',
    background: active ? 'rgba(56,189,248,0.15)' : '#1E293B',
    color: active ? '#7DD3FC' : '#CBD5E1',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100050, background: '#0B1220',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
        <button onClick={onCancel} disabled={busy} aria-label="Cancel" style={{ background: 'transparent', border: 'none', color: '#fff', padding: 6, cursor: 'pointer' }}>
          <X size={24} />
        </button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Crop photo / ఫోటో కత్తిరించండి</div>
        <button
          onClick={() => setRotation(((rotation + 90) % 360) as Rotation)}
          disabled={busy || !previewUrl}
          aria-label="Rotate"
          style={{ background: 'transparent', border: 'none', color: '#fff', padding: 6, cursor: 'pointer' }}
        >
          <RotateCw size={22} />
        </button>
      </div>

      {/* Picture */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', overflow: 'hidden' }}>
        {error ? (
          <p style={{ color: '#FCA5A5', fontSize: 14, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>{error}</p>
        ) : !previewUrl ? (
          <div style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Opening photo…
          </div>
        ) : (
          <ReactCrop
            crop={crop}
            aspect={aspect}
            keepSelection
            minWidth={40}
            minHeight={40}
            onChange={(_px, pct) => setCrop(pct)}
            style={{ maxHeight: '100%' }}
          >
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Selected photo"
              style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100dvh - 230px)', objectFit: 'contain' }}
            />
          </ReactCrop>
        )}
      </div>

      {/* Aspect presets */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px 4px', overflowX: 'auto', justifyContent: 'center' }}>
        {ASPECTS.map((a) => (
          <button key={a.label} style={chip(aspect === a.value)} onClick={() => applyAspect(a.value)} disabled={busy || !previewUrl}>
            {a.label}
          </button>
        ))}
      </div>
      <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: 11.5, textAlign: 'center' }}>
        {cropped ? 'Your selected area will be used' : 'Drag the corners to crop, or use the full photo'}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px 16px' }}>
        <button
          onClick={() => finish(true)}
          disabled={busy || !previewUrl}
          style={{
            flex: 1, background: '#1E293B', color: '#38BDF8', border: '1px solid #38BDF8',
            padding: '13px 10px', borderRadius: 12, fontWeight: 800, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
            opacity: busy || !previewUrl ? 0.6 : 1,
          }}
        >
          <Maximize2 size={16} /> Full photo
        </button>
        <button
          onClick={() => finish(false)}
          disabled={busy || !previewUrl || !cropped}
          style={{
            flex: 1, background: '#CC1E1E', color: '#fff', border: 'none',
            padding: '13px 10px', borderRadius: 12, fontWeight: 800, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
            opacity: busy || !previewUrl || !cropped ? 0.6 : 1,
          }}
        >
          {busy ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
          {busy ? 'Preparing…' : 'Use crop'}
        </button>
      </div>
    </div>
  );
};
