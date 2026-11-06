import { supabase, publicClient, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import type { LocalAd, CreateAdRequestPayload } from '@/types/localAds';
import { generationService } from '@/services/generation.service';

const PRIMARY_BUCKET = 'uploads';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function adOwnerId(id?: string): string {
  if (id && UUID_REGEX.test(id)) {
    return id;
  }
  try {
    const stored = localStorage.getItem('spotnews_guest_ad_uuid');
    if (stored && UUID_REGEX.test(stored)) {
      return stored;
    }
  } catch {}

  const newUuid = generateUUID();
  try {
    localStorage.setItem('spotnews_guest_ad_uuid', newUuid);
  } catch {}
  return newUuid;
}

export function getLocalSubmittedAdIds(): string[] {
  try {
    const stored = localStorage.getItem('spotnews_my_ad_ids');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === 'string' && UUID_REGEX.test(id));
      }
    }
  } catch {}
  return [];
}

export function saveLocalSubmittedAdId(id: string): void {
  if (!id || !UUID_REGEX.test(id)) return;
  try {
    const current = getLocalSubmittedAdIds();
    if (!current.includes(id)) {
      const updated = [id, ...current].slice(0, 50);
      localStorage.setItem('spotnews_my_ad_ids', JSON.stringify(updated));
    }
  } catch {}
}

/**
 * Convert dataURL to Blob synchronously without async stall.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([], { type: 'image/jpeg' });
  }
}

/**
 * Helper to convert file or blob to base64 Data URL.
 */
function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Super-fast, stall-free client-side image compression:
 * Resizes down to max 1200px and 0.8 JPEG quality (~150KB to 250KB).
 * A 150KB payload uploads in < 1 second even on slow 4G mobile connections.
 */
async function compressAdImage(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve) => {
    const fallback = () => {
      fileToDataUrl(file)
        .then((dataUrl) => resolve({ blob: file, dataUrl }))
        .catch(() => resolve({ blob: file, dataUrl: '' }));
    };

    // 2.5s maximum safeguard
    const timer = setTimeout(() => {
      console.warn('[LocalAds] Canvas compression timeout, using fallback');
      fallback();
    }, 2500);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(objectUrl);
        try {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            fallback();
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Synchronous toDataURL returns instantly with zero async callback stall
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const blob = dataUrlToBlob(dataUrl);
          resolve({ blob: blob.size > 0 ? blob : file, dataUrl });
        } catch {
          fallback();
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(objectUrl);
        fallback();
      };
      img.src = objectUrl;
    } catch {
      clearTimeout(timer);
      fallback();
    }
  });
}

/**
 * Multi-tier Supabase storage upload for ad images:
 * Tier 1: Direct XMLHttpRequest upload to 'uploads' bucket (bypasses fetch wrapper, handles mobile cellular streams)
 * Tier 2: publicClient.storage upload to 'uploads' bucket
 * Tier 3: Guaranteed Base64 fallback (guarantees ad submission ALWAYS succeeds even with poor mobile reception)
 */
async function uploadAdImage(file: File, onProgress?: (step: string) => void): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error('Please select an image file to upload.');
  }

  onProgress?.('చిత్రం సిద్ధమవుతోంది… · Preparing image…');
  const { blob, dataUrl } = await compressAdImage(file);
  const ext = 'jpg';
  const fileName = `uploads/ad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  // Tier 1: Direct XMLHttpRequest upload (fastest, direct binary push)
  try {
    onProgress?.('అప్‌లోడ్ అవుతోంది… · Uploading poster…');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${PRIMARY_BUCKET}/${fileName}`;
    const pubUrl = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.timeout = 15000;

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(`${supabaseUrl}/storage/v1/object/public/${PRIMARY_BUCKET}/${fileName}`);
        } else {
          reject(new Error(`Storage returned HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Storage upload timed out'));
      xhr.send(blob);
    });

    if (pubUrl) {
      console.log('[LocalAds] Tier 1 XHR image upload success:', pubUrl);
      return pubUrl;
    }
  } catch (err) {
    console.warn('[LocalAds] Tier 1 XHR upload failed, trying publicClient:', err);
  }

  // Tier 2: publicClient storage to 'uploads'
  try {
    onProgress?.('మళ్లీ ప్రయత్నిస్తోంది… · Retrying upload…');
    const { data: pubData, error } = await publicClient.storage
      .from(PRIMARY_BUCKET)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (!error && pubData) {
      const { data: urlData } = publicClient.storage.from(PRIMARY_BUCKET).getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        console.log('[LocalAds] Tier 2 publicClient upload success:', urlData.publicUrl);
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('[LocalAds] Tier 2 storage client upload failed:', err);
  }

  // Tier 3: Guaranteed Base64 fallback (fits directly into local_ads.media_url without HTTP stall)
  if (dataUrl && dataUrl.startsWith('data:image')) {
    console.log('[LocalAds] Using compressed Base64 fallback for ad media_url');
    return dataUrl;
  }

  throw new Error('Image upload failed. Please check internet connection and try again.');
}

export const localAdsService = {
  /**
   * Fetch all active local ads for in-feed rotation.
   * If district is provided, prioritizes or matches ads for that district or 'All'.
   */
  async fetchActiveLocalAds(district?: string): Promise<LocalAd[]> {
    try {
      const client = publicClient || supabase;
      let query = client
        .from('local_ads')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (district && district.trim() && district.trim().toLowerCase() !== 'all') {
        const cleanDist = district.trim().replace(/"/g, '');
        query = query.or(`target_district.eq."${cleanDist}",target_district.eq.All,target_district.is.null`);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        // Fallback: fetch all active ads so ads always show in feed
        const fallback = await client
          .from('local_ads')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (fallback.data && fallback.data.length > 0) {
          console.log(`[LocalAds] Loaded ${fallback.data.length} active ads (all active fallback)`);
          return fallback.data as LocalAd[];
        }
      }
      console.log(`[LocalAds] Loaded ${data?.length || 0} active ads`);
      return (data || []) as LocalAd[];
    } catch (e) {
      console.error('[LocalAds] Unexpected error fetching active ads:', e);
      return [];
    }
  },

  /**
   * Fetch ad requests created by a specific reporter/guest.
   * Safely checks reporter_id and locally submitted ad IDs.
   */
  async fetchReporterAdRequests(reporterId?: string): Promise<LocalAd[]> {
    try {
      const validReporterId = adOwnerId(reporterId);
      const localAdIds = getLocalSubmittedAdIds();

      // Query by reporter_id with 8s timeout using publicClient
      const queryPromise = publicClient
        .from('local_ads')
        .select('*')
        .eq('reporter_id', validReporterId)
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise<any>((resolve) =>
        setTimeout(() => {
          console.warn('[LocalAds] Query by reporter_id timed out after 8s');
          resolve({ data: [], error: null });
        }, 8000)
      );

      const { data: byReporter, error: repError } = await Promise.race([queryPromise, timeoutPromise]);

      if (repError) {
        console.warn('[LocalAds] Query by reporter_id warning:', repError.message);
      }

      let combined: LocalAd[] = (byReporter || []) as LocalAd[];

      // Also query any locally submitted ad IDs not already present
      if (localAdIds.length > 0) {
        const foundIds = new Set(combined.map((a) => a.id));
        const missingIds = localAdIds.filter((id) => !foundIds.has(id));

        if (missingIds.length > 0) {
          const { data: byIds, error: idsError } = await publicClient
            .from('local_ads')
            .select('*')
            .in('id', missingIds)
            .order('created_at', { ascending: false });

          if (!idsError && byIds && byIds.length > 0) {
            combined = [...combined, ...(byIds as LocalAd[])];
          }
        }
      }

      // Sort newest first
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return combined;
    } catch (e) {
      console.error('[LocalAds] Error fetching reporter ad requests:', e);
      return [];
    }
  },

  /**
   * Submit a new ad request to the superadmin.
   */
  async createAdRequest(
    payload: CreateAdRequestPayload,
    onProgress?: (step: string) => void
  ): Promise<{ success: boolean; data?: LocalAd; error?: string }> {
    try {
      let mediaUrl = '';

      // Upload file directly to Supabase storage
      if (payload.media_type === 'video') {
        onProgress?.('Uploading video...');
        const vidRes = await generationService.uploadVideo(payload.media_file);
        if (!vidRes.success || !vidRes.data?.url) {
          throw new Error(vidRes.message || 'Failed to upload ad video');
        }
        mediaUrl = vidRes.data.url;
      } else {
        mediaUrl = await uploadAdImage(payload.media_file, onProgress);
      }

      if (!mediaUrl || (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:image'))) {
        throw new Error('Failed to generate media URL for advertisement.');
      }

      onProgress?.('Saving ad details...');
      const validReporterId = adOwnerId(payload.reporter_id);

      // Check if auto-approve ads is enabled in Superadmin config
      const isAutoApprove = await localAdsService.getAutoApproveAdsConfig();
      const nowIso = new Date().toISOString();

      const insertData = {
        reporter_id: validReporterId,
        reporter_name: payload.reporter_name || 'Advertiser',
        reporter_phone: payload.reporter_phone || null,
        reporter_email: payload.reporter_email || null,
        title: payload.title,
        description: payload.description || '',
        media_type: payload.media_type,
        media_url: mediaUrl,
        target_state: payload.target_state || 'Telangana',
        target_district: payload.target_district || 'All',
        cta_type: payload.cta_type || 'call',
        cta_value: payload.cta_value || '',
        amount_inr: 0,
        status: isAutoApprove ? 'active' : 'pending',
        approval_type: isAutoApprove ? 'auto' : 'manual',
        approved_at: isAutoApprove ? nowIso : null,
        paid_at: isAutoApprove ? nowIso : null,
      };

      const insertPromise = publicClient
        .from('local_ads')
        .insert(insertData)
        .select()
        .single();

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Database submission timed out after 8s. Please check connection and retry.')), 8000)
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) throw error;
      if (!data) throw new Error('No data returned from ad insertion.');

      saveLocalSubmittedAdId((data as LocalAd).id);
      return { success: true, data: data as LocalAd };
    } catch (e: any) {
      console.error('[LocalAds] Failed to create ad request:', e);
      return { success: false, error: e.message || 'Failed to submit ad request.' };
    }
  },

  /**
   * Publish an ad directly to the live feed (for Superadmin or Reporter).
   * Sets status to 'active', updates approval timestamp, and marks as live.
   */
  async publishAdToFeed(adId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = publicClient || supabase;
      const nowIso = new Date().toISOString();
      const updatePromise = client
        .from('local_ads')
        .update({
          status: 'active',
          paid_at: nowIso,
          approved_at: nowIso,
          amount_inr: 0,
          rejection_reason: null,
        })
        .eq('id', adId);

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Publishing to feed timed out. Please retry.')), 5000)
      );

      const { error } = await Promise.race([updatePromise, timeoutPromise]);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('[LocalAds] Error publishing ad to feed:', e);
      return { success: false, error: e.message || 'Failed to publish ad to feed.' };
    }
  },

  /**
   * Superadmin directly creates an active ad without payment.
   */
  async createSuperadminDirectAd(payload: Omit<CreateAdRequestPayload, 'reporter_id'> & { reporter_name?: string }): Promise<{ success: boolean; data?: LocalAd; error?: string }> {
    try {
      let mediaUrl = '';
      if (payload.media_type === 'video') {
        const vidRes = await generationService.uploadVideo(payload.media_file);
        if (!vidRes.success || !vidRes.data?.url) throw new Error(vidRes.message || 'Video upload failed');
        mediaUrl = vidRes.data.url;
      } else {
        mediaUrl = await uploadAdImage(payload.media_file);
      }

      const client = publicClient || supabase;
      const nowIso = new Date().toISOString();
      const insertData = {
        reporter_name: payload.reporter_name || 'SpotNews Superadmin',
        title: payload.title,
        description: payload.description || '',
        media_type: payload.media_type,
        media_url: mediaUrl,
        target_state: payload.target_state || 'Telangana',
        target_district: payload.target_district || 'All',
        cta_type: payload.cta_type || 'call',
        cta_value: payload.cta_value || '',
        amount_inr: 0,
        status: 'active',
        paid_at: nowIso,
        approved_at: nowIso,
        approval_type: 'manual',
      };

      const { data, error } = await client
        .from('local_ads')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as LocalAd };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to create ad.' };
    }
  },

  /**
   * Superadmin fetches all ad requests.
   */
  async fetchAllAdRequestsForAdmin(): Promise<LocalAd[]> {
    try {
      const client = publicClient || supabase;
      const { data, error } = await client
        .from('local_ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as LocalAd[];
    } catch (e) {
      console.error('[LocalAds] Admin fetch error:', e);
      return [];
    }
  },

  /**
   * Superadmin accepts an ad request and assigns a price to pay.
   * If price is ₹0 (free), immediately marks active so it appears in the feed.
   */
  async acceptAdRequest(adId: string, amountInr: number): Promise<{ success: boolean; error?: string }> {
    try {
      const client = publicClient || supabase;
      const cleanAmount = typeof amountInr === 'number' && !isNaN(amountInr) ? Math.max(0, amountInr) : 0;
      const nowIso = new Date().toISOString();
      const status = cleanAmount === 0 ? 'active' : 'accepted_payment_pending';

      const { error } = await client
        .from('local_ads')
        .update({
          status,
          amount_inr: cleanAmount,
          rejection_reason: null,
          approval_type: 'manual',
          approved_at: nowIso,
          ...(cleanAmount === 0 ? { paid_at: nowIso } : {}),
        })
        .eq('id', adId);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to accept ad request.' };
    }
  },

  /**
   * Superadmin rejects an ad request with a reason.
   */
  async rejectAdRequest(adId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = publicClient || supabase;
      const { error } = await client
        .from('local_ads')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', adId);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to reject ad request.' };
    }
  },

  /**
   * Delete or archive an ad.
   */
  async deleteLocalAd(adId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = publicClient || supabase;
      const { error } = await client
        .from('local_ads')
        .delete()
        .eq('id', adId);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to delete ad.' };
    }
  },

  /**
   * Toggle ad active/paused status.
   */
  async toggleAdStatus(adId: string, currentStatus: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = publicClient || supabase;
      const nextStatus = currentStatus === 'active' ? 'expired' : 'active';
      const { error } = await client
        .from('local_ads')
        .update({ status: nextStatus })
        .eq('id', adId);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to update status.' };
    }
  },

  /**
   * Launch UPI intent deep link for an ad payment without premature activation.
   */
  launchUpiPaymentIntent(ad: LocalAd): { success: boolean; upiDeepLink: string } {
    const paymentAmount = ad.amount_inr ?? 0;
    const upiDeepLink = `upi://pay?pa=baba.journlist@sbi&pn=FOUZIYA%20PUBLICATIONS&am=${paymentAmount}&cu=INR&tn=SpotNews`;
    try {
      window.location.href = upiDeepLink;
      return { success: true, upiDeepLink };
    } catch (e) {
      console.warn('Direct UPI intent trigger notice:', e);
      return { success: false, upiDeepLink };
    }
  },

  /**
   * Confirm payment and activate ad in database.
   */
  async confirmPaymentAndActivate(adId: string, paymentRef?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = publicClient || supabase;
      const paymentId = paymentRef || `upi_pay_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const { error: updateError } = await client
        .from('local_ads')
        .update({
          status: 'active',
          razorpay_payment_id: paymentId,
          paid_at: nowIso,
          approved_at: nowIso,
        })
        .eq('id', adId);

      if (updateError) throw updateError;
      return { success: true };
    } catch (err: any) {
      console.error('[LocalAds] Failed to update ad to active:', err);
      return { success: false, error: err.message || 'Failed to activate ad.' };
    }
  },

  /**
   * Reporter pays for the accepted ad.
   * If free, immediately activates. If paid, triggers UPI intent without premature activation.
   */
  async payAndPublishAd(ad: LocalAd): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const amountInr = ad.amount_inr ?? 0;
    if (amountInr <= 0) {
      const res = await this.confirmPaymentAndActivate(ad.id, 'free_ad');
      return { success: res.success, paymentId: 'free_ad', error: res.error };
    }
    this.launchUpiPaymentIntent(ad);
    return { success: true, paymentId: 'upi_intent_launched' };
  },

  /**
   * Reporter pays for the accepted ad via SBI UPI QR Code by submitting UTR number.
   * Updates status to active in Supabase.
   */
  async submitUpiPaymentForAd(adId: string, utrNumber: string): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      const cleanUtr = utrNumber.trim();
      const paymentId = `upi_utr_${cleanUtr}`;
      const { error: updateError } = await supabase
        .from('local_ads')
        .update({
          status: 'active',
          razorpay_payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', adId);

      if (updateError) throw updateError;
      return { success: true, paymentId };
    } catch (err: any) {
      console.error('[LocalAds] Failed to submit UPI payment for ad:', err);
      return { success: false, error: err.message || 'Failed to submit UPI payment verification.' };
    }
  },

  /**
   * Get Auto-Approve Ads configuration (persisted in app_config & localStorage).
   * Defaults to false if no setting exists.
   */
  async getAutoApproveAdsConfig(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('get_auto_approve_ads_rpc');
      if (!error && typeof data === 'boolean') {
        try { localStorage.setItem('spotnews_auto_approve_ads', String(data)); } catch {}
        return data;
      }
    } catch {}

    try {
      const { data } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'auto_approve_ads')
        .maybeSingle();
      if (data?.config_value !== undefined) {
        const val = data.config_value === 'true';
        try { localStorage.setItem('spotnews_auto_approve_ads', String(val)); } catch {}
        return val;
      }
    } catch {}

    try {
      return localStorage.getItem('spotnews_auto_approve_ads') === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Set Auto-Approve Ads configuration (persisted in app_config & localStorage).
   */
  async setAutoApproveAdsConfig(enabled: boolean): Promise<boolean> {
    try {
      localStorage.setItem('spotnews_auto_approve_ads', String(enabled));
    } catch {}

    try {
      const { error } = await supabase.rpc('set_auto_approve_ads_rpc', { p_enabled: enabled });
      if (!error) return true;
    } catch {}

    try {
      await supabase.from('app_config').upsert({
        config_key: 'auto_approve_ads',
        config_value: enabled ? 'true' : 'false',
      });
      return true;
    } catch (err) {
      console.warn('[LocalAds] Failed to persist auto_approve_ads config:', err);
      return false;
    }
  },
};
