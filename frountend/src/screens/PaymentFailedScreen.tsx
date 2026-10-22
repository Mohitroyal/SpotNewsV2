import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const PaymentFailedScreen: React.FC = () => {
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
    status: 'PAYMENT_FAILED',
  };

  const errorReason = location.state?.errorReason || '';
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusMsg('');
    try {
      const updated = await reporterApprovalService.checkStatus(appData.email || appData.phone, appData.refNo);
      if (updated && updated.status === 'ACTIVE') {
        navigate('/reporter/activated', {
          replace: true,
          state: { appData: updated },
        });
        return;
      }
      setStatusMsg('No successful payment confirmed yet. If your account was debited, it will be credited back or confirmed within standard bank settlement cycles.');
      setTimeout(() => setStatusMsg(''), 6000);
    } catch (e) {
      console.error('Error checking status:', e);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      <FigmaScreenHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-5 py-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Try Again Pill */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF3FB] text-[#0B4EA2] text-[11px] font-black tracking-wider uppercase">
            PAYMENT / TRY AGAIN
          </div>

          {/* Heading & Subtitle */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              Let's try that again.
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
              Your reporter approval is saved. Your account is waiting for payment.
            </p>
          </div>

          {errorReason && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorReason}</span>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
              {statusMsg}
            </div>
          )}

          {/* Card 1: Payment not completed */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <span className="text-sm font-bold text-[#0F172A] block">
              Payment not completed
            </span>
            <p className="text-xs text-[#64748B] leading-relaxed">
              If money was deducted, check payment status before trying again. We'll activate your account when it is confirmed.
            </p>
          </div>

          {/* Direct UPI QR Recommendation */}
          <div className="bg-[#EEF4FB] border border-[#C6DCF4] rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#015BB3] font-bold">
              <span>💡 Zero Failure Option</span>
            </div>
            <p className="text-gray-600 leading-relaxed text-[11px]">
              Avoid gateway or bank card timeout errors by scanning our official <strong>State Bank of India (SBI) UPI QR Code</strong> with Google Pay, PhonePe, or Paytm.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 space-y-2.5">
          <button
            type="button"
            onClick={() => navigate('/reporter/payment', { state: { appData } })}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#015BB3] to-[#0284c7] hover:from-[#093F84] hover:to-[#015BB3] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Pay with SBI UPI QR Code (₹999)</span>
          </button>

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-[#CBD5E1] text-[#0F172A] font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking payment status...</span>
              </>
            ) : (
              <span>Check payment status</span>
            )}
          </button>

          <a
            href="mailto:support@spotnews24x7.com?subject=Payment%20Assistance%20Spot%20News%20Reporter"
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-[#CBD5E1] text-[#64748B] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            Contact support
          </a>
        </div>
      </main>
    </div>
  );
};
