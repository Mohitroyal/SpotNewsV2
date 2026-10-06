import axios from 'axios';

// Call the existing backend APIs (Django or FastAPI)
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export const authApi = {
  sendOtp: async (mobile: string) => {
    const res = await axios.post(`${API_URL}/auth/send-otp`, { mobile });
    return res.data;
  },
  verifyOtp: async (mobile: string, otp: string) => {
    const res = await axios.post(`${API_URL}/auth/verify-otp`, { mobile, otp });
    return res.data;
  },
  logout: async () => {
    const res = await axios.post(`${API_URL}/auth/logout`);
    return res.data;
  }
};
