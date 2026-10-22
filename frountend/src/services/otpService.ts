import axios from 'axios';

export interface SendOTPPayload {
  phone?: string;
  identifier?: string;
  mobile?: string;
}

export interface VerifyOTPPayload {
  phone?: string;
  mobile?: string;
  otp: string;
  reqId?: string;
}

export interface OTPResponse {
  success: boolean;
  type?: 'success' | 'error';
  message: string;
  token?: string;
  token_type?: string;
  user?: any;
}

export const OTP_API_URL = (
  import.meta.env.VITE_OTP_API_URL ||
  import.meta.env.VITE_AUTH_API_URL ||
  'https://news-backend-sjw6.onrender.com'
).replace(/\/+$/, '');

const otpApi = axios.create({
  baseURL: OTP_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

function normalizePhone(input?: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (input.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

function extractErrorMessage(err: any): string {
  if (err?.response?.data) {
    const data = err.response.data;
    if (typeof data.message === 'string' && data.message) return data.message;
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail
        .map((d: any) => d.msg || d.message || (typeof d === 'string' ? d : JSON.stringify(d)))
        .join(', ');
    }
    if (typeof data.error === 'string' && data.error) return data.error;
  }
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return 'Server took too long to respond. The authentication server may be waking up. Please try again.';
  }
  if (err?.message === 'Network Error') {
    return 'Unable to reach the authentication service. Please check your internet connection.';
  }
  if (err?.message) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Service to connect directly to the backend MSG91 OTP endpoints:
 * - POST /api/v1/auth/send-otp
 * - POST /api/v1/auth/verify-otp
 */
export const OTPWidget = {
  /**
   * Initialization helper
   */
  initializeWidget: () => {
    console.log('[OTPService] Backend MSG91 OTP service ready at:', OTP_API_URL);
  },

  /**
   * Send 6-digit OTP to mobile number via backend MSG91 Flow API
   */
  sendOTP: async (data: SendOTPPayload): Promise<OTPResponse> => {
    const raw = data.phone || data.identifier || data.mobile;
    const phone = normalizePhone(raw);
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new Error('Please enter a valid 10-digit Indian phone number');
    }

    const payload = { phone, mobile: phone };

    try {
      let response: any;
      try {
        response = await otpApi.post('/api/v1/auth/send-otp', payload);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          response = await otpApi.post('/api/auth/send-otp', payload);
        } else {
          throw err;
        }
      }

      return {
        success: response.data.success ?? true,
        type: 'success',
        message: response.data.message || 'OTP sent successfully',
      };
    } catch (err: any) {
      const message = extractErrorMessage(err);
      throw new Error(message);
    }
  },

  /**
   * Retry/Resend OTP
   */
  retryOTP: async (data: { reqId?: string; retryType?: string; mobile?: string; phone?: string }): Promise<OTPResponse> => {
    return OTPWidget.sendOTP({ phone: data.phone || data.mobile });
  },

  /**
   * Verify 6-digit OTP via backend
   */
  verifyOTP: async (data: VerifyOTPPayload): Promise<OTPResponse> => {
    const raw = data.phone || data.mobile;
    const phone = normalizePhone(raw);
    const otp = data.otp?.trim();

    if (!phone) {
      throw new Error('Missing phone number for OTP verification');
    }
    if (!otp || otp.length !== 6) {
      throw new Error('Please enter a valid 6-digit OTP');
    }

    const payload = { phone, mobile: phone, otp };

    try {
      let response: any;
      try {
        response = await otpApi.post('/api/v1/auth/verify-otp', payload);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          response = await otpApi.post('/api/auth/verify-otp', payload);
        } else {
          throw err;
        }
      }

      return {
        success: response.data.success ?? true,
        type: 'success',
        message: response.data.message || 'OTP verified successfully',
        token: response.data.token,
        token_type: response.data.token_type,
        user: response.data.user,
      };
    } catch (err: any) {
      const message = extractErrorMessage(err);
      throw new Error(message);
    }
  },
};

