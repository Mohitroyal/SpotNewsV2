import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, AlertCircle } from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';
import { UpiPaymentCard } from '@/components/UpiPaymentCard';

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

  const handleUpiPaid = async (utr: string) => {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      let orderId = '';
      try {
        const order = await reporterApprovalService.createPaymentOrder(appData.refNo, appData.email);
        orderId = order.orderId;
      } catch (e) {
        orderId = `upi_order_${Date.now()}`;
      }

      const payId = `upi_utr_${utr}`;
      const res = await reporterApprovalService.verifyPayment(orderId, payId, '', appData.refNo);

      if (res.success) {
        navigate('/reporter/payment-success', {
          state: {
            appData: {
              ...appData,
              status: 'ACTIVE',
              reporterId: res.reporterId,
              validUntil: res.validUntil,
              paymentId: payId,
            },
          },
        });
      } else {
        navigate('/reporter/payment-pending', {
          state: {
            appData,
            paymentId: payId,
            orderId,
          },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification submitted. We are validating your payment with the bank.');
      setLoading(false);
    }
  };

  const handleContinuePayment = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // Step 1: Create backend order with server-configured price
      const order = await reporterApprovalService.createPaymentOrder(appData.refNo, appData.email);

      // Step 2: Launch Razorpay standard checkout
      const payRes = await reporterApprovalService.startPayment(order);

      if (payRes.cancelled) {
        navigate('/reporter/payment-failed', {
          state: {
            appData,
            errorReason: 'Payment was cancelled. You can retry safely whenever you are ready.',
          },
        });
        return;
      }

      if (!payRes.success || !payRes.paymentId) {
        navigate('/reporter/payment-failed', {
          state: {
            appData,
            errorReason: payRes.error || 'Payment failed or was declined by bank.',
          },
        });
        return;
      }

      // Step 3: Verify payment immediately with server
      try {
        const verRes = await reporterApprovalService.verifyPayment(
          payRes.orderId || order.orderId,
          payRes.paymentId,
          payRes.signature || '',
          appData.refNo
        );

        if (verRes.success) {
          navigate('/reporter/payment-success', {
            replace: true,
            state: {
              appData: {
                ...appData,
                status: 'ACTIVE',
                reporterId: verRes.reporterId,
                validUntil: verRes.validUntil,
                paymentId: payRes.paymentId,
              },
            },
          });
          return;
        }
      } catch (verErr) {
        console.warn('Immediate verification fallback to pending polling:', verErr);
      }

      // Fallback: Transition to Verification Pending if verification needs polling
      navigate('/reporter/payment-pending', {
        replace: true,
        state: {
          appData,
          paymentId: payRes.paymentId,
          orderId: payRes.orderId || order.orderId,
          signature: payRes.signature,
        },
      });

    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to initialize checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-10">
      <FigmaScreenHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-4 sm:px-5 py-6 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Step Pill */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF3FB] text-[#0B4EA2] text-[11px] font-black tracking-wider uppercase">
            STEP 2 OF 3 / PAYMENT
          </div>

          {/* Heading & Subtitle */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              You're approved!
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
              Complete your membership payment to activate your reporter account.
            </p>
          </div>

          {/* Green approval badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8EE] text-[#128842] text-[11px] font-bold border border-[#C6EFD4]">
            <Check className="w-3.5 h-3.5" />
            <span>SUPER ADMIN APPROVED</span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Membership Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                  REPORTER MEMBERSHIP
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-[#0F172A] tracking-tight">₹999</span>
                  <span className="text-xs text-[#64748B]">/ year</span>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-blue-50 text-[#015BB3] px-2.5 py-1 rounded-full border border-blue-200">
                Annual Pass
              </span>
            </div>

            <div className="pt-2.5 border-t border-[#F1F5F9] grid grid-cols-2 gap-2 text-[11px] text-[#0F172A] font-medium">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#128842] shrink-0" />
                <span>Publishing access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#128842] shrink-0" />
                <span>Digital Press ID</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#128842] shrink-0" />
                <span>News clippings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#128842] shrink-0" />
                <span>Verified badge</span>
              </div>
            </div>
          </div>

          {/* Approved email display */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-medium">Approved email:</span>
            <span className="text-xs font-bold text-[#0F172A] truncate max-w-[200px]">
              {appData.email}
            </span>
          </div>

          {/* Integrated SBI UPI QR & Payment Card */}
          <div className="pt-2">
            <UpiPaymentCard
              amount={999}
              purposeTitle="SpotNews Reporter Annual Membership"
              applicantEmail={appData.email}
              applicantPhone={appData.phone}
              onUpiPaid={handleUpiPaid}
              onRazorpayPay={handleContinuePayment}
              isSubmitting={loading}
            />
          </div>
        </div>

        {/* Footer Support */}
        <div className="pt-4 border-t border-gray-200 text-center space-y-1.5">
          <a
            href="mailto:support@spotnews24x7.com?subject=Spot%20News%20Reporter%20Payment%20Help"
            className="text-xs font-bold text-[#0B4EA2] hover:underline inline-block"
          >
            Need help with payment? Contact Support
          </a>
          <p className="text-[10px] text-gray-400">
            Official Beneficiary: FOUZIYA PUBLICATIONS • State Bank of India
          </p>
        </div>
      </main>
    </div>
  );
};
