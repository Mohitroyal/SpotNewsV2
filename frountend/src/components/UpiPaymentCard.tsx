import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode, Copy, Check, ExternalLink, ArrowRight,
  ShieldCheck, CreditCard, Download, AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import paymentQrImg from '@/assets/payment_qr.png';
import { App as CapacitorApp } from '@capacitor/app';

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
  const [activeTab, setActiveTab] = useState<'upi' | 'razorpay'>('upi');
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showQrZoom, setShowQrZoom] = useState(false);
  const [returnedFromUpi, setReturnedFromUpi] = useState(false);
  const utrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let sub: any;
    try {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          setReturnedFromUpi(true);
          setTimeout(() => utrInputRef.current?.focus(), 400);
        }
      }).then((s) => { sub = s; });
    } catch {
      // standard web browser fallback
    }
    return () => {
      if (sub && sub.remove) sub.remove();
    };
  }, []);

  const UPI_ID = 'baba.journlist@sbi';
  const PAYEE_NAME = 'FOUZIYA PUBLICATIONS';

  // Construct direct UPI intent deep link for mobile devices
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(purposeTitle)}`;

  const handleCopyUpi = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenUpiApp = () => {
    setReturnedFromUpi(true);
    window.location.href = upiDeepLink;
  };

  const handleSubmitUtr = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrNumber.trim();
    if (!cleanUtr) {
      setErrorMsg('Please enter the 12-digit UPI Reference / UTR Number from your payment app.');
      return;
    }
    if (cleanUtr.length < 6) {
      setErrorMsg('Please enter a valid UPI transaction reference number.');
      return;
    }
    setErrorMsg('');
    onUpiPaid(cleanUtr);
  };

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl shadow-sm overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 bg-gray-50/80">
        <button
          type="button"
          onClick={() => setActiveTab('upi')}
          className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'upi'
              ? 'bg-white text-[#015BB3] border-b-2 border-[#015BB3] shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>SBI UPI QR (Recommended)</span>
        </button>

        {onRazorpayPay && (
          <button
            type="button"
            onClick={() => setActiveTab('razorpay')}
            className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'razorpay'
                ? 'bg-white text-[#015BB3] border-b-2 border-[#015BB3] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cards / NetBanking</span>
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {activeTab === 'upi' ? (
          <div className="space-y-4">
            {/* Amount Banner */}
            <div className="bg-[#EEF4FB] border border-[#C6DCF4] rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-[#015BB3] uppercase tracking-wider">
                  Payment Amount
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-[#0A2540]">₹{amount}</span>
                  <span className="text-[11px] text-gray-500">INR</span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  0% Convenience Fee
                </span>
                <p className="text-[10px] text-gray-500 mt-1">Instant Bank Settlement</p>
              </div>
            </div>

            {/* Official SBI QR Poster */}
            <div className="flex flex-col items-center">
              <div
                onClick={() => setShowQrZoom(true)}
                className="group relative cursor-pointer rounded-2xl overflow-hidden border-2 border-[#015BB3]/30 shadow-md hover:border-[#015BB3] transition-all max-w-[240px] bg-white p-2"
                title="Tap to zoom QR Code"
              >
                <img
                  src={paymentQrImg}
                  alt="SBI UPI Scan & Pay QR Code"
                  className="w-full h-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                  <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-full transition-opacity">
                    Tap to enlarge
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <a
                  href={paymentQrImg}
                  download="SpotNews_SBI_Payment_QR.png"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#015BB3] hover:underline"
                >
                  <Download className="w-3 h-3" />
                  <span>Save QR to Gallery</span>
                </a>
              </div>
            </div>

            {/* UPI ID Copy Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Beneficiary: {PAYEE_NAME}
                </p>
                <p className="text-xs font-black text-gray-800 truncate font-mono mt-0.5">
                  {UPI_ID}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyUpi}
                className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-bold text-[#015BB3] flex items-center gap-1 transition-all active:scale-95 shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy UPI</span>
                  </>
                )}
              </button>
            </div>

            {/* 1-Tap Pay via UPI App (Mobile) */}
            <button
              type="button"
              onClick={handleOpenUpiApp}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#015BB3] to-[#0284c7] hover:from-[#093F84] hover:to-[#015BB3] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span>Pay with GPay / PhonePe / Paytm / BHIM</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Verification Form: UTR / Reference */}
            <form onSubmit={handleSubmitUtr} className="pt-2 border-t border-gray-200 space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Step 2: Enter 12-Digit UPI Ref / UTR Number
                </label>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  After completing payment in your UPI app, paste the 12-digit UTR/Txn ID below:
                </p>
              </div>

              {returnedFromUpi && (
                <div className="p-2.5 bg-[#EEF4FB] border border-[#015BB3]/30 rounded-xl text-xs font-semibold text-[#015BB3] flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Returned from UPI app? Paste your 12-digit UTR below:</span>
                  </div>
                  <button type="button" onClick={() => setReturnedFromUpi(false)} className="text-gray-400 hover:text-gray-700 ml-2 text-xs font-bold">✕</button>
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={utrInputRef}
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 429810293847"
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#015BB3] font-mono tracking-wider"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !utrNumber.trim()}
                  className="px-4 py-2 bg-[#128842] hover:bg-[#0e6f36] disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Submit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Razorpay Online Checkout Tab */
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center space-y-2">
              <CreditCard className="w-8 h-8 text-[#015BB3] mx-auto" />
              <h4 className="text-sm font-bold text-gray-800">Online Payment Gateway</h4>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Pay securely using Debit Cards, Credit Cards, NetBanking, or Wallet via Razorpay.
              </p>
            </div>

            <button
              type="button"
              onClick={onRazorpayPay}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#0B4EA2] hover:bg-[#093F84] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Opening Gateway...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Continue to Razorpay (₹{amount})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal Zoom for QR Code */}
      {showQrZoom && (
        <div
          onClick={() => setShowQrZoom(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-4 max-w-sm w-full shadow-2xl space-y-3 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-xs font-bold text-[#015BB3]">Official SBI UPI QR Code</span>
              <button
                type="button"
                onClick={() => setShowQrZoom(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <img
              src={paymentQrImg}
              alt="Enlarged SBI QR"
              className="w-full h-auto object-contain rounded-2xl"
            />
            <button
              type="button"
              onClick={handleOpenUpiApp}
              className="w-full py-2.5 bg-[#015BB3] text-white text-xs font-bold rounded-xl"
            >
              Pay via UPI App Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
