import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Clock } from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const PaymentPendingScreen: React.FC = () => {
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
    status: 'PAYMENT_PENDING',
  };

  const paymentId = location.state?.paymentId || appData.paymentId || '';
  const orderId = location.state?.orderId || appData.orderId || '';
  const signature = location.state?.signature || '';

  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const hasVerified = useRef(false);

  const verifyAndCheckStatus = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    setStatusMessage('');

    try {
      // 1. If we have paymentId and orderId, attempt server verification
      if (paymentId && orderId && !hasVerified.current) {
        hasVerified.current = true;
        const res = await reporterApprovalService.verifyPayment(orderId, paymentId, signature, appData.refNo);
        if (res.success) {
          const activatedData: ReporterApplicationDetails = {
            ...appData,
            status: 'ACTIVE',
            reporterId: res.reporterId,
            validUntil: res.validUntil,
            paymentId,
          };
          navigate('/reporter/activated', {
            replace: true,
            state: { appData: activatedData },
          });
          return;
        }
      }

      // 2. Poll server for application & payment status
      const updated = await reporterApprovalService.checkStatus(appData.email || appData.phone, appData.refNo);
      if (updated) {
        if (updated.status === 'ACTIVE') {
          navigate('/reporter/activated', {
            replace: true,
            state: { appData: updated },
          });
          return;
        }
        if (updated.status === 'PAYMENT_FAILED') {
          navigate('/reporter/payment-failed', {
            replace: true,
            state: { appData: updated },
          });
          return;
        }
      }

      if (manual) {
        setStatusMessage('Your payment is still being processed. We will activate your account as soon as confirmation arrives.');
        setTimeout(() => setStatusMessage(''), 5000);
      }
    } catch (err: any) {
      console.error('Error during pending verification:', err);
    } finally {
      if (manual) setChecking(false);
    }
  }, [appData, paymentId, orderId, signature, navigate]);

  useEffect(() => {
    // Initial verification trigger
    verifyAndCheckStatus(false);

    // Auto-polling interval
    const interval = setInterval(() => {
      verifyAndCheckStatus(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [verifyAndCheckStatus]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      <FigmaScreenHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-5 py-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Step Pill */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF3FB] text-[#0B4EA2] text-[11px] font-black tracking-wider uppercase">
            STEP 3 OF 3 / ACTIVATION
          </div>

          {/* Heading & Subtitle */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              Confirming your payment
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
              We're checking your payment before activating your account.
            </p>
          </div>

          {statusMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-[#0B4EA2] rounded-xl text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Card 1: Checking payment */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0F172A]">
                Checking payment
              </span>
              <Loader2 className="w-4 h-4 text-[#0B4EA2] animate-spin" />
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Your account will activate as soon as payment is confirmed.
            </p>
            {paymentId && (
              <p className="text-[10.5px] font-mono text-slate-400 pt-1 border-t border-slate-100">
                Payment Ref: {paymentId}
              </p>
            )}
          </div>

          {/* Card 2: Taking a little longer? */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <span className="text-sm font-bold text-[#0F172A] block">
              Taking a little longer?
            </span>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Check again safely. Please don't make another payment while this one is pending.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 space-y-2.5">
          <button
            type="button"
            onClick={() => verifyAndCheckStatus(true)}
            disabled={checking}
            className="w-full py-3.5 px-4 bg-[#0B4EA2] hover:bg-[#093F84] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
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

          <button
            type="button"
            onClick={() => navigate('/reporter/payment', { state: { appData } })}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-[#015BB3] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <span>View SBI Payment QR or Change Method</span>
          </button>

          <a
            href="mailto:support@spotnews24x7.com?subject=Payment%20Pending%20Verification%20Inquiry"
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-[#CBD5E1] text-[#0F172A] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            Contact support
          </a>
        </div>
      </main>
    </div>
  );
};
