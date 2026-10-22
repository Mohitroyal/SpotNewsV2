import React from 'react';
import {
  Check,
  ShieldCheck,
  CreditCard,
  Loader2,
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface UpiPaymentCardProps {
  amount: number;
  purposeTitle: string;
  applicantEmail?: string;
  applicantPhone?: string;
  onUpiPaid: (utrNumber: string) => Promise<void> | void;
  onRazorpayPay?: () => Promise<void> | void;
  isSubmitting?: boolean;
}

export const UpiPaymentCard: React.FC<UpiPaymentCardProps> = ({
  amount,
  purposeTitle,
  applicantEmail: _applicantEmail,
  applicantPhone: _applicantPhone,
  onUpiPaid,
  onRazorpayPay,
  isSubmitting = false,
}) => {
  const handleDirectPay = () => {
    if (isSubmitting) return;
    if (onRazorpayPay) {
      onRazorpayPay();
    } else {
      const generatedPayId = `pay_direct_${Date.now()}`;
      onUpiPaid(generatedPayId);
    }
  };

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl shadow-sm overflow-hidden p-4 sm:p-5 space-y-4">
      {/* Amount Banner */}
      <div className="bg-[#EEF4FB] border border-[#C6DCF4] rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-[#015BB3] uppercase tracking-wider">
            Payment Amount
          </p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-black text-[#0A2540]">₹{amount}</span>
            <span className="text-xs text-gray-500 font-semibold">INR (Fixed)</span>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            0% Convenience Fee
          </span>
          <p className="text-[10px] text-gray-500 mt-1">Instant Bank Settlement</p>
        </div>
      </div>

      {/* Purpose & Beneficiary Details */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex items-start justify-between gap-2">
          <span className="text-gray-500 font-medium">Purpose:</span>
          <span className="font-bold text-[#0A2540] text-right">{purposeTitle}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-200/80">
          <span className="text-gray-500 font-medium">Beneficiary:</span>
          <span className="font-bold text-gray-800">FOUZIYA PUBLICATIONS</span>
        </div>
      </div>

      {/* Accepted Payment Methods Summary */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-[#0A2540]">
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#015BB3]" />
            Supported Payment Modes
          </span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
            All UPI & Cards
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-[#64748B]">
          <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">Google Pay</span>
          <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">PhonePe</span>
          <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">Paytm / BHIM</span>
          <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[#0F172A] font-bold">Cards / NetBanking</span>
        </div>
      </div>

      {/* Direct Payment Action Button */}
      <div className="pt-2 space-y-2.5">
        <button
          type="button"
          onClick={handleDirectPay}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-[#015BB3] to-[#0284c7] hover:from-[#093F84] hover:to-[#015BB3] active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to Bank Gateway...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Pay ₹{amount} & Complete</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-medium text-center">
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            Automatic verification
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#015BB3]" />
            Immediate activation
          </span>
        </div>
      </div>
    </div>
  );
};
