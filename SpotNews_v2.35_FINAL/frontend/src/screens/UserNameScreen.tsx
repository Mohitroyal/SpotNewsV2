import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft } from 'lucide-react';
import iconLogo from '@/assets/icon.png';
import { useAuthStore, saveReporterName } from '@/store';

export const UserNameScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const updateUser = useAuthStore((state) => state.updateUser);

  const isValid = name.trim().length >= 2;

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const trimmedName = name.trim();

    // If user is already authenticated, update their name
    if (user) {
      updateUser({ full_name: trimmedName, firstName: trimmedName });
      if (user.email) {
        saveReporterName(user.email, trimmedName);
      }
    } else {
      // Create guest reader session with the custom name
      login(
        {
          id: `guest_${Date.now()}`,
          email: 'guest@spotnews.local',
          full_name: trimmedName,
          firstName: trimmedName,
          role: 'reader',
          plan: 'free',
        } as any,
        'guest_session_token'
      );
    }

    try {
      localStorage.setItem('spotnews_reader_name', trimmedName);
      localStorage.setItem('spotnews_active_reporter_name', trimmedName);
    } catch {}

    navigate('/');
  };

  const handleSkip = () => {
    // If not authenticated, create default reader session
    if (!user) {
      login(
        {
          id: `guest_${Date.now()}`,
          email: 'guest@spotnews.local',
          full_name: 'Guest Reader',
          firstName: 'Guest Reader',
          role: 'reader',
          plan: 'free',
        } as any,
        'guest_session_token'
      );
    }

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col justify-between font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* ── Top Wave Header with Back Button, Left Logo and Full Brand Name ── */}
      <header className="w-full relative z-20">
        <div className="bg-[#015BB3] pt-safe px-4 pt-4 pb-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/welcome')}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center transition-all border border-white/25 shadow-xs shrink-0"
              title="Back to Welcome Page"
              aria-label="Back to Welcome Page"
            >
              <ArrowLeft className="w-5 h-5 text-white" strokeWidth={2.5} />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white p-0.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden border border-white/40">
              <img
                src={iconLogo}
                alt="RTI Express Spot News 24x7"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <span className="text-white font-black text-[15px] sm:text-[17px] tracking-wide truncate uppercase">
              RTI EXPRESS SPOT NEWS 24X7
            </span>
          </div>
          <div className="w-1" />
        </div>

        {/* Smooth Wave SVG */}
        <div className="w-full overflow-hidden leading-none relative bg-[#F0F4F8]">
          <svg
            viewBox="0 0 1440 180"
            preserveAspectRatio="none"
            className="w-full h-8 block"
          >
            <path
              d="M0,0 L1440,0 L1440,60 C1080,160 480,20 0,110 Z"
              fill="#015BB3"
            />
          </svg>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 w-full max-w-md mx-auto">
        {/* White Card Container with Increased Thicker Border */}
        <div className="w-full bg-white border-2 sm:border-[2.5px] border-[#94BEE8] rounded-[28px] p-6 sm:p-8 shadow-[0_12px_28px_rgba(1,91,179,0.12)] flex flex-col items-center text-center">
          {/* User Icon Circle with Increased Border */}
          <div className="w-20 h-20 rounded-full bg-[#E0EDFB] border-2 border-[#015BB3]/30 flex items-center justify-center mb-5 shadow-xs">
            <User className="w-10 h-10 text-[#015BB3]" strokeWidth={2.2} />
          </div>

          {/* Headline in Telugu */}
          <h1
            className="text-[#0B3B60] text-[22px] sm:text-[25px] font-black leading-snug tracking-tight mb-1"
            style={{ fontFamily: "'Noto Sans Telugu', 'Plus Jakarta Sans', sans-serif" }}
          >
            స్వాగతం! మిమ్మల్ని ఏమని పిలవాలి?
          </h1>

          {/* Telugu Sub-headline */}
          <h2
            className="text-[#015BB3] text-[16px] font-bold mb-2.5"
            style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}
          >
            మీ పేరు నమోదు చేయండి
          </h2>

          {/* Description */}
          <p className="text-[#64748B] text-[13px] leading-relaxed max-w-[280px] mb-6">
            Your name will show on your profile and comments in the app.
          </p>

          {/* Input Form with Increased Thicker Border */}
          <form onSubmit={handleContinue} className="w-full text-left">
            <label className="block text-[13px] font-bold text-[#1E3A8A] mb-1.5">
              User name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              className="w-full bg-[#F8FAFC] border-2 border-[#94BEE8] rounded-[14px] px-4 py-3.5 text-[#0F172A] text-[15px] font-semibold focus:outline-none focus:border-[#015BB3] focus:ring-4 focus:ring-[#015BB3]/15 shadow-xs transition-all"
            />
            <p className="text-[12px] text-[#64748B] mt-1.5">
              At least 2 characters
            </p>

            {/* Continue Button */}
            <button
              type="submit"
              disabled={!isValid}
              className={`w-full py-3.5 px-4 rounded-[14px] font-bold text-[16px] mt-4 transition-all duration-200 ${
                isValid
                  ? 'bg-[#015BB3] hover:bg-[#0B4D94] active:scale-[0.98] text-white shadow-[0_4px_14px_rgba(1,91,179,0.3)] cursor-pointer'
                  : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed opacity-80'
              }`}
            >
              Continue
            </button>
          </form>
        </div>

        {/* Skip for now Link */}
        <button
          type="button"
          onClick={handleSkip}
          className="mt-6 text-[14px] font-bold text-[#015BB3] underline hover:text-[#0C447C] transition-colors cursor-pointer"
        >
          Skip for now
        </button>

        {/* Footer Note */}
        <p className="text-[12px] text-[#64748B] text-center mt-2 max-w-[280px]">
          You can add or change your name later from Settings.
        </p>
      </main>

      {/* Subtle bottom padding */}
      <footer className="py-2" />
    </div>
  );
};
