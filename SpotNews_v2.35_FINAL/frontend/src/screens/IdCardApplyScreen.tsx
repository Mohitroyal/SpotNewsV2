import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IdCard, Loader2, ShieldCheck } from 'lucide-react';
import { BrandHeader } from '@/components/BrandHeader';
import { useAuthStore } from '@/store';
import { reporterAccountService, isApprovedStatus, type ReporterApplicationRow } from '@/services/reporterAccount.service';
import { reporterApprovalService } from '@/services/reporterApproval.service';

/**
 * Optional press ID card — only for approved reporters. Pay once (₹500 by default,
 * set REPORTER_MEMBERSHIP_PRICE_INR on the server) and the card is issued and can be downloaded.
 */
export const IdCardApplyScreen: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [app, setApp] = useState<ReporterApplicationRow | null | undefined>(undefined);
  const [price, setPrice] = useState<number>(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    reporterAccountService.findMyApplication(user.id, user.phone_number).then(setApp);
    const api = (import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com').replace(/\/+$/, '');
    fetch(`${api}/v1/reporter/payment/config`).then((r) => r.json()).then((c) => { if (c?.amount_inr) setPrice(Number(c.amount_inr)); }).catch(() => {});
  }, [user]);

  const pay = async () => {
    if (!app) return;
    setBusy(true); setError('');
    try {
      const order = await reporterApprovalService.createPaymentOrder(app.id, app.email || undefined);
      const res = await reporterApprovalService.startPayment({ ...order, name: app.name, phone: app.phone || undefined });
      if (!res.success) {
        if (!res.cancelled) setError(res.error || 'చెల్లింపు విఫలమైంది / Payment failed');
        setBusy(false);
        return;
      }
      const ver = await reporterApprovalService.verifyPayment(res.orderId || order.orderId, res.paymentId || '', res.signature, app.id);
      if (!ver.success) throw new Error(ver.error || 'Payment could not be verified');
      navigate('/reporter/id-card', {
        replace: true,
        state: {
          appData: {
            refNo: app.id, name: app.name, email: app.email || '', phone: app.phone || '',
            state: app.state || '', district: app.district || '', avatarUrl: app.photo_url || '',
            submittedDate: new Date().toLocaleDateString('en-IN'), status: 'ACTIVE',
            reporterId: ver.reporterId, validUntil: ver.validUntil, paymentId: res.paymentId,
          },
        },
      });
    } catch (e: any) {
      setError(e?.message || 'Payment error');
      setBusy(false);
    }
  };

  const approved = app && isApprovedStatus(app.status);

  return (
    <div className="min-h-screen bg-[#EEF3F8] flex flex-col">
      <BrandHeader badge="Reporter Portal" title="ప్రెస్ ID కార్డు" subtitle="Press ID card (optional)" onBack={() => navigate(-1)} />
      <main className="flex-1 w-full max-w-md mx-auto px-5 pb-10">
        <div className="bg-white rounded-3xl p-5 shadow-md border border-[#D9E5F2] space-y-4">
          {app === undefined ? (
            <div className="flex items-center justify-center gap-2 text-[18px] text-[#475569] py-8"><Loader2 className="w-6 h-6 animate-spin" /> చూస్తున్నాం…</div>
          ) : !approved ? (
            <>
              <p className="text-[18px] text-[#334155] m-0 leading-relaxed">సూపర్ అడ్మిన్ ఆమోదించిన తర్వాతే ID కార్డుకు దరఖాస్తు చేయవచ్చు.</p>
              <p className="text-[15px] text-[#64748B] m-0">You can apply after the super admin approves you.</p>
              <button className="w-full rounded-2xl py-4 text-[18px] font-extrabold text-white bg-[#015BB3] border-0" onClick={() => navigate('/reporter/status')}>స్థితి చూడండి · Status</button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-[#EAF2FB] text-[#015BB3]"><IdCard className="w-10 h-10" /></div>
              <h2 className="text-[22px] font-extrabold text-[#0F172A] text-center m-0">RTI Express ప్రెస్ ID కార్డు</h2>
              <ul className="text-[17px] text-[#334155] space-y-2 m-0 pl-5">
                <li>మీ ఫోటో, పేరు, జిల్లాతో అధికారిక ID కార్డు</li>
                <li>1 సంవత్సరం చెల్లుబాటు</li>
                <li>యాప్ నుండే డౌన్‌లోడ్ చేసుకోవచ్చు</li>
              </ul>
              <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 flex items-center justify-between">
                <span className="text-[17px] font-bold text-[#334155]">రుసుము · Fee</span>
                <span className="text-[26px] font-black text-[#0F172A]">₹{price}</span>
              </div>
              <button className="w-full rounded-2xl py-4 text-[19px] font-extrabold text-white bg-[#CC1E1E] border-0 flex items-center justify-center gap-2 disabled:opacity-60" disabled={busy} onClick={pay}>
                {busy && <Loader2 className="w-6 h-6 animate-spin" />} ₹{price} చెల్లించి దరఖాస్తు చేయండి
              </button>
              <p className="text-[14px] text-[#64748B] text-center m-0 flex items-center justify-center gap-1"><ShieldCheck className="w-4 h-4" /> UPI / కార్డు ద్వారా సురక్షిత చెల్లింపు (Razorpay)</p>
              {error && <p className="text-[16px] font-semibold text-[#B91C1C] m-0">{error}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
