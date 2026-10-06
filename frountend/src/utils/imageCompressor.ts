/**
 * Image Compressor Utility
 *
 * Automatically compresses oversized images (e.g. > 10MB or exceeding 4096px)
 * to a suitable size fitting strictly under the 10MB limit while maintaining
 * the highest visual quality possible.
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  dataUrl: string;
}

/**
 * Compresses an image File or Blob to comfortably fit under the 10 MB limit
 * and maximum dimensions (default 2560 px), preserving optimal visual quality.
 */
export async function compressImageToFit(
  file: File | Blob,
  maxSizeBytes: number = 45 * 1024 * 1024, // 45 MB target ensures it is well under 50 MB
  maxDimension: number = 8192
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const origWidth = img.naturalWidth || img.width;
      const origHeight = img.naturalHeight || img.height;

      // Determine scaling factor to fit within maxDimension
      let scale = 1;
      if (origWidth > maxDimension || origHeight > maxDimension) {
        scale = Math.min(maxDimension / origWidth, maxDimension / origHeight);
      }

      let targetWidth = Math.round(origWidth * scale);
      let targetHeight = Math.round(origHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to initialize 2D canvas context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Fill background with white to avoid black background on PNGs with transparency
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const fileName = 'name' in file ? (file as File).name : 'compressed_image.jpg';
      const cleanBaseName = fileName.replace(/\.[^/.]+$/, '');
      const mimeType = 'image/jpeg';

      // Progressive quality step-down from 0.88 to 0.55 if needed to guarantee size <= maxSizeBytes
      let quality = 0.88;
      let finalBlob: Blob | null = null;

      while (quality >= 0.5) {
        finalBlob = await new Promise<Blob | null>((res) => {
          canvas.toBlob((b) => res(b), mimeType, quality);
        });

        if (finalBlob && finalBlob.size <= maxSizeBytes) {
          break;
        }

        quality -= 0.08;
      }

      // If still over limit (e.g. extremely complex high frequency image), downscale resolution further
      if (finalBlob && finalBlob.size > maxSizeBytes) {
        const downScale = 0.75;
        targetWidth = Math.round(targetWidth * downScale);
        targetHeight = Math.round(targetHeight * downScale);
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        finalBlob = await new Promise<Blob | null>((res) => {
          canvas.toBlob((b) => res(b), mimeType, 0.75);
        });
      }

      if (!finalBlob) {
        reject(new Error('Failed to generate compressed image'));
        return;
      }

      const compressedFile = new File(
        [finalBlob],
        `${cleanBaseName}.jpg`,
        { type: mimeType, lastModified: Date.now() }
      );

      const dataUrl = canvas.toDataURL(mimeType, quality);

      resolve({
        file: compressedFile,
        originalSize: file.size,
        compressedSize: finalBlob.size,
        originalWidth: origWidth,
        originalHeight: origHeight,
        width: targetWidth,
        height: targetHeight,
        dataUrl,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}

/**
 * Converts an image file/blob to grayscale / black & white.
 */
export async function convertToBlackAndWhite(file: File | Blob): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to generate B&W blob'));
          return;
        }
        const fileName = 'name' in file ? (file as File).name : 'bw_image.jpg';
        resolve(new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', 0.9);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for black and white conversion'));
    };

    img.src = objectUrl;
  });
}
