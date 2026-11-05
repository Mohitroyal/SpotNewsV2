import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store';
import { LogoWatermark } from '@/components/LogoWatermark';
import logoUrl from '@/assets/rti_express_logo.png';

export const CreatePasswordScreen = () => {
  const location = useLocation();
  const isNewUser = Boolean(location.state?.isNewUser);
  const passedEmail = location.state?.email || '';
  const passedMessage = location.state?.message || '';

  const [email, setEmail] = useState(passedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      if (data.session?.user?.email && !email) {
        setEmail(data.session.user.email);
      }
    });
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // 1. Update user password in Supabase Auth and mark has_password = true
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          has_password: true,
        }
      });

      if (updateError) throw updateError;

      // 2. Clear current session so they explicitly sign in with their credentials
      await supabase.auth.signOut();
      useAuthStore.getState().logout();
      navigate('/login', { 
        state: { 
          message: 'Password created successfully! Please sign in with your email and password.',
          email: email || passedEmail,
          defaultTab: 'login',
        } 
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#dceef8] relative font-sans text-[#0a1a2e]">
      {/* ── RTI Express watermark ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
         <LogoWatermark darkBackground={false} opacity={0.04} />
      </div>

      {/* ── HEADER ── */}
      <div className="bg-[#0a2540] border-b-[3px] border-[#cc2222] flex items-center justify-center py-4 px-4 shrink-0 shadow-sm relative z-20">
         <div className="flex items-center gap-2">
           <img src={logoUrl} alt="Spot News" className="w-10 h-10 object-contain rounded-md shadow-sm" />
           <div className="flex flex-col">
             <span className="text-white font-bold text-[18px] leading-tight tracking-wide font-serif">SPOT NEWS</span>
             <span className="text-[#a0c4dc] text-[8px] uppercase tracking-widest font-semibold leading-none">24X7 News Generator</span>
           </div>
         </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md bg-white border border-[#b8d4e8] rounded-xl p-8 shadow-sm">
          
          <div className="mb-6 flex flex-col items-start">
            <div className="bg-[#0a2540] text-white text-[9px] uppercase tracking-widest font-bold py-1 px-2.5 rounded-full mb-3 shadow-sm flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#cc2222]" />
              {isNewUser ? 'Account Setup' : 'Security'}
            </div>
            <h1 className="text-[#0a1a2e] text-2xl font-bold font-serif mb-2">
              {isNewUser ? 'Create Password' : 'Set New Password'}
            </h1>
            <p className="text-xs text-[#5b7e9a] font-medium leading-relaxed">
              {isNewUser 
                ? 'Create a secure password for your new account to complete registration.'
                : 'Create a secure password for your reporter account.'}
            </p>
            <div className="w-12 h-[3px] bg-[#cc2222] rounded-full mt-3"></div>
          </div>

          {passedMessage && (
            <div className="mb-4 p-3 bg-blue-50 border border-[#015BB3] rounded-[8px] text-[#015BB3] text-xs font-semibold text-center shadow-sm">
              {passedMessage}
            </div>
          )}

          {email && (
            <div className="mb-4 p-2.5 bg-[#f0f6fc] border border-[#dceef8] rounded-[6px] text-xs flex items-center gap-2 text-[#0a2540]">
              <Mail className="w-4 h-4 text-[#015BB3] shrink-0" />
              <span className="truncate">Account: <strong>{email}</strong></span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-[#cc2222] rounded-[8px] text-[#cc2222] text-xs font-semibold text-center shadow-sm">
              {error}
            </div>
          )}

          {hasSession === false && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-[8px] text-amber-900 text-xs text-center shadow-sm">
              Please use the password reset link or sign in with Google to set your password.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0c4dc]" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#dceef8] rounded-[6px] py-[10px] pl-[36px] pr-10 text-[#0a1a2e] text-sm placeholder:text-[#a0c4dc] focus:outline-none focus:ring-1 focus:ring-[#0a2540] font-medium"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5b7e9a] hover:text-[#0a2540]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0c4dc]" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#dceef8] rounded-[6px] py-[10px] pl-[36px] pr-10 text-[#0a1a2e] text-sm placeholder:text-[#a0c4dc] focus:outline-none focus:ring-1 focus:ring-[#0a2540] font-medium"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-[12px] mt-2 bg-[#cc2222] hover:bg-[#ff3333] active:bg-[#a01b1b] text-white rounded-[6px] font-bold text-sm font-serif tracking-wide transition-colors shadow-sm flex items-center justify-center disabled:opacity-70 disabled:hover:bg-[#cc2222] cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isNewUser ? 'Save Password & Sign In' : 'Update Password & Sign In')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-[#0a2540] text-xs font-bold hover:underline transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="bg-[#0a2540] border-t-[2px] border-[#cc2222] py-4 px-4 flex items-center justify-center shrink-0 relative z-20">
        <span className="text-[#a0c4dc] text-[9px] font-medium tracking-wide">
          Terms of Service &middot; Privacy Policy &middot; Help
        </span>
      </div>
    </div>
  );
};

