import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Newspaper, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { useAuthStore, isSuperAdminUser, isAdminUser } from '@/store';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const PaymentSuccessScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();

  const appData: ReporterApplicationDetails = location.state?.appData || {
    refNo: 'SNP-REF-889021',
    name: 'Reporter Candidate',
    email: 'reporter@example.com',
    phone: '9876543210',
    district: 'Hyderabad',
    state: 'Telangana',
    submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'ACTIVE',
    reporterId: 'SNP-TS-2026-889021',
    validUntil: '14 Oct 2027',
  };

  const [countdown, setCountdown] = useState(3);
  const [autoRedirect, setAutoRedirect] = useState(true);

  // Ensure current user session role in Zustand store is updated to reporter immediately
  useEffect(() => {
    if (user && user.role !== 'reporter' && !isSuperAdminUser(user) && !isAdminUser(user)) {
      updateUser({ role: 'reporter', plan: 'reporter' });
    }
  }, [user, updateUser]);

  // Automated countdown to next page (Digital Press ID Card)
  useEffect(() => {
    if (!autoRedirect) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/reporter/id-card', {
            replace: true,
            state: { appData },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRedirect, navigate, appData]);

  const handleProceedNext = () => {
    setAutoRedirect(false);
    navigate('/reporter/id-card', {
      replace: true,
      state: { appData },
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      <FigmaScreenHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-5 py-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Celebratory Icon */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg border-2 border-emerald-300 animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <div className="absolute -top-1 -right-1 bg-amber-400 text-black p-1 rounded-full shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1 px-3 py-1 mt-3 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black tracking-wider uppercase border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>PAYMENT SUCCESSFUL • VERIFIED</span>
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
              You're Ready to Report!
            </h1>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              చెల్లింపు విజయవంతమైంది • Your reporter account and digital credentials are now active.
            </p>
          </div>

          {/* Auto-Redirect Progress Card */}
          <div className="bg-[#EEF4FB] border border-[#C6DCF4] rounded-2xl p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#015BB3] font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#015BB3] animate-pulse" />
                <span>Opening Digital Press ID in {countdown}s...</span>
              </div>
              {autoRedirect ? (
                <button
                  type="button"
                  onClick={() => setAutoRedirect(false)}
                  className="text-[10px] font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                >
                  Stay on page
                </button>
              ) : (
                <span className="text-[10px] font-bold text-gray-500">Paused</span>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#015BB3] transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 1: Active Membership (Green tint) */}
          <div className="bg-[#E8F8EE] border border-[#C6EFD4] rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#128842]">
                Official Reporter Membership
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                ACTIVE
              </span>
            </div>
            <p className="text-xs font-semibold text-[#0F172A]">
              {appData.name} ({appData.district}, {appData.state})
            </p>
            <p className="text-[11px] text-[#128842]/90">
              Account: {appData.email}
            </p>

            {appData.reporterId && (
              <div className="pt-2 border-t border-[#C6EFD4]/80 flex items-center justify-between text-xs">
                <span className="text-[#128842] font-semibold">Assigned Reporter ID:</span>
                <span className="font-mono font-black text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#C6EFD4]">
                  {appData.reporterId}
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Digital Press ID */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-1.5">
            <span className="text-xs font-bold text-[#0F172A] block">
              Digital Press ID Card Generated
            </span>
            <p className="text-[11.5px] text-[#64748B] leading-relaxed">
              Your official ID card is ready with QR verification code and 1-year validity.
            </p>
          </div>
        </div>

        {/* Buttons & Footer */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleProceedNext}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#015BB3] to-[#0284c7] hover:from-[#093F84] hover:to-[#015BB3] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>View & Download Reporter ID Card ({countdown}s)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoRedirect(false);
              navigate('/generate');
            }}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-[#CBD5E1] text-[#0A2540] font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Newspaper className="w-4 h-4 text-[#015BB3]" />
            <span>Go to Newsroom / Create Clipping</span>
          </button>

          <p className="text-center text-[11px] text-[#94A3B8] font-medium pt-1">
            Spot News 24x7 • Press & Media Identification Network
          </p>
        </div>
      </main>
    </div>
  );
};
