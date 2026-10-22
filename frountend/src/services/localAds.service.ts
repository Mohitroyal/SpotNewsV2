import { supabase } from '@/lib/supabase';
import type { LocalAd, CreateAdRequestPayload } from '@/types/localAds';
import { generationService } from '@/services/generation.service';

const BUCKET_NAME = 'newscraft';

export const localAdsService = {
  /**
   * Fetch all active local ads for in-feed rotation.
   * If district is provided, prioritizes or matches ads for that district or 'All'.
   */
  async fetchActiveLocalAds(district?: string): Promise<LocalAd[]> {
    try {
      let query = supabase
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
        const fallback = await supabase
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
   * Fetch ad requests created by a specific reporter.
   */
  async fetchReporterAdRequests(reporterId: string): Promise<LocalAd[]> {
    try {
      const { data, error } = await supabase
        .from('local_ads')
        .select('*')
        .eq('reporter_id', reporterId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[LocalAds] Error fetching reporter ad requests:', error.message);
        return [];
      }
      return (data || []) as LocalAd[];
    } catch (e) {
      console.error('[LocalAds] Error fetching reporter ad requests:', e);
      return [];
    }
  },

  /**
   * Submit a new ad request to the superadmin.
   */
  async createAdRequest(payload: CreateAdRequestPayload): Promise<{ success: boolean; data?: LocalAd; error?: string }> {
    try {
      let mediaUrl = '';

      // Upload file to Supabase storage
      if (payload.media_type === 'video') {
        const vidRes = await generationService.uploadVideo(payload.media_file);
        if (!vidRes.success || !vidRes.data?.url) {
          throw new Error(vidRes.message || 'Failed to upload ad video');
        }
        mediaUrl = vidRes.data.url;
      } else {
        // Image poster upload
        try {
          const imgRes = await generationService.uploadImage(payload.media_file);
          if (imgRes.success && imgRes.data?.url) {
            mediaUrl = imgRes.data.url;
          }
        } catch {
          // Direct Supabase storage fallback
          const ext = payload.media_file.name.split('.').pop() || 'jpg';
          const fileName = `local_ads/ad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, payload.media_file, { upsert: true });
          if (upErr) throw new Error(upErr.message);

          const { data: pubData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);
          mediaUrl = pubData.publicUrl;
        }
      }

      if (!mediaUrl) {
        throw new Error('Failed to generate media URL for advertisement.');
      }

      const insertData = {
        reporter_id: payload.reporter_id,
        reporter_name: payload.reporter_name,
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
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('local_ads')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as LocalAd };
    } catch (e: any) {
      console.error('[LocalAds] Failed to create ad request:', e);
      return { success: false, error: e.message || 'Failed to submit ad request.' };
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
        const ext = payload.media_file.name.split('.').pop() || 'jpg';
        const fileName = `local_ads/admin_ad_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, payload.media_file, { upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        mediaUrl = pubData.publicUrl;
      }

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
        paid_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
   */
  async acceptAdRequest(adId: string, amountInr: number): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanAmount = typeof amountInr === 'number' && !isNaN(amountInr) ? Math.max(0, amountInr) : 0;
      const { error } = await supabase
        .from('local_ads')
        .update({
          status: 'accepted_payment_pending',
          amount_inr: cleanAmount,
          rejection_reason: null,
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
      const { error } = await supabase
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
      const { error } = await supabase
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
      const nextStatus = currentStatus === 'active' ? 'expired' : 'active';
      const { error } = await supabase
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
      const paymentId = paymentRef || `upi_pay_${Date.now()}`;
      const { error: updateError } = await supabase
        .from('local_ads')
        .update({
          status: 'active',
          razorpay_payment_id: paymentId,
          paid_at: new Date().toISOString(),
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
};
