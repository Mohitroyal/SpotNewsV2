export type LocalAdMediaType = 'image' | 'video';
export type LocalAdCtaType = 'call' | 'whatsapp' | 'link';
export type LocalAdStatus =
  | 'pending'
  | 'accepted_payment_pending'
  | 'active'
  | 'rejected'
  | 'expired';

export interface LocalAd {
  id: string;
  reporter_id?: string;
  reporter_name?: string;
  reporter_phone?: string;
  reporter_email?: string;
  title: string;
  description?: string;
  media_type: LocalAdMediaType;
  media_url: string;
  target_state?: string;
  target_district?: string;
  cta_type?: LocalAdCtaType;
  cta_value?: string;
  amount_inr: number;
  status: LocalAdStatus;
  rejection_reason?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
}

export interface CreateAdRequestPayload {
  reporter_id: string;
  reporter_name: string;
  reporter_phone?: string;
  reporter_email?: string;
  title: string;
  description?: string;
  media_type: LocalAdMediaType;
  media_file: File;
  target_state?: string;
  target_district?: string;
  cta_type?: LocalAdCtaType;
  cta_value?: string;
}
