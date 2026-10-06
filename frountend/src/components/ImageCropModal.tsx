import React, { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, Maximize2 } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  originalFile?: File | null;           // raw original file — used for full-image bypass
  onCropComplete: (croppedBlob: Blob, isFullImage?: boolean) => void;
  onCancel: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  originalFile,
  onCropComplete,
  onCancel,
}) => {
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [hasExplicitlyCropped, setHasExplicitlyCropped] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isCropping, setIsCropping] = useState(false);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    // Start with full 100% selection — never force a center aspect crop
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setCompletedCrop({ unit: 'px', x: 0, y: 0, width: naturalWidth, height: naturalHeight });
  }

  const handleCropChange = (_crop: Crop, percentCrop: Crop) => {
    setCrop(percentCrop);
    // Only treat as an explicit crop if the user has meaningfully shrunk the selection
    const w = percentCrop.width ?? 100;
    const h = percentCrop.height ?? 100;
    const x = percentCrop.x ?? 0;
    const y = percentCrop.y ?? 0;
    if (w < 85 || h < 85 || x > 8 || y > 8) {
      setHasExplicitlyCropped(true);
    }
  };

  /**
   * Full image: bypass canvas entirely — send the original file blob so ZERO pixels are lost.
   */
  const handleFullImage = () => {
    if (originalFile) {
      // Send the raw original file — no canvas re-encoding, no pixel loss
      onCropComplete(originalFile, true);
    } else if (imgRef.current) {
      // Fallback: fetch the blob from the object URL
      fetch(imageSrc)
        .then((r) => r.blob())
        .then((blob) => onCropComplete(blob, true))
        .catch(() => {
          // Last resort: draw full image on canvas
          handleCanvasCrop(true);
        });
    }
  };

  const handleCanvasCrop = async (forceFullImage: boolean) => {
    if (!imgRef.current) return;
    setIsCropping(true);
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');

      let cropX = 0;
      let cropY = 0;
      let cropWidth = image.naturalWidth;
      let cropHeight = image.naturalHeight;

      // Only apply a crop when the user explicitly dragged to a tight selection
      if (
        !forceFullImage &&
        hasExplicitlyCropped &&
        completedCrop &&
        completedCrop.width > 0 &&
        completedCrop.height > 0
      ) {
        const rect = image.getBoundingClientRect();
        const dispW = rect.width || image.width || image.naturalWidth;
        const dispH = rect.height || image.height || image.naturalHeight;
        const scaleX = image.naturalWidth / dispW;
        const scaleY = image.naturalHeight / dispH;

        const unit: string = (completedCrop as any).unit ?? 'px';
        if (unit === '%') {
          cropX = Math.round(((completedCrop.x ?? 0) / 100) * image.naturalWidth);
          cropY = Math.round(((completedCrop.y ?? 0) / 100) * image.naturalHeight);
          cropWidth = Math.round(((completedCrop.width ?? 100) / 100) * image.naturalWidth);
          cropHeight = Math.round(((completedCrop.height ?? 100) / 100) * image.naturalHeight);
        } else {
          cropX = Math.round(completedCrop.x * scaleX);
          cropY = Math.round(completedCrop.y * scaleY);
          cropWidth = Math.round(completedCrop.width * scaleX);
          cropHeight = Math.round(completedCrop.height * scaleY);
        }
      }

      // Safety: if crop covers >= 85% of either dimension, treat as full image
      if (
        forceFullImage ||
        !hasExplicitlyCropped ||
        cropWidth >= image.naturalWidth * 0.85 ||
        cropHeight >= image.naturalHeight * 0.85
      ) {
        cropX = 0;
        cropY = 0;
        cropWidth = image.naturalWidth;
        cropHeight = image.naturalHeight;
      }

      cropX = Math.max(0, Math.min(cropX, image.naturalWidth - 1));
      cropY = Math.max(0, Math.min(cropY, image.naturalHeight - 1));
      cropWidth = Math.min(cropWidth, image.naturalWidth - cropX);
      cropHeight = Math.min(cropHeight, image.naturalHeight - cropY);

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) throw new Error('Canvas is empty');
          onCropComplete(blob, false);
        },
        'image/jpeg',
        0.97
      );
    } catch (e) {
      console.error(e);
      alert('Failed to process image');
      setIsCropping(false);
    }
  };

  const handleConfirmCrop = () => handleCanvasCrop(false);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#0D1B2A', width: '100%', maxWidth: '520px',
          borderRadius: '16px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
            Crop / Full Image
          </h2>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Cropper */}
        <div style={{ padding: '0 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', overflow: 'auto' }}>
          <ReactCrop
            crop={crop}
            onChange={handleCropChange}
            onComplete={(c) => setCompletedCrop(c)}
            style={{ maxWidth: '100%', maxHeight: '60vh' }}
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imageSrc}
              onLoad={onImageLoad}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '60vh', width: 'auto', height: 'auto' }}
            />
          </ReactCrop>
        </div>

        {/* Info label */}
        <div style={{ padding: '8px 20px 0 20px' }}>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: '12px', textAlign: 'center' }}>
            {hasExplicitlyCropped
              ? '✂️ Custom crop selected'
              : '📷 Full image will be used (drag to crop a region)'}
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px 20px 20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleFullImage}
            disabled={isCropping}
            style={{
              flex: 1,
              background: '#1E293B', color: '#38BDF8',
              border: '1px solid #38BDF8', padding: '12px 10px',
              borderRadius: '12px', fontWeight: 'bold', fontSize: '14px',
              cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <Maximize2 size={16} />
            Full Image (No Crop)
          </button>
          <button
            onClick={handleConfirmCrop}
            disabled={isCropping}
            style={{
              flex: 1,
              background: '#CC1E1E', color: '#fff',
              border: 'none', padding: '12px 10px',
              borderRadius: '12px', fontWeight: 'bold', fontSize: '14px',
              cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              opacity: isCropping ? 0.7 : 1,
            }}
          >
            <Check size={16} />
            {isCropping ? 'Processing…' : hasExplicitlyCropped ? 'Confirm Crop' : 'Use Full Image'}
          </button>
        </div>
      </div>
    </div>
  );
};
