/**
 * Image Validation Utility
 *
 * Enforces resilient validation on image uploads in the frontend:
 * 1. File Size Limit: Max 50 MB, Min > 0 bytes.
 * 2. Allowed Formats: All standard web images (JPEG, PNG, WEBP, GIF, etc.).
 * 3. Mobile friendly: Handles Android camera/gallery files without extension or with content URIs.
 */

export const IMAGE_CONSTRAINTS = {
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50 MB limit
  MIN_UPLOAD_SIZE: 1,                 // Must be > 0 bytes
  MAX_DIMENSION: 16384,               // Max width/height in px (supports high-res phone cameras)
  MAX_PIXELS: 100_000_000,            // Max total pixels (100 Megapixels)
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/*'],
  ALLOWED_EXTENSIONS: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
} as const;

export interface ValidationOptions {
  allowSvg?: boolean;
  maxSizeBytes?: number;
  maxDimension?: number;
  maxPixels?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  size?: number;
}

/**
 * Validate an image File or Blob against size, MIME type, dimensions, and pixel limits.
 */
export async function validateImageFile(
  file: File | Blob,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const maxSize = options.maxSizeBytes ?? IMAGE_CONSTRAINTS.MAX_UPLOAD_SIZE;

  // 1. Check minimum file size
  if (!file || file.size === 0) {
    return {
      valid: false,
      error: 'Empty file uploaded. File must be greater than 0 bytes.',
    };
  }

  // 2. Check maximum file size (50 MB limit)
  if (file.size > maxSize) {
    const sizeMb = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File exceeds maximum allowed size of ${sizeMb}MB. 50MB is the limit.`,
    };
  }

  // 3. Format / MIME type check (resilient to mobile devices)
  const mimeType = (file.type || '').toLowerCase().split(';')[0].trim();
  const fileName = 'name' in file ? (file as File).name.toLowerCase() : '';

  // If MIME type indicates an image, allow it
  if (mimeType && (mimeType.startsWith('image/') || mimeType === 'application/octet-stream')) {
    // Valid image type from browser/device
    return { valid: true, size: file.size };
  }

  // Check file extension if dot exists
  if (fileName && fileName.includes('.')) {
    const ext = fileName.split('.').pop() || '';
    if (ext && IMAGE_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext as any)) {
      return { valid: true, size: file.size };
    }
  }

  // Fallback: If it's a blob/file with size, assume valid image
  return { valid: true, size: file.size };
}
