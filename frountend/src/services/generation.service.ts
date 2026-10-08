import api, { API_BASE_URL } from "@/lib/axios";
import type { ApiResponse, PaginatedResponse, Generation, GenerationConfig } from "@/types";
import { supabase } from "@/lib/supabase";

// ─── Logging helpers ──────────────────────────────────────────────────────────
function log(stage: string, detail?: string) {
  const ts = new Date().toISOString();
  console.log(`[GEN] [${ts}] ${stage}${detail ? ` — ${detail}` : ""}`);
}

// ─── Image compression ────────────────────────────────────────────────────────
/**
 * Compress + resize an image File before uploading.
 * Limits output to maxWidthPx × maxWidthPx, quality = 0.82.
 * This prevents large 4–12 MB phone images from timing out on upload.
 */
export async function compressImage(
  file: File,
  maxWidthPx = 3600,
  quality = 1.0
): Promise<File> {
  // If file size is under 50MB, keep 100% full raw uncompressed quality
  if (file.size < 50 * 1024 * 1024) {
    log("Raw Image Preserved", `${(file.size / 1024).toFixed(0)} KB - No compression applied`);
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, maxWidthPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name, { type: "image/png" });
          log("Image Prepared", `${(file.size / 1024).toFixed(0)} KB → ${(compressed.size / 1024).toFixed(0)} KB (${w}×${h})`);
          resolve(compressed);
        },
        "image/png",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const generationService = {

  /**
   * Submit a generation job.
   *
   * Timeout: NONE (timeout: 0).
   * The Render free-tier backend runs Playwright + Supabase upload and can
   * legitimately take 2–5 minutes.  The 60 s axios global timeout was the
   * root cause of "timeout of 60000ms exceeded".
   * The 10-minute guard lives in PreviewScreen polling, not here.
   */
  async generate(config: GenerationConfig): Promise<ApiResponse<Generation>> {
    log("Generation Started", `template=${config.templateId} lang=${config.language} images=${(config as any).imageUrls?.length ?? 0}`);
    
    try {
      // Send the clipping configuration directly to the Django backend endpoint
      const res = await api.post(`/api/v1/generate`, {
        headline: config.headline,
        article_content: config.articleContent,
        image_url: config.imageUrls?.[0] || config.imageUrl || null,
        image_urls: config.imageUrls || [],
        template_id: config.templateId,
        language: config.language,
        layout_columns: config.layoutColumns,
        publication_name: config.publicationName,
        reporter_name: config.reporterName,
        // Include any other required fields for the backend
      }, {
        timeout: 0 // No timeout, wait for processing to start
      });
      
      return res.data;
    } catch (e: any) {
      log("Generation Failed", e.message);
      throw e;
    }
  },

  async getAll(page = 1, pageSize = 10): Promise<PaginatedResponse<Generation>> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const { data, count, error } = await supabase
      .from("clippings")
      .select("*", { count: 'exact' })
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) throw error;

    const generations: Generation[] = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      config: {
        headline: row.headline,
        articleContent: row.article_content,
        imageUrls: row.image_urls || (row.image_url ? [row.image_url] : []),
        videoUrl: row.custom_layout?.videoUrl,
        reporterName: row.custom_layout?.reporterName,
        // Fill other required fields with defaults
        language: "en",
        tone: "formal",
        templateId: "classic-split",
        publicationName: "Spot News 24x7",
        publicationDate: new Date(row.created_at).toLocaleDateString(),
        layoutColumns: 1
      },
      status: row.status as any,
      createdAt: row.created_at,
      png_url: row.png_url,
      pdf_url: row.pdf_url,
    }));

    return {
      data: generations,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    };
  },

  /**
   * Poll for a single generation by ID.
   * Short 15-second timeout per poll — if it fails we retry next interval.
   */
  async getById(id: string): Promise<ApiResponse<Generation>> {
    return this.getByIdPublic(id);
  },

  async getByIdPublic(id: string): Promise<ApiResponse<Generation>> {
    const { data, error } = await supabase
      .from("clippings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    let customLayoutParsed = data.custom_layout || {};
    if (typeof data.custom_layout === 'string') {
      try {
        customLayoutParsed = JSON.parse(data.custom_layout);
      } catch (e) {}
    }

    const generation: Generation = {
      id: data.id,
      userId: data.user_id,
      config: {
        headline: data.headline,
        articleContent: data.article_content,
        imageUrls: data.image_urls || (data.image_url ? [data.image_url] : []),
        videoUrl: customLayoutParsed?.videoUrl,
        reporterName: customLayoutParsed?.reporterName,
        // Defaults
        language: "en",
        tone: "formal",
        templateId: "classic-split",
        publicationName: "Spot News 24x7",
        publicationDate: new Date(data.created_at).toLocaleDateString(),
        layoutColumns: 1
      },
      status: data.status as any,
      createdAt: data.created_at,
      stage: customLayoutParsed?.stage,
      progress: customLayoutParsed?.progress,
      error: customLayoutParsed?.error,
      png_url: data.png_url,
      pdf_url: data.pdf_url,
    };

    return { success: true, data: generation, message: "Fetched successfully" };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/generate/${id}`, { timeout: 15_000 });
    return res.data;
  },

  async exportPng(id: string): Promise<Blob> {
    const res = await api.get(`/generations/${id}/export/png`, {
      responseType: "blob",
      timeout: 60_000,
    });
    return res.data;
  },

  async exportPdf(id: string): Promise<Blob> {
    const res = await api.get(`/generations/${id}/export/pdf`, {
      responseType: "blob",
      timeout: 60_000,
    });
    return res.data;
  },

  /**
   * Upload a single image to the backend.
   *
   * The image is compressed to ≤1600 px / 82% quality before upload.
   * Timeout: 120 s (2 minutes) — allows large compressed images on slow connections.
   */
  async uploadImage(file: File): Promise<ApiResponse<{ url: string }>> {
    log("Image Upload Started", `name=${file.name} size=${(file.size / 1024).toFixed(0)} KB`);

    // Pre-flight Client-Side Validation
    if (!file || file.size === 0) {
      throw new Error("Empty file uploaded. File must be greater than 0 bytes.");
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File exceeds maximum allowed size of 50MB. 50MB is the limit.");
    }

    // Compress before upload to reduce network time
    const compressed = await compressImage(file);
    log("Image Upload Compressing", `compressed size=${(compressed.size / 1024).toFixed(0)} KB`);

    const buffer = await compressed.arrayBuffer();
    const blob   = new Blob([buffer], { type: compressed.type });

    const formData = new FormData();
    formData.append("file", blob, compressed.name || "image.jpg");

    let token = "";
    try {
      const authStore = localStorage.getItem("newscraft-auth");
      if (authStore) {
        const parsed = JSON.parse(authStore);
        token = parsed?.state?.token || "";
      }
    } catch (e) {}

    const API_URL = API_BASE_URL;

    // Use fetch with an AbortController so we get a 2-minute window
    const controller = new AbortController();
    const uploadTimeoutId = setTimeout(() => {
      controller.abort();
    }, 120_000); // 2 minutes for image upload

    try {
      let res = await fetch(`${API_URL}/uploads/image`, {
        method:  "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    formData,
        signal:  controller.signal,
      });

      // Fallback to /api/v1/uploads/image if root route is not found
      if (res.status === 404) {
        res = await fetch(`${API_URL}/api/v1/uploads/image`, {
          method:  "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    formData,
          signal:  controller.signal,
        });
      }

      clearTimeout(uploadTimeoutId);

      if (!res.ok) {
        let errorDetail = "";
        try {
          const errJson = await res.json();
          errorDetail = errJson.detail || errJson.message || "";
        } catch (_) {}

        if (res.status === 401) {
          throw new Error("Authentication required. Please log in to your account and try uploading again.");
        }
        if (res.status === 413) {
          throw new Error("File exceeds maximum allowed size of 50MB. 50MB is the limit.");
        }
        throw new Error(errorDetail || `Image Upload Failed: ${res.statusText} (HTTP ${res.status})`);
      }

      const data = await res.json();
      log("Image Upload Complete", `url=${data?.data?.url || data?.url || "(no url)"}`);
      return data;
    } catch (e: any) {
      clearTimeout(uploadTimeoutId);
      if (e.name === "AbortError") {
        throw new Error("Image Upload Failed: Request timed out after 2 minutes. Check network and try a smaller image.");
      }
      if (e.message && e.message.toLowerCase().includes("failed to fetch")) {
        throw new Error("Network connection to server failed. The backend may be waking up (Render cold start) or offline. Please wait 30 seconds and try again.");
      }
      log("Image Upload Error", e.message);
      throw e;
    }
  },

  /**
   * Upload a video to Supabase Storage.
   */
  async uploadVideo(file: File): Promise<ApiResponse<{ url: string }>> {
    log("Video Upload Started", `name=${file.name} size=${(file.size / 1024 / 1024).toFixed(1)} MB`);

    if (!file || file.size === 0) {
      throw new Error("Empty file uploaded.");
    }
    if (file.size > 100 * 1024 * 1024) {
      throw new Error("Video file exceeds maximum allowed size of 100MB.");
    }

    try {
      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileName = `videos/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('newscraft-clippings')
        .upload(fileName, file, { upsert: true, contentType: file.type || 'video/mp4' });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: pubData } = supabase.storage
        .from('newscraft-clippings')
        .getPublicUrl(fileName);
        
      if (!pubData?.publicUrl) {
        throw new Error("Failed to get public URL after upload");
      }

      log("Video Upload Complete", `url=${pubData.publicUrl}`);
      return { success: true, message: "Video uploaded successfully", data: { url: pubData.publicUrl } };
    } catch (e: any) {
      log("Video Upload Error", e.message);
      throw e;
    }
  },
};
