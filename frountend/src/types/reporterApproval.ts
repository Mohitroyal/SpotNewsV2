export type ReporterApplicationStatus =
  | 'PENDING'
  | 'APPROVED_PAYMENT_PENDING'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAID_GENERATING'
  | 'ACTIVE'
  | 'REJECTED';

export interface ReporterApplicationDetails {
  refNo: string;
  name: string;
  email: string;
  phone: string;
  state?: string;
  district?: string;
  pressId?: string;
  submittedDate: string;
  status: ReporterApplicationStatus;
  rejectionReason?: string;
  reporterId?: string;
  paymentId?: string;
  orderId?: string;
  validUntil?: string;
  avatarUrl?: string;
}

export interface PaymentOrder {
  orderId: string;
  amount: number; // In paise for Razorpay
  amountInr?: number; // In Rupees (e.g. 999)
  currency: string;
  keyId?: string;
  refNo: string;
  name?: string;
  email?: string;
  phone?: string;
  description?: string;
}
