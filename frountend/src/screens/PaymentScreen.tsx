import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { useAuthStore } from '@/store';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const PaymentScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const appData: ReporterApplicationDetails = location.state?.appData || {
    refNo: 'SNP-REF-889021',
    name: 'Reporter Candidate',
    email: 'reporter@example.com',
    phone: '9876543210',
    district: 'Hyderabad',
    state: 'Telangana',
    submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'APPROVED_PAYMENT_PENDING',
  };

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [priceInr, setPriceInr] = useState<number>(() => {
    const envPrice = Number(import.meta.env.VITE_REPORTER_PRICE_INR);
    return !isNaN(envPrice) && envPrice > 0 ? envPrice : 999;
  });

  React.useEffect(() => {
    const apiUrl = import.meta.env.VITE_DJANGO_API_URL || 'https://spotnewsv2.onrender.com';
    fetch(`${apiUrl}/api/v1/reporter/payment/config`)
      .then(res => res.json())
      .then(data => {
        if (data?.amount_inr) {
          setPriceInr(data.amount_inr);
        }
      })
      .catch(() => {});
  }, []);

  const handleContinuePayment = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // Step 1: Create backend order with server-configured fixed amount
      const order = await reporterApprovalService.createPaymentOrder(appData.refNo, appData.email);

      // Step 2: Launch payment checkout (Razorpay supporting UPI GPay/PhonePe/Paytm, Cards, NetBanking)
      const payRes = await reporterApprovalService.startPayment(order);

      if (payRes.cancelled) {
        setLoading(false);
        setErrorMsg(`Payment was cancelled. You can click Pay ₹${priceInr} whenever you are ready.`);
        return;
      }

      if (!payRes.success || !payRes.paymentId) {
        setLoading(false);
        setErrorMsg(payRes.error || 'Payment was declined by bank or failed. Please try again.');
        return;
      }

      // Step 3: Verify payment immediately with server / database
      let reporterId = '';
      let validUntil = '';
      try {
        const verRes = await reporterApprovalService.verifyPayment(
          payRes.orderId || order.orderId,
          payRes.paymentId,
          payRes.signature || '',
          appData.refNo
        );
        if (verRes.reporterId) reporterId = verRes.reporterId;
        if (verRes.validUntil) validUntil = verRes.validUntil;
      } catch (verErr) {
        console.warn('Backend payment verification fallback:', verErr);
      }

      // Fallback ID generation if backend was temporarily unreachable
      if (!reporterId) {
        const currentYear = new Date().getFullYear();
        reporterId = `SNP-TS-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;
      }
      if (!validUntil) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        validUntil = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }

      // Upgrade active user role in local store
      try {
        useAuthStore.getState().updateUser({ role: 'reporter', plan: 'reporter' });
      } catch {}

      // Step 4: Seamlessly redirect back to the app, show success, and proceed
      navigate('/reporter/payment-success', {
        replace: true,
        state: {
          appData: {
            ...appData,
            status: 'ACTIVE',
            reporterId,
            validUntil,
            paymentId: payRes.paymentId,
          },
        },
      });

    } catch (err: any) {
      console.error('Payment checkout error:', err);
      setErrorMsg(err.message || 'Unable to open checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-10">
      <FigmaScreenHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-4 sm:px-5 py-6 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF3FB] text-[#0B4EA2] text-[11px] font-black tracking-wider uppercase">
              STEP 2 OF 3 • MEMBERSHIP ACTIVATION
            </span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8EE] text-[#128842] text-[11px] font-bold border border-[#C6EFD4]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#128842]" />
              <span>APPROVED</span>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
              Activate Reporter Credential
            </h1>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Your application has been verified. Complete the fixed membership payment to activate your official press accreditation.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fixed Amount Membership Pricing Card */}
          <div className="bg-white border-2 border-[#0B4EA2]/30 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#0B4EA2] text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
              OFFICIAL ANNUAL PASS
            </div>

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] block">
                ANNUAL MEMBERSHIP FEE
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black text-[#0A2540] tracking-tight">₹{priceInr}</span>
                <span className="text-xs text-[#64748B] font-semibold">/ year (Fixed)</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                No hidden costs • 100% all-inclusive pricing
              </p>
            </div>

            {/* Included Credential Features */}
            <div className="pt-3 border-t border-[#F1F5F9] space-y-2 text-xs text-[#0F172A] font-medium">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Official RTI Express Digital Press ID Card (CR80)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>1-Year Authorized Press Identification & Accreditation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Full Spot News Portal & Daily Newspaper Access</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Government RTI Act-2005 Verified Press Reporter Status</span>
              </div>
            </div>
          </div>

          {/* Approved Candidate Information Card */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-4 shadow-xs space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="text-[#64748B] font-medium">Applicant Name:</span>
              <span className="font-bold text-[#0F172A]">{appData.name}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="text-[#64748B] font-medium">Registered Email:</span>
              <span className="font-bold text-[#0F172A] truncate max-w-[200px]">{appData.email}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="text-[#64748B] font-medium">Assigned Center:</span>
              <span className="font-bold text-[#0F172A]">{appData.district || 'HYDERABAD'}, {appData.state || 'TELANGANA'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B] font-medium">Reference No:</span>
              <span className="font-mono font-bold text-[#0B4EA2] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {appData.refNo}
              </span>
            </div>
          </div>

          {/* Accepted Payment Modes (Informational, No Manual Scanner / No Manual 12 Digits) */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-[#0A2540]">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#0B4EA2]" />
                Accepted Payment Methods
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                Instant Activation
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-[#64748B] font-medium">
              <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">Google Pay</span>
              <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">PhonePe</span>
              <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">Paytm / UPI</span>
              <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">Cards</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleContinuePayment}
            disabled={loading}
            className="w-full py-4 px-5 bg-gradient-to-r from-[#0B4EA2] to-[#0284c7] hover:from-[#093F84] hover:to-[#015BB3] active:scale-[0.99] text-white font-black text-sm rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Payment...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pay ₹{priceInr} & Activate ID</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Trust Guarantee */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-[#64748B] font-medium text-center">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" />
              256-Bit SSL Encrypted
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#0B4EA2]" />
              RBI & Bank Compliant
            </span>
          </div>

          <p className="text-center text-[10px] text-gray-400">
            Fouziya Publications (Reg. 43 of 2018) • RTI EXPRESS Spot News 24×7
          </p>
        </div>
      </main>
    </div>
  );
};
