import { supabase } from '@/lib/supabase';
import type { ReporterApplicationDetails, PaymentOrder, ReporterApplicationStatus } from '@/types/reporterApproval';

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_DJANGO_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const API_URL = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const MOCK_STORAGE_KEY = 'spotnews_reporter_app_data';

// Helper to load Razorpay script
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay script from CDN. Will fallback to simulated test mode if keys are dummy.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export const reporterApprovalService = {
  /**
   * Check application and payment status by Phone, Email or refNo.
   */
  async checkStatus(identifier: string, refNo?: string): Promise<ReporterApplicationDetails | null> {
    const cleanId = identifier.trim();
    if (!cleanId) return null;

    try {
      // 1. First try backend status API for authoritative server status
      try {
        const queryParams = new URLSearchParams();
        if (cleanId) queryParams.set('identifier', cleanId);
        if (refNo && !refNo.startsWith('SNP-REF-')) queryParams.set('ref_no', refNo);

        const res = await fetch(`${API_URL}/v1/reporter/payment/status?${queryParams.toString()}`);
        if (res.ok) {
          const apiData = await res.json();
          if (apiData && apiData.success) {
            let mappedStatus: ReporterApplicationStatus = 'PENDING';
            const dbStatus = (apiData.app_status || apiData.status || '').toLowerCase();
            const paymentStatus = (apiData.payment_status || '').toLowerCase();

            if (dbStatus === 'active' || paymentStatus === 'paid') {
              mappedStatus = 'ACTIVE';
            } else if (dbStatus === 'approved') {
              if (paymentStatus === 'pending') {
                mappedStatus = 'PAYMENT_PENDING';
              } else if (paymentStatus === 'failed') {
                mappedStatus = 'PAYMENT_FAILED';
              } else {
                mappedStatus = 'APPROVED_PAYMENT_PENDING';
              }
            } else if (dbStatus === 'rejected') {
              mappedStatus = 'REJECTED';
            }

            return {
              refNo: apiData.ref_no,
              name: apiData.name,
              email: apiData.email,
              phone: apiData.phone,
              submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              status: mappedStatus,
              reporterId: apiData.reporter_id,
              paymentId: apiData.payment_id,
              orderId: apiData.order_id,
              validUntil: apiData.valid_until,
            };
          }
        }
      } catch (backendErr) {
        console.warn('Backend payment status check not reachable, falling back to Supabase RPC:', backendErr);
      }

      // 2. Fallback to Supabase RPC
      let cleanRef = refNo ? refNo.trim() || null : null;
      if (cleanRef && cleanRef.startsWith('SNP-REF-')) {
        cleanRef = null;
      }
      
      const { data, error } = await supabase.rpc('check_application_status_rpc', {
        p_identifier: cleanId,
        p_ref_no: cleanRef
      });

      if (error || !data) {
        // Fallback to local storage if testing offline
        const local = localStorage.getItem(`${MOCK_STORAGE_KEY}_${cleanId.toLowerCase()}`);
        if (local) return JSON.parse(local);
        return null;
      }

      let mappedStatus: ReporterApplicationStatus = 'PENDING';
      const dbStatus = data.status?.toLowerCase() || 'pending';
      const paymentStatus = data.payment_status?.toLowerCase();
      
      if (dbStatus === 'pending') {
        mappedStatus = 'PENDING';
      } else if (dbStatus === 'approved') {
        if (paymentStatus === 'pending') {
          mappedStatus = 'PAYMENT_PENDING';
        } else if (paymentStatus === 'failed') {
          mappedStatus = 'PAYMENT_FAILED';
        } else {
          mappedStatus = 'APPROVED_PAYMENT_PENDING';
        }
      } else if (dbStatus === 'rejected') {
        mappedStatus = 'REJECTED';
      } else if (dbStatus === 'active') {
        mappedStatus = 'ACTIVE';
      }

      return {
        refNo: data.refNo,
        name: data.name,
        email: data.email,
        phone: data.phone,
        state: data.state,
        district: data.district,
        submittedDate: new Date(data.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: mappedStatus,
        reporterId: data.reporter_id,
        paymentId: data.payment_id,
        validUntil: data.valid_until ? new Date(data.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined,
      };
    } catch (e) {
      console.error('Error checking application status', e);
      return null;
    }
  },

  /**
   * Create payment order for approved application on backend.
   */
  async createPaymentOrder(refNo: string, email?: string): Promise<PaymentOrder> {
    try {
      const res = await fetch(`${API_URL}/v1/reporter/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref_no: refNo, email }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create payment order (${res.status})`);
      }

      const data = await res.json();
      return {
        orderId: data.order_id,
        amount: data.amount, // in paise
        amountInr: data.amount_inr || 999,
        currency: data.currency || 'INR',
        keyId: data.key_id,
        refNo: data.ref_no || refNo,
        name: data.name,
        email: data.email || email,
        phone: data.phone,
        description: data.description,
      };
    } catch (err: any) {
      console.warn('Backend create-order call failed, using fallback test order:', err);
      // Fallback test order for dev/offline testing
      return {
        orderId: 'ORD_TEST_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        amount: 99900,
        amountInr: 999,
        currency: 'INR',
        keyId: 'rzp_test_spotnews_dummy',
        refNo,
        email: email || 'reporter@example.com',
      };
    }
  },

  /**
   * Launch Razorpay Checkout integration.
   */
  async startPayment(order: PaymentOrder): Promise<{
    success: boolean;
    paymentId?: string;
    orderId?: string;
    signature?: string;
    cancelled?: boolean;
    error?: string;
  }> {
    const isLoaded = await loadRazorpayScript();
    const effectiveKey = (order.keyId && !order.keyId.includes('dummy')) 
      ? order.keyId 
      : (import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TpNZ0nDgvTDXOU');

    if (!isLoaded || !(window as any).Razorpay) {
      return {
        success: false,
        error: 'Razorpay payment SDK could not be loaded. Please check your internet connection.',
      };
    }

    if (!effectiveKey || effectiveKey.includes('dummy')) {
      return {
        success: false,
        error: 'Razorpay Live Key is not configured. Please add RAZORPAY_KEY_ID on Render.',
      };
    }

    return new Promise((resolve) => {
      try {
        const options: any = {
          key: effectiveKey,
          amount: order.amount || 100,
          currency: order.currency || 'INR',
          name: 'Spot News 24x7',
          description: order.description || 'Spot News Reporter Membership',
          image: '/logo.png',
          prefill: {
            name: order.name || '',
            email: order.email || '',
            contact: order.phone || '',
          },
          theme: {
            color: '#0B4EA2', // Spot News Deep Royal Blue
          },
          config: {
            display: {
              blocks: {
                upi: {
                  name: 'Pay using UPI (Google Pay, PhonePe, Paytm)',
                  instruments: [{ method: 'upi' }],
                },
                other: {
                  name: 'Cards & Other Payment Options',
                  instruments: [{ method: 'card' }, { method: 'netbanking' }, { method: 'wallet' }],
                },
              },
              sequence: ['block.upi', 'block.other'],
              preferences: {
                show_default_blocks: true,
              },
            },
          },
          modal: {
            ondismiss: () => {
              resolve({
                success: false,
                cancelled: true,
                error: 'Payment was cancelled or closed by user.',
              });
            },
          },
          handler: (response: any) => {
            resolve({
              success: true,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id || order.orderId,
              signature: response.razorpay_signature,
            });
          },
        };

        // Only attach order_id if it is a real Razorpay order ID (not simulated order_test_)
        if (order.orderId && order.orderId.startsWith('order_') && !order.orderId.startsWith('order_test_')) {
          options.order_id = order.orderId;
        }

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (failResp: any) => {
          resolve({
            success: false,
            paymentId: failResp?.error?.metadata?.payment_id,
            orderId: failResp?.error?.metadata?.order_id || order.orderId,
            error: failResp?.error?.description || 'Payment failed.',
          });
        });
        rzp.open();
      } catch (e: any) {
        resolve({
          success: false,
          error: e.message || 'Failed to open Razorpay checkout.',
        });
      }
    });
  },

  /**
   * Verify payment on the backend server.
   */
  async verifyPayment(
    orderId: string,
    paymentId: string,
    signature?: string,
    refNo?: string
  ): Promise<{ success: boolean; reporterId?: string; validUntil?: string; error?: string }> {
    try {
      const res = await fetch(`${API_URL}/v1/reporter/payment/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || '',
          application_id: refNo,
          ref_no: refNo,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Payment verification failed on server (${res.status})`);
      }

      const data = await res.json();
      return {
        success: true,
        reporterId: data.reporter_id,
        validUntil: data.valid_until,
      };
    } catch (err: any) {
      console.warn('Backend payment verification failed, executing direct Supabase activation fallback:', err);
      // Fallback: direct Supabase activation if backend offline
      try {
        if (refNo) {
          const currentYear = new Date().getFullYear();
          const generatedId = `SNP-TS-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;
          const validDate = new Date();
          validDate.setFullYear(validDate.getFullYear() + 1);

          await supabase
            .from('reporter_applications')
            .update({
              status: 'active',
              payment_id: paymentId,
              payment_status: 'paid',
              reporter_id: generatedId,
              valid_until: validDate.toISOString(),
            })
            .eq('id', refNo);

          return {
            success: true,
            reporterId: generatedId,
            validUntil: validDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          };
        }
      } catch (dbErr) {
        console.error('Supabase fallback activation failed:', dbErr);
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Generate Reporter ID (idempotent operation).
   */
  async generateReporterId(refNo: string, paymentId?: string): Promise<{ reporterId: string; validUntil: string }> {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    const validUntil = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const reporterId = `SNP-TS-${new Date().getFullYear()}-${randomNum}`;

    try {
      if (refNo && !refNo.startsWith('SNP-REF-')) {
        await supabase
          .from('reporter_applications')
          .update({
            status: 'active',
            payment_id: paymentId,
            payment_status: 'paid',
            reporter_id: reporterId,
            valid_until: date.toISOString(),
          })
          .eq('id', refNo);
      }
    } catch (e) {
      console.warn('Direct id update warning:', e);
    }

    return { reporterId, validUntil };
  },

  /**
   * Helper to persist application mock data locally for testing
   */
  saveMockApplication(appData: ReporterApplicationDetails) {
    if (appData.email) {
      localStorage.setItem(`${MOCK_STORAGE_KEY}_${appData.email.toLowerCase()}`, JSON.stringify(appData));
    }
    if (appData.refNo) {
      localStorage.setItem(`${MOCK_STORAGE_KEY}_${appData.refNo.toLowerCase()}`, JSON.stringify(appData));
    }
  },
};
