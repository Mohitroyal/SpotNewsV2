import React, { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import type { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, Maximize2, Video as VideoIcon } from 'lucide-react';

export interface VideoCropData {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: string;
  fitMode: 'crop' | 'fit';
  aspectRatioLabel?: string;
}

interface VideoCropModalProps {
  videoSrc: string;
  originalFile: File;
  onCropComplete: (result: { file: File; crop: VideoCropData }) => void;
  onCancel: () => void;
}

export const VideoCropModal: React.FC<VideoCropModalProps> = ({
  videoSrc,
  originalFile,
  onCropComplete,
  onCancel,
}) => {
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [selectedPreset, setSelectedPreset] = useState<string>('free');
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [hasExplicitlyCropped, setHasExplicitlyCropped] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePresetChange = (preset: string, aspectVal?: number) => {
    setSelectedPreset(preset);
    setAspect(aspectVal);

    if (!aspectVal) {
      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
      setHasExplicitlyCropped(false);
      return;
    }

    setHasExplicitlyCropped(true);
    const video = videoRef.current;
    if (!video) return;

    const vW = video.videoWidth || 640;
    const vH = video.videoHeight || 360;
    const videoAspect = vW / vH;

    let targetW = 90;
    let targetH = 90;

    if (videoAspect > aspectVal) {
      // Video is wider than target aspect
      targetH = 90;
      targetW = Math.min(100, (targetH * aspectVal) / videoAspect);
    } else {
      // Video is taller than target aspect
      targetW = 90;
      targetH = Math.min(100, (targetW * videoAspect) / aspectVal);
    }

    const targetX = (100 - targetW) / 2;
    const targetY = (100 - targetH) / 2;

    setCrop({
      unit: '%',
      x: targetX,
      y: targetY,
      width: targetW,
      height: targetH,
    });
  };

  const handleCropChange = (_crop: Crop, percentCrop: Crop) => {
    setCrop(percentCrop);
    const w = percentCrop.width ?? 100;
    const h = percentCrop.height ?? 100;
    if (w < 95 || h < 95) {
      setHasExplicitlyCropped(true);
    }
  };

  const handleFitEntireVideo = () => {
    onCropComplete({
      file: originalFile,
      crop: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        unit: '%',
        fitMode: 'fit',
        aspectRatioLabel: 'Fit Full Video',
      },
    });
  };

  const handleConfirmCrop = () => {
    if (!hasExplicitlyCropped && selectedPreset === 'free') {
      handleFitEntireVideo();
      return;
    }

    const finalX = crop.x ?? 0;
    const finalY = crop.y ?? 0;
    const finalW = crop.width ?? 100;
    const finalH = crop.height ?? 100;

    onCropComplete({
      file: originalFile,
      crop: {
        x: Math.max(0, Math.min(100, finalX)),
        y: Math.max(0, Math.min(100, finalY)),
        width: Math.max(10, Math.min(100, finalW)),
        height: Math.max(10, Math.min(100, finalH)),
        unit: '%',
        fitMode: 'crop',
        aspectRatioLabel: selectedPreset.toUpperCase(),
      },
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#0D1B2A',
          width: '100%',
          maxWidth: '540px',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <VideoIcon size={20} color="#38BDF8" />
            <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
              Crop Video / Aspect Ratio
            </h2>
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Aspect Ratio Preset Selector */}
        <div style={{ padding: '12px 20px 6px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {[
            { id: 'free', label: 'Custom', aspect: undefined },
            { id: '16:9', label: '16:9 (Landscape)', aspect: 16 / 9 },
            { id: '4:3', label: '4:3 (TV)', aspect: 4 / 3 },
            { id: '1:1', label: '1:1 (Square)', aspect: 1 },
            { id: '9:16', label: '9:16 (Reel)', aspect: 9 / 16 },
          ].map((preset) => {
            const isSelected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id, preset.aspect)}
                style={{
                  background: isSelected ? '#145AB1' : 'rgba(255,255,255,0.08)',
                  color: isSelected ? '#ffffff' : '#94A3B8',
                  border: isSelected ? '1px solid #38BDF8' : '1px solid transparent',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Video with ReactCrop */}
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '260px',
            maxHeight: '50vh',
            overflow: 'hidden',
            background: '#050D15',
          }}
        >
          <ReactCrop
            crop={crop}
            aspect={aspect}
            onChange={handleCropChange}
            style={{ maxWidth: '100%', maxHeight: '48vh' }}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '48vh',
                width: 'auto',
                height: 'auto',
                borderRadius: '6px',
              }}
            />
          </ReactCrop>
        </div>

        {/* Status info */}
        <div style={{ padding: '8px 20px 0', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: '12px' }}>
            {hasExplicitlyCropped
              ? `✂️ Framing: ${selectedPreset.toUpperCase()} (${Math.round(crop.width || 100)}% × ${Math.round(crop.height || 100)}%)`
              : '📺 Entire original video will be used with black background padding if needed'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '16px 20px 20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleFitEntireVideo}
            style={{
              flex: 1,
              background: '#1E293B',
              color: '#38BDF8',
              border: '1px solid #38BDF8',
              padding: '12px 10px',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Maximize2 size={16} />
            Fit Entire Video
          </button>
          <button
            onClick={handleConfirmCrop}
            style={{
              flex: 1,
              background: '#CC1E1E',
              color: '#fff',
              border: 'none',
              padding: '12px 10px',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Check size={16} />
            {hasExplicitlyCropped ? 'Apply Video Crop' : 'Use Full Video'}
          </button>
        </div>
      </div>
    </div>
  );
};
