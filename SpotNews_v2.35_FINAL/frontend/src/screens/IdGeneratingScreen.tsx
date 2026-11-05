import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { ReporterPortalHeader } from '@/components/ReporterPortalHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { getEffectiveReporterPhoto, saveReporterPhoto, saveReporterName } from '@/store';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const IdGeneratingScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const appData: ReporterApplicationDetails = location.state?.appData || {
    refNo: 'SNP-REF-889021',
    name: 'Reporter Candidate',
    email: 'reporter@example.com',
    phone: '9876543210',
    submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'PAID_GENERATING',
  };

  const paymentId = location.state?.paymentId || appData.paymentId || 'TXN_987123849';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(15);
  const hasTriggered = useRef(false);

  // Block Android hardware back button
  useEffect(() => {
    let backListener: any;
    try {
      backListener = CapacitorApp.addListener('backButton', () => {
        // Do nothing to block navigation
      });
    } catch (e) {}

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Simulate progress bar movement
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 400);
    return () => clearInterval(timer);
  }, []);

  // Generate ID call
  const generateId = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reporterApprovalService.generateReporterId(appData.refNo, paymentId);
      setProgress(100);
      
      const cleanEmail = (appData.email || '').toLowerCase().trim();
      const finalPhoto =
        (cleanEmail ? localStorage.getItem(`spotnews_id_card_photo_${cleanEmail}`) : null) ||
        getEffectiveReporterPhoto(cleanEmail, [appData.avatarUrl]);
      
      if (finalPhoto && cleanEmail) {
        saveReporterPhoto(cleanEmail, finalPhoto);
        try {
          localStorage.setItem(`spotnews_id_card_photo_${cleanEmail}`, finalPhoto);
        } catch {}
      }
      if (appData.name && cleanEmail) {
        saveReporterName(cleanEmail, appData.name);
      }

      const updatedAppData: ReporterApplicationDetails = {
        ...appData,
        status: 'ACTIVE',
        reporterId: res.reporterId,
        validUntil: res.validUntil,
        paymentId,
        avatarUrl: finalPhoto || appData.avatarUrl,
      };

      setTimeout(() => {
        // Replace this screen with ReporterIdCardScreen
        navigate('/reporter/id-card', {
          replace: true,
          state: { appData: updatedAppData },
        });
      }, 500);

    } catch (err: any) {
      setError(err.message || "Couldn't generate your ID. Retry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true;
      generateId();
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#EAF2FB] relative font-sans text-[#0F172A] overflow-x-hidden">
      <ReporterPortalHeader />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10">
        <div className="w-full max-w-md bg-white border border-[#D6E4F5] rounded-[16px] p-6 sm:p-8 shadow-[0_4px_20px_rgba(18,84,168,0.08)]">
          
          {/* Header section */}
          <div className="mb-5 flex flex-col items-start">
            <div className="bg-[#EAF2FB] border border-[#D6E4F5] text-[#0F487F] text-[9.5px] uppercase tracking-wider font-extrabold py-1 px-2.5 rounded-full mb-2.5 shadow-sm">
              SPOT NEWS PORTAL
            </div>
            <h1 className="text-[#163E6C] text-2xl font-bold font-serif mb-1.5" style={{ fontFamily: "'Georgia', serif" }}>
              Payment received
            </h1>
            <div className="w-12 h-[3px] bg-[#CC1E1E] rounded-full"></div>
          </div>

          {/* Generating Card */}
          <div className="bg-[#F8FAFC] border border-[#D6E4F5] rounded-[14px] p-6 flex flex-col items-center text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-green-100/80 border border-green-300 text-green-600 flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h2 className="text-[#0F487F] font-bold text-lg mb-1 font-serif">
              Generating your reporter ID
            </h2>
            <p className="text-gray-600 text-xs leading-relaxed max-w-xs mb-5">
              This takes a few seconds. Don't close the app.
            </p>

            {/* Progress bar */}
            <div className="w-full bg-[#EAF2FB] border border-[#D6E4F5] rounded-full h-2.5 overflow-hidden mb-4 p-0.5">
              <div
                className="bg-[#015BB3] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            {/* Txn ID */}
            <span className="text-[11px] font-mono text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-[#D6E4F5]">
              Txn: {paymentId}
            </span>
          </div>

          {/* Error & Retry */}
          {error && (
            <div className="mt-5 p-4 bg-red-50 border border-[#CC1E1E] rounded-[12px] flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-[#CC1E1E] text-xs font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={generateId}
                disabled={loading}
                className="py-2 px-5 bg-[#CC1E1E] hover:bg-[#b51919] text-white font-bold text-xs font-serif rounded-[8px] flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Retry ID Generation
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
