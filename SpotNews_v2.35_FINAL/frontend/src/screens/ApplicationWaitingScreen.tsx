import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { supabase } from '@/lib/supabase';
import { routeByStatus } from '@/utils/statusRouting';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const ApplicationWaitingScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialAppData: ReporterApplicationDetails = location.state?.appData || {
    refNo: 'SNP-REF-889021',
    name: 'Reporter Candidate',
    email: 'reporter@example.com',
    phone: '9876543210',
    district: 'Hyderabad',
    state: 'Telangana',
    submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'PENDING',
  };

  const [appData, setAppData] = useState<ReporterApplicationDetails>(initialAppData);
  const [checking, setChecking] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const checkStatus = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const updated = await reporterApprovalService.checkStatus(
        appData.email || appData.phone || 'reporter@example.com',
        appData.refNo
      );

      if (updated) {
        setAppData(updated);
        if (updated.status === 'APPROVED_PAYMENT_PENDING' || updated.status === 'ACTIVE' || updated.status === 'REJECTED') {
          routeByStatus(updated.status, navigate, updated);
          return;
        }
      }

      if (manual) {
        setFeedbackMsg('Your application is still under review by the super admin.');
        setTimeout(() => setFeedbackMsg(''), 4000);
      }
    } catch (e) {
      console.error('Status check error:', e);
    } finally {
      if (manual) setChecking(false);
    }
  }, [appData.email, appData.phone, appData.refNo, navigate]);

  // 1. Supabase Realtime Subscription for instant automatic transition
  useEffect(() => {
    const channel = supabase
      .channel('reporter_app_approval')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reporter_applications',
          filter: appData.refNo && !appData.refNo.startsWith('SNP-REF-') 
            ? `id=eq.${appData.refNo}` 
            : undefined,
        },
        (payload) => {
          const newStatus = (payload.new?.status || '').toLowerCase();
          if (newStatus === 'approved') {
            const nextData: ReporterApplicationDetails = {
              ...appData,
              status: 'APPROVED_PAYMENT_PENDING',
              refNo: payload.new?.id || appData.refNo,
            };
            setAppData(nextData);
            routeByStatus('APPROVED_PAYMENT_PENDING', navigate, nextData);
          } else if (newStatus === 'rejected') {
            routeByStatus('REJECTED', navigate, { ...appData, status: 'REJECTED' });
          } else if (newStatus === 'active') {
            routeByStatus('ACTIVE', navigate, { ...appData, status: 'ACTIVE' });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appData, navigate]);

  // 2. Fallback polling every 5 seconds for reliable sync
  useEffect(() => {
    const timer = setInterval(() => {
      checkStatus(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [checkStatus]);

  const reportingCentre = appData.district 
    ? `${appData.district}${appData.state ? `, ${appData.state}` : ''}`
    : 'District / reporting centre';

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      <FigmaScreenHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-5 py-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Step Pill */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF3FB] text-[#0B4EA2] text-[11px] font-black tracking-wider uppercase">
            STEP 1 OF 3 / APPROVAL
          </div>

          {/* Heading & Subtitle */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              Your story starts here.
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
              Your reporter application is with the super admin.
            </p>
          </div>

          {feedbackMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Card 1: Application received */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
              Application received
            </span>
            <p className="text-sm font-bold text-[#0F172A]">
              {appData.name || 'Reporter Candidate'}
            </p>
            <p className="text-xs text-[#64748B]">
              {appData.email}
            </p>
            <p className="text-xs text-[#64748B]">
              {reportingCentre}
            </p>
          </div>

          {/* Card 2: Awaiting approval */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A]">
                Awaiting approval
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                In review
              </span>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Once your email is approved, we'll take you to payment automatically.
            </p>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3.5">
            {/* 01 Application submitted */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#EBF3FB] text-[#0B4EA2] flex items-center justify-center text-xs font-extrabold shrink-0 border border-[#D5E5F7]">
                <CheckCircle2 className="w-4 h-4 text-[#0B4EA2]" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">01 Application submitted</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Done</span>
              </div>
            </div>

            {/* 02 Super admin review */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-black shrink-0 border border-amber-300">
                02
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">02 Super admin review</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Current</span>
              </div>
            </div>

            {/* 03 Payment & activation */}
            <div className="flex items-center gap-3 opacity-60">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 border border-slate-200">
                03
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">03 Payment & activation</span>
                <span className="text-[10px] font-medium text-slate-400">Next</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-2.5">
          <button
            type="button"
            onClick={() => checkStatus(true)}
            disabled={checking}
            className="w-full py-3.5 px-4 bg-[#0B4EA2] hover:bg-[#093F84] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking status...</span>
              </>
            ) : (
              <span>Check approval status</span>
            )}
          </button>

          <a
            href="mailto:support@spotnews24x7.com?subject=Spot%20News%20Reporter%20Approval%20Inquiry"
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-[#CBD5E1] text-[#0F172A] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            Contact support
          </a>
        </div>
      </main>
    </div>
  );
};
