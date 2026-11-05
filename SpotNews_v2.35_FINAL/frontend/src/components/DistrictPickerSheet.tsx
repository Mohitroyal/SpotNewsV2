import React, { useMemo, useState } from 'react';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { DISTRICTS, type DistrictInfo } from '@/features/daily/dailyContentEngine';
import { applyDistrict, detectDistrict } from '@/features/location/autoLocation';

interface Props {
  open: boolean;
  onClose: () => void;
  onPicked?: (d: DistrictInfo | null, mode: 'auto' | 'manual' | 'all') => void;
}

/** Bottom sheet: "use my location" or search a district (Telugu or English). */
export const DistrictPickerSheet: React.FC<Props> = ({ open, onClose, onPicked }) => {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return DISTRICTS.filter((d) => !s || d.en.toLowerCase().includes(s) || d.te.includes(q.trim()))
      .sort((a, b) => a.state.localeCompare(b.state) || a.en.localeCompare(b.en));
  }, [q]);

  if (!open) return null;

  const pick = (d: DistrictInfo | null, mode: 'auto' | 'manual' | 'all') => {
    applyDistrict(d, mode);
    onPicked?.(d, mode);
    onClose();
  };

  const useGps = async () => {
    setBusy(true); setMsg('');
    const r = await detectDistrict();
    setBusy(false);
    if (r.ok) return pick(r.district, 'auto');
    setMsg(r.reason === 'denied'
      ? 'లొకేషన్ అనుమతి ఇవ్వలేదు. కింద జిల్లాను ఎంచుకోండి. · Location permission was not given - pick your district below.'
      : r.reason === 'far'
        ? 'మీరు AP / తెలంగాణ బయట ఉన్నారు. జిల్లాను ఎంచుకోండి. · You seem to be outside AP / Telangana - pick a district.'
        : 'లొకేషన్ దొరకలేదు. జిల్లాను ఎంచుకోండి. · Could not find your location - pick your district.');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p className="text-[20px] font-extrabold text-[#0F172A] m-0">మీ ప్రాంతం</p>
            <p className="text-[14px] text-[#64748B] m-0">Your area</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-[#F1F5F9] border-0 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 space-y-3">
          <button type="button" onClick={useGps} disabled={busy}
            className="w-full rounded-2xl py-3.5 text-[17px] font-extrabold text-white border-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg,#0B4EA2,#1E6FD9)' }}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />} నా లొకేషన్ వాడండి · Use my location
          </button>
          {msg && <p className="text-[14px] font-semibold text-[#B45309] bg-[#FFF7E6] rounded-xl p-3 m-0">{msg}</p>}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[#D9E5F2] px-3">
            <Search className="w-5 h-5 text-[#64748B]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="జిల్లా వెతకండి · Search district"
              className="flex-1 py-3 text-[17px] outline-none border-0 bg-transparent" />
          </div>
        </div>
        <div className="overflow-y-auto px-3 pt-2 pb-6 mt-1">
          {!q && (
            <button type="button" onClick={() => pick(null, 'all')}
              className="w-full text-left px-3 py-3 rounded-xl bg-transparent border-0 cursor-pointer active:bg-[#F1F5F9] text-[17px] font-bold text-[#0F172A]">
              🌐 అన్ని జిల్లాలు · All districts
            </button>
          )}
          {list.map((d, i) => {
            const head = i === 0 || list[i - 1].state !== d.state ? d.state : '';
            return (
              <React.Fragment key={d.en}>
                {head && <p className="text-[13px] font-extrabold text-[#64748B] uppercase tracking-wide px-3 pt-3 pb-1 m-0">{head === 'Andhra Pradesh' ? 'ఆంధ్రప్రదేశ్ · Andhra Pradesh' : 'తెలంగాణ · Telangana'}</p>}
                <button type="button" onClick={() => pick(d, 'manual')}
                  className="w-full text-left px-3 py-3 rounded-xl bg-transparent border-0 cursor-pointer active:bg-[#F1F5F9] flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#E11D2E] shrink-0" />
                  <span className="text-[17px] font-bold text-[#0F172A]">{d.te}</span>
                  <span className="text-[14px] text-[#64748B]">{d.en}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
