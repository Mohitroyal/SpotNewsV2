import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { UpiPaymentCard } from './UpiPaymentCard';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  purposeTitle: string;
  applicantEmail?: string;
  applicantPhone?: string;
  onUpiPaid: (utrNumber: string) => Promise<void> | void;
  onRazorpayPay?: () => Promise<void> | void;
  isSubmitting?: boolean;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  isOpen,
  onClose,
  title,
  amount,
  purposeTitle,
  applicantEmail,
  applicantPhone,
  onUpiPaid,
  onRazorpayPay,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
      >
        {/* Header */}
        <div className="bg-[#015BB3] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFCC00]" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">{title}</h3>
              <p className="text-[11px] text-white/80">{purposeTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white text-xs font-bold transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5">
          <UpiPaymentCard
            amount={amount}
            purposeTitle={purposeTitle}
            applicantEmail={applicantEmail}
            applicantPhone={applicantPhone}
            onUpiPaid={onUpiPaid}
            onRazorpayPay={onRazorpayPay}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
};
