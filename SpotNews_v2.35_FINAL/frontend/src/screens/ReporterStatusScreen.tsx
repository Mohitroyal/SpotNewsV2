import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, IdCard, Loader2, LogOut, PenSquare, RefreshCw, XCircle } from 'lucide-react';
import { BrandHeader } from '@/components/BrandHeader';
import { useAuthStore } from '@/store';
import { reporterAccountService, isApprovedStatus, type ReporterApplicationRow } from '@/services/reporterAccount.service';

/**
 * After registering: waiting for super admin → approved → (optional) press ID card.
 */
export const ReporterStatusScreen: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [app, setApp] = useState<ReporterApplicationRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return setApp(null);
    setBusy(true);
    const row = await reporterAccountService.findMyApplication(user.id, user.phone_number);
    setApp(row);
    if (row && isApprovedStatus(row.status) && user.role !== 'reporter') {
      useAuthStore.getState().updateUser({ role: 'reporter', district: row.district || undefined, state: row.state || undefined } as any);
    }
    setBusy(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  // Check every 30 s while waiting, so approval shows up without restarting the app
  useEffect(() => {
    if (!app || app.status !== 'pending') return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [app, load]);

  const logout = () => {
    useAuthStore.getState().logout();
    navigate('/', { replace: true });
  };

  if (!user) {
    return (
      <Shell onBack={() => navigate('/')}>
        <p className="text-[18px] text-[#334155] m-0">దయచేసి లాగిన్ అవ్వండి · Please log in.</p>
        <button className="w-full rounded-2xl py-4 text-[19px] font-extrabold text-white bg-[#CC1E1E] border-0" onClick={() => navigate('/reporter')}>లాగిన్ · Login</button>
      </Shell>
    );
  }

  const status = (app?.status || '').toLowerCase();
  const approved = isApprovedStatus(status);
  const hasIdCard = status === 'active' || app?.id_card_status === 'issued' || app?.payment_status === 'paid';

  return (
    <Shell onBack={() => navigate('/')}>
      {app === undefined || (busy && !app) ? (
        <div className="flex items-center justify-center gap-2 text-[18px] text-[#475569] py-8"><Loader2 className="w-6 h-6 animate-spin" /> చూస్తున్నాం…</div>
      ) : !app ? (
        <>
          <p className="text-[18px] text-[#334155] m-0 leading-relaxed">మీ నమోదు ఇంకా పూర్తి కాలేదు. · Your registration is not complete yet.</p>
          <button className="w-full rounded-2xl py-4 text-[19px] font-extrabold text-white bg-[#CC1E1E] border-0" onClick={() => navigate('/reporter/apply')}>నమోదు పూర్తి చేయండి · Finish registration</button>
        </>
      ) : status === 'pending' ? (
        <>
          <Badge color="#B45309" bg="#FFF7E6" icon={<Clock className="w-9 h-9" />} />
          <h2 className="text-[24px] font-extrabold text-[#0F172A] text-center m-0">నమోదు అందింది ✓</h2>
          <p className="text-[18px] text-[#334155] text-center m-0 leading-relaxed">
            సూపర్ అడ్మిన్ మీ ఆధార్ చూసి ఆమోదిస్తారు. ఆమోదం రాగానే మీకు నోటిఫికేషన్ వస్తుంది.
          </p>
          <p className="text-[15px] text-[#64748B] text-center m-0">Registration received. The super admin will check your Aadhaar and approve you.</p>
          <button className="w-full rounded-2xl py-4 text-[18px] font-extrabold text-[#015BB3] bg-white border-2 border-[#015BB3] flex items-center justify-center gap-2" onClick={load} disabled={busy}>
            <RefreshCw className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} /> స్థితి చూడండి · Check status
          </button>
          <button className="w-full rounded-2xl py-4 text-[18px] font-extrabold text-white bg-[#015BB3] border-0" onClick={() => navigate('/')}>వార్తలు చదవండి · Read news</button>
        </>
      ) : approved ? (
        <>
          <Badge color="#15803D" bg="#ECFDF3" icon={<CheckCircle2 className="w-9 h-9" />} />
          <h2 className="text-[24px] font-extrabold text-[#0F172A] text-center m-0">మీరు రిపోర్టర్! 🎉</h2>
          <p className="text-[17px] text-[#334155] text-center m-0">You are approved as a reporter{app.district ? ` · ${app.district}` : ''}.</p>
          <button className="w-full rounded-2xl py-4 text-[19px] font-extrabold text-white bg-[#CC1E1E] border-0 flex items-center justify-center gap-2" onClick={() => navigate('/generate')}>
            <PenSquare className="w-6 h-6" /> వార్త పంపండి · Create news
          </button>
          {hasIdCard ? (
            <button className="w-full rounded-2xl py-4 text-[18px] font-extrabold text-[#015BB3] bg-white border-2 border-[#015BB3] flex items-center justify-center gap-2" onClick={() => navigate('/reporter/id-card')}>
              <IdCard className="w-6 h-6" /> నా ప్రెస్ ID కార్డు · My press ID card
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#015BB3] bg-[#F8FBFF] p-4 space-y-2">
              <p className="text-[17px] font-extrabold text-[#0F172A] m-0 flex items-center gap-2"><IdCard className="w-6 h-6 text-[#015BB3]" /> ప్రెస్ ID కార్డు (ఐచ్ఛికం)</p>
              <p className="text-[15px] text-[#475569] m-0">కావాలనుకుంటే మాత్రమే దరఖాస్తు చేయండి. · Optional — apply only if you want one.</p>
              <button className="w-full rounded-xl py-3.5 text-[17px] font-extrabold text-white bg-[#015BB3] border-0" onClick={() => navigate('/reporter/id-card-apply')}>ID కార్డుకు దరఖాస్తు · Apply</button>
            </div>
          )}
        </>
      ) : (
        <>
          <Badge color="#B91C1C" bg="#FEF2F2" icon={<XCircle className="w-9 h-9" />} />
          <h2 className="text-[22px] font-extrabold text-[#0F172A] text-center m-0">నమోదు ఆమోదించబడలేదు</h2>
          {app.rejection_reason && <p className="text-[17px] text-[#334155] text-center m-0">{app.rejection_reason}</p>}
          <p className="text-[16px] text-[#475569] text-center m-0">సహాయం కోసం: 7668886666</p>
          <button className="w-full rounded-2xl py-4 text-[18px] font-extrabold text-white bg-[#015BB3] border-0" onClick={() => navigate('/')}>వార్తలు చదవండి · Read news</button>
        </>
      )}
      <button className="w-full flex items-center justify-center gap-2 text-[16px] font-bold text-[#64748B] bg-transparent border-0 py-2" onClick={logout}>
        <LogOut className="w-5 h-5" /> లాగ్ అవుట్ · Log out
      </button>
    </Shell>
  );
};

const Shell: React.FC<{ onBack: () => void; children: React.ReactNode }> = ({ onBack, children }) => (
  <div className="min-h-screen bg-[#EEF3F8] flex flex-col">
    <BrandHeader badge="Reporter Portal" title="రిపోర్టర్ స్థితి" subtitle="Reporter status" onBack={onBack} />
    <main className="flex-1 w-full max-w-md mx-auto px-5 pb-10">
      <div className="bg-white rounded-3xl p-5 shadow-md border border-[#D9E5F2] space-y-4">{children}</div>
    </main>
  </div>
);

const Badge: React.FC<{ color: string; bg: string; icon: React.ReactNode }> = ({ color, bg, icon }) => (
  <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
);
