import { OTPWidget } from '@/services/otpService';

export const authApi = {
  sendOtp: async (mobile: string) => {
    return OTPWidget.sendOTP({ phone: mobile, mobile });
  },
  verifyOtp: async (mobile: string, otp: string) => {
    return OTPWidget.verifyOTP({ phone: mobile, mobile, otp });
  },
  logout: async () => {
    return { success: true };
  }
};

