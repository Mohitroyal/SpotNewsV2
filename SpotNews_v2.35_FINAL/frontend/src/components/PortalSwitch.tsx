import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Mic } from 'lucide-react';
import { useAuthStore } from '@/store';

/** Big two-way switch: Readers ↔ Reporters. Readers never need a login. */
export const PortalSwitch: React.FC<{ active: 'readers' | 'reporters' }> = ({ active }) => {
  const navigate = useNavigate();
  const goReaders = () => {
    if (!useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().login(
        { id: `guest_${Date.now()}`, email: 'guest@spotnews.local', full_name: 'Guest Reader', role: 'reader', plan: 'free' } as any,
        'guest_session_token',
      );
    }
    navigate('/');
  };
  return (
    <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#EEF3F8] border border-[#D9E5F2]" role="tablist">
      <button type="button" role="tab" aria-selected={active === 'readers'} onClick={goReaders}
        className={`rounded-xl py-2.5 flex items-center justify-center gap-1.5 border-0 cursor-pointer text-[15px] font-extrabold ${active === 'readers' ? 'text-white shadow-md' : 'bg-transparent text-[#0B3E8A]'}`}
        style={active === 'readers' ? { background: 'linear-gradient(135deg,#0B4EA2,#2F80ED)' } : undefined}>
        <BookOpen className="w-5 h-5" /> పాఠకులు · Readers
      </button>
      <button type="button" role="tab" aria-selected={active === 'reporters'} onClick={() => navigate('/reporter')}
        className={`rounded-xl py-2.5 flex items-center justify-center gap-1.5 border-0 cursor-pointer text-[15px] font-extrabold ${active === 'reporters' ? 'text-white shadow-md' : 'bg-transparent text-[#B3121F]'}`}
        style={active === 'reporters' ? { background: 'linear-gradient(135deg,#E11D2E,#B30F1C)' } : undefined}>
        <Mic className="w-5 h-5" /> రిపోర్టర్లు · Reporters
      </button>
    </div>
  );
};
