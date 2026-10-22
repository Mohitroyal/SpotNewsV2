import { useState, useEffect, useRef } from 'react';
import { useAuthStore, saveReporterPhoto, saveReporterName, isAdminUser, isSuperAdminUser, getEffectiveReporterPhoto } from '@/store';
import { authService } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, Lock, Phone, User as UserIcon, MapPin, Copy, Check, Camera } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import logoUrl from '@/assets/rti_express_logo.png';
import watermarkLogo from '@/assets/rti_express_watermark.png';
import { INDIA_STATES } from '@/utils/indiaStates';
import { CheckStatusTab } from '@/components/CheckStatusTab';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { routeByStatus } from '@/utils/statusRouting';

export const LoginScreen = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'apply' | 'check-status'>('login');
  const [submittedRefNo, setSubmittedRefNo] = useState<string>('');
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab as any);
    }
    if (location.state?.message) {
      setSuccessMsg(location.state.message);
    }
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);
  
  // Reporter Application state
  const [applyForm, setApplyForm] = useState({
    name: '',
    email: '',
    phone: '',
    aadhar: '',
    pressId: '',
    state: '',
    district: '',
    photo: '',
  });
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        const targetSize = 250;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, targetSize, targetSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setApplyForm((prev) => ({ ...prev, photo: dataUrl }));
        } else {
          const dataUrl = event.target?.result as string;
          setApplyForm((prev) => ({ ...prev, photo: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };



  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowSignupPrompt(false);

    try {
      const res = await authService.login({ email, password });
      if (res.data) {
        const userObj = { ...res.data.user };
        
        // Check application status
        try {
          const { data: appData } = await supabase
            .from('reporter_applications')
            .select('*')
            .eq('email', email.trim())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (appData) {
            // Only require approval if they submitted an actual application as a reporter with documents
            const isActualReporterApplication = Boolean(appData.aadhar_card || appData.press_id);
            if (isActualReporterApplication) {
              const dbStatus = appData.status?.toLowerCase();
              let mappedStatus = 'PENDING';
              if (dbStatus === 'pending') mappedStatus = 'PENDING';
              else if (dbStatus === 'approved') mappedStatus = 'APPROVED_PAYMENT_PENDING';
              else if (dbStatus === 'rejected') mappedStatus = 'REJECTED';
              else if (dbStatus === 'active') mappedStatus = 'ACTIVE';

              // Only block login if their reporter application is NOT active
              if (mappedStatus !== 'ACTIVE') {
              await authService.logout();
              
              const formattedAppData = {
                refNo: appData.id,
                name: appData.name,
                email: appData.email,
                phone: appData.phone,
                state: appData.state,
                district: appData.district,
                submittedDate: new Date(appData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                status: mappedStatus as any,
              };

              import('@/utils/statusRouting').then(({ routeByStatus }) => {
                routeByStatus(mappedStatus as any, navigate, formattedAppData);
              });
              
              setLoading(false);
              return;
            }
          }
        }
        } catch (e) {
          // ignore if not found
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userObj.id)
            .single();
          if (profile?.role) {
            userObj.role = profile.role;
          }
        } catch {}

        const finalPhoto = getEffectiveReporterPhoto(email, [
          (userObj as any)?.avatarUrl,
          (userObj as any)?.user_metadata?.avatar_url,
          (userObj as any)?.user_metadata?.picture
        ]);
        if (finalPhoto) {
          userObj.avatarUrl = finalPhoto;
          saveReporterPhoto(email, finalPhoto);
        }
        const finalName = (userObj as any)?.user_metadata?.full_name || (userObj as any)?.user_metadata?.name || userObj.full_name || userObj.firstName;
        if (finalName) {
          saveReporterName(email, finalName);
        }
        login(userObj, res.data.token);
        
        // Role based access logic
        if (isAdminUser(userObj)) {
          navigate('/admin');
        } else if (userObj.role === 'reporter') {
          navigate('/');
        } else {
          // Normal user goes to some user view, but currently everything is reporter portal
          navigate('/'); 
        }
      }
    } catch (err: any) {
      const errMsg = err.message || err.response?.data?.message || '';
      if (
        errMsg.toLowerCase().includes('invalid login credentials') ||
        errMsg.toLowerCase().includes('invalid_credentials')
      ) {
        setError('Invalid email or password.');
        setShowSignupPrompt(true);
      } else if (
        errMsg.toLowerCase().includes('user not found')
      ) {
        setShowSignupPrompt(true);
      } else {
        setError(errMsg || 'Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const cleanEmail = applyForm.email.toLowerCase().trim();
      const rawPhone = applyForm.phone.trim();
      const cleanPhoneDigits = rawPhone.replace(/\D/g, '');
      const last10Digits = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : cleanPhoneDigits;

      if (!cleanEmail) {
        setError('Please enter your email address.');
        setLoading(false);
        return;
      }

      if (!last10Digits || last10Digits.length < 10) {
        setError('Please enter a valid 10-digit mobile number.');
        setLoading(false);
        return;
      }

      // Check for repeated email or phone number in reporter applications
      try {
        const { data: checkResult, error: checkRpcErr } = await supabase.rpc('check_existing_application_rpc', {
          p_email: cleanEmail,
          p_phone: rawPhone,
        });

        if (!checkRpcErr && checkResult && checkResult.exists) {
          const matchLabel = checkResult.match_type === 'email' ? 'email address' : 'phone number';
          const appStatus = (checkResult.status || 'pending').toUpperCase();
          setError(`An application with this ${matchLabel} has already been submitted (Status: ${appStatus}). Repeated applications are not allowed.`);
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Pre-check duplicate RPC error:', checkErr);
      }

      let actualRefNo = 'SNP-REF-' + Math.floor(100000 + Math.random() * 900000);
      
      const { error: insertError } = await supabase.from('reporter_applications').insert([
        {
          name: applyForm.name.trim(),
          email: cleanEmail,
          phone: rawPhone,
          aadhar_card: applyForm.aadhar,
          press_id: applyForm.pressId,
          status: 'pending',
          state: applyForm.state,
          district: applyForm.district
        }
      ]);

      if (insertError) {
        const errMsg = insertError.message || '';
        if (errMsg.toLowerCase().includes('already been submitted') || errMsg.includes('already exists')) {
          setError(errMsg);
          setLoading(false);
          return;
        }
        throw insertError;
      }

      // Permanently fix the official photo for this applicant's ID card
      if (applyForm.photo) {
        const cleanEmail = applyForm.email.toLowerCase().trim();
        saveReporterPhoto(cleanEmail, applyForm.photo);
        try {
          localStorage.setItem('spotnews_registration_photo', applyForm.photo);
          localStorage.setItem('spotnews_active_reporter_photo', applyForm.photo);
          localStorage.setItem(`spotnews_reporter_photo_${cleanEmail}`, applyForm.photo);
          localStorage.setItem(`spotnews_id_card_photo_${cleanEmail}`, applyForm.photo);
        } catch {}
      }
      if (applyForm.name) {
        saveReporterName(applyForm.email.toLowerCase().trim(), applyForm.name.trim());
      }

      // Save application data in service (kept for backwards compatibility if needed)
      const appData = {
        refNo: actualRefNo,
        name: applyForm.name,
        email: applyForm.email,
        phone: applyForm.phone,
        state: applyForm.state,
        district: applyForm.district,
        pressId: applyForm.pressId,
        avatarUrl: applyForm.photo || '',
        submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: 'PENDING' as const,
      };
      
      try { reporterApprovalService.saveMockApplication(appData); } catch (e) {}

      setSubmittedRefNo(actualRefNo);
      setSuccessMsg('Your application has been submitted to the superadmin for approval.');
      setApplyForm({ name: '', email: '', phone: '', aadhar: '', pressId: '', state: '', district: '', photo: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setShowSignupPrompt(false);
      
      const response = await GoogleAuth.signIn();

      if (response && response.authentication) {
        const { error: authError, data: sessionData } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.authentication.idToken,
        });

        if (authError) throw authError;

        if (sessionData.session) {
          const userObj = { ...sessionData.session.user } as any;
          const googleEmail = (userObj?.email || '').toLowerCase().trim();

          // 1. Check if Admin / Superadmin
          if (isAdminUser(userObj) || isSuperAdminUser(userObj) || googleEmail === 'mohithroyal16450@gmail.com') {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userObj.id)
                .single();
              if (profile?.role) {
                userObj.role = profile.role;
              }
            } catch {}

            const finalPhoto = getEffectiveReporterPhoto(googleEmail, [
              userObj?.avatarUrl,
              userObj?.user_metadata?.avatar_url,
              userObj?.user_metadata?.picture
            ]);
            if (finalPhoto) {
              userObj.avatarUrl = finalPhoto;
              saveReporterPhoto(googleEmail, finalPhoto);
            }
            login(userObj, sessionData.session.access_token);
            navigate('/admin');
            return;
          }

          // 2. Check reporter_applications table in database
          let appData: any = null;
          try {
            const { data } = await supabase
              .from('reporter_applications')
              .select('*')
              .ilike('email', googleEmail)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            appData = data;
          } catch (e) {
            console.warn('Error checking reporter_applications:', e);
          }

          if (appData) {
            const isActualReporterApplication = Boolean(appData.aadhar_card || appData.press_id);
            const dbStatus = appData.status?.toLowerCase();
            let mappedStatus = 'PENDING';
            if (dbStatus === 'pending') mappedStatus = 'PENDING';
            else if (dbStatus === 'approved') mappedStatus = 'APPROVED_PAYMENT_PENDING';
            else if (dbStatus === 'rejected') mappedStatus = 'REJECTED';
            else if (dbStatus === 'active') mappedStatus = 'ACTIVE';

            // If their application is pending, approved (payment pending), or rejected, block direct login
            if (isActualReporterApplication && mappedStatus !== 'ACTIVE') {
              await supabase.auth.signOut();
              useAuthStore.getState().logout();
              
              const formattedAppData = {
                refNo: appData.id,
                name: appData.name,
                email: appData.email,
                phone: appData.phone,
                state: appData.state,
                district: appData.district,
                submittedDate: new Date(appData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                status: mappedStatus as any,
              };

              routeByStatus(mappedStatus as any, navigate, formattedAppData);
              setLoading(false);
              return;
            }
          }

          // 3. Check if user is a NEW user or has not created a password
          // In Supabase, users authenticating only via Google have providers = ['google'].
          // If they haven't set a password (has_password is not true in metadata, and no password provider),
          // OR if they do not have an approved application in the database:
          const hasPassword = Boolean(
            userObj?.user_metadata?.has_password || 
            userObj?.app_metadata?.providers?.includes('email')
          );
          const hasActiveAccount = appData && appData.status?.toLowerCase() === 'active';

          // If it is a new user without an account in the database OR has no password set:
          if (!hasActiveAccount || !hasPassword) {
            // Keep the Supabase session active so CreatePasswordScreen can call supabase.auth.updateUser({ password })
            navigate('/create-password', { 
              state: { 
                email: googleEmail, 
                isNewUser: true,
                message: 'Welcome! Please create a password for your account to complete registration.'
              } 
            });
            setLoading(false);
            return;
          }

          // 4. Existing active user with password set -> allow login
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userObj.id)
              .single();
            if (profile?.role) {
              userObj.role = profile.role;
            }
          } catch {}

          const finalPhoto = getEffectiveReporterPhoto(googleEmail, [
            userObj?.avatarUrl,
            userObj?.user_metadata?.avatar_url,
            userObj?.user_metadata?.picture
          ]);
          if (finalPhoto) {
            userObj.avatarUrl = finalPhoto;
            saveReporterPhoto(googleEmail, finalPhoto);
          }
          login(userObj, sessionData.session.access_token);
          navigate('/');
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-[#EAF2FB] relative font-sans text-[#0F172A] overflow-x-hidden">
      {/* ══ RTI Express background watermark ══ */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-30deg)',
          zIndex: 0,
          pointerEvents: 'none',
          width: '100vw',
          maxWidth: '500px',
          opacity: 0.08,
          mixBlendMode: 'multiply'
        }}
      >
        <img
          src={watermarkLogo}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        />
      </div>

      {/* ── Masthead Header (matches the inside app masthead & wave) ── */}
      <header className="w-full flex flex-col pt-safe relative z-20" style={{ background: '#EAF2FB' }}>
        <div style={{ background: '#015BB3', paddingBottom: '12px' }}>
          <div className="w-full flex items-center justify-between px-4 pt-3.5 pb-2 gap-2">
            {/* Logo box + Spot News 24x7 */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-[8px] flex items-center justify-center h-[46px] overflow-hidden bg-white p-1 border border-[#0B56A6]/20 shrink-0 shadow-sm">
                <img src={logoUrl} alt="Spot News Logo" className="h-full w-auto object-contain" style={{ maxWidth: '92px', borderRadius: '4px' }} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-bold text-white text-[22px] leading-[1.15] tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
                  Spot News<br/>24x7
                </span>
              </div>
            </div>

            {/* Portal Badge */}
            <div className="flex flex-col items-end shrink-0">
              <div className="bg-white/15 border border-white/25 text-white text-[9.5px] uppercase tracking-widest font-extrabold py-1 px-3 rounded-full shadow-sm">
                REPORTER PORTAL
              </div>
            </div>
          </div>
        </div>

        {/* ── Smooth Wave Divider ── */}
        <div style={{ width: '100%', overflow: 'hidden', lineHeight: 0, background: '#EAF2FB', position: 'relative' }}>
          <svg
            viewBox="0 0 1440 240"
            preserveAspectRatio="none"
            style={{ position: 'relative', display: 'block', width: '100%', height: '42px' }}
          >
            <path
              d="M0,0 L1440,0 L1440,100 C1100,240 500,10 0,170 Z"
              fill="#015BB3"
            />
          </svg>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 relative z-10">
        
        <div className="w-full max-w-md bg-white border border-[#D6E4F5] rounded-[16px] p-6 sm:p-8 shadow-[0_4px_20px_rgba(18,84,168,0.08)]">
          
          <div className="mb-5 flex flex-col items-start">
            {/* PORTAL BADGE */}
            <div className="bg-[#EAF2FB] border border-[#D6E4F5] text-[#0F487F] text-[9.5px] uppercase tracking-wider font-extrabold py-1 px-2.5 rounded-full mb-2.5 shadow-sm">
              Spot News Portal
            </div>
            
            {/* WELCOME TEXT */}
            <h1 className="text-[#163E6C] text-2xl font-bold font-serif mb-1.5" style={{ fontFamily: "'Georgia', serif" }}>
              {activeTab === 'login' ? 'Welcome Back' : activeTab === 'apply' ? 'Reporter Application' : 'Check Application Status'}
            </h1>
            <div className="w-12 h-[3px] bg-[#CC1E1E] rounded-full"></div>
          </div>

          {/* TABS (Only 2 tabs: Login & Apply) */}
          {activeTab === 'check-status' ? (
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setActiveTab('apply'); setError(''); setSuccessMsg(''); }}
                className="text-xs font-bold text-[#015BB3] hover:underline flex items-center gap-1.5 cursor-pointer py-1"
              >
                &larr; Back to Application
              </button>
            </div>
          ) : (
            <div className="flex bg-[#EAF2FB] rounded-lg p-1 mb-6 border border-[#D6E4F5]">
              <button
                onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'login' ? 'bg-white text-[#0F487F] shadow-sm' : 'text-[#64748B] hover:text-[#0F487F]'}`}
              >
                Login
              </button>
              <button
                onClick={() => { setActiveTab('apply'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'apply' ? 'bg-white text-[#0F487F] shadow-sm' : 'text-[#64748B] hover:text-[#0F487F]'}`}
              >
                Apply as Reporter
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-4 bg-green-50 border border-green-500 rounded-[12px] text-green-800 text-xs font-semibold text-center shadow-sm flex flex-col gap-3">
              <p className="leading-relaxed">{successMsg}</p>
              {submittedRefNo && (
                <>
                  <div className="bg-white border border-green-300 py-1.5 px-3 rounded-[8px] font-mono text-xs text-[#0F487F] font-bold self-center">
                    Ref No: {submittedRefNo}
                  </div>
                  <div className="flex flex-col gap-2 mt-1 w-full">
                    <button
                      type="button"
                      onClick={() => routeByStatus('PENDING', navigate, {
                        refNo: submittedRefNo,
                        name: applyForm.name || 'Reporter Candidate',
                        email: applyForm.email || '',
                        phone: applyForm.phone || '',
                        submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                        status: 'PENDING'
                      })}
                      className="w-full py-2.5 bg-[#CC1E1E] hover:bg-[#b51919] text-white rounded-[10px] font-bold text-xs font-serif tracking-wide shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Track Application &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(submittedRefNo);
                        setCopiedRef(true);
                        setTimeout(() => setCopiedRef(false), 2000);
                      }}
                      className="w-full py-2.5 bg-white border border-[#D6E4F5] text-[#0F172A] hover:bg-[#F8FAFC] rounded-[10px] font-bold text-xs font-serif tracking-wide shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-[#015BB3]" />}
                      {copiedRef ? 'Copied!' : 'Copy Ref No.'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {showSignupPrompt && (
            <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl text-[#0F172A] text-xs shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span className="font-bold text-sm text-[#0F487F]">Account Not Found / New User?</span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                No active account found for <strong className="text-[#0F487F]">{email || 'this email'}</strong>. If you are a new user, please create your account and password to get started.
              </p>
              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => navigate('/signup', { state: { email } })}
                  className="w-full py-2.5 bg-[#CC1E1E] hover:bg-[#b51919] active:bg-[#991515] text-white rounded-lg font-bold text-xs font-serif tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Create Account & Password &rarr;
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-[#CC1E1E] rounded-[10px] text-[#CC1E1E] text-xs font-semibold text-center shadow-sm">
              {error}
            </div>
          )}

          {activeTab === 'login' ? (
            <>
              {/* DEFAULT USER LOGO */}
              <div className="flex flex-col items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full border-2 border-[#CC1E1E] bg-[#EAF2FB] flex items-center justify-center shadow-md">
                  <UserIcon className="w-10 h-10 text-[#0F487F]" />
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={handleEmailChange}
                    className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                    required
                  />
                </div>



                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                    required
                  />
                </div>
                <div className="flex justify-end -mt-1 mb-1">
                  <Link to="/forgot-password" state={{ email }} className="text-[11.5px] font-bold text-[#CC1E1E] hover:underline">
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-[12px] mt-1 bg-[#CC1E1E] hover:bg-[#b51919] active:bg-[#991515] text-white rounded-[10px] font-bold text-[15px] font-serif tracking-wide transition-all shadow-[0_2px_8px_rgba(204,30,30,0.25)] flex items-center justify-center disabled:opacity-70 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
                </button>
              </form>
            </>
          ) : activeTab === 'apply' ? (
            <form onSubmit={handleApplySubmit} className="space-y-3.5">
              {/* Official Reporter Passport Photo Selector */}
              <div className="flex flex-col items-center justify-center mb-3">
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full border-2 border-dashed border-[#CC1E1E] bg-[#EAF2FB] flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-md overflow-hidden"
                >
                  {applyForm.photo ? (
                    <img src={applyForm.photo} alt="Reporter Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#0F487F]">
                      <UserIcon className="w-8 h-8 text-[#0F487F]/60 mb-0.5" />
                      <span className="text-[8px] font-bold uppercase tracking-wider text-[#0F487F]/70">Photo</span>
                      <div className="absolute bottom-1 right-1 bg-[#CC1E1E] text-white rounded-full p-1 shadow-sm">
                        <Camera className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="mt-1.5 text-[11px] font-bold text-[#015BB3] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  {applyForm.photo ? 'Change ID Photo' : 'Upload ID Photo (Passport size)'}
                </button>
                <p className="text-[10px] text-[#64748B] mt-0.5">This photo will be fixed permanently on your Press ID Card.</p>
              </div>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={applyForm.name}
                  onChange={(e) => setApplyForm({...applyForm, name: e.target.value})}
                  className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                  required
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={applyForm.email}
                  onChange={(e) => setApplyForm({...applyForm, email: e.target.value})}
                  className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                  required
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={applyForm.phone}
                  onChange={(e) => setApplyForm({...applyForm, phone: e.target.value})}
                  className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                  required
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <input
                  type="text"
                  placeholder="Enter District (e.g. Hyderabad)"
                  value={applyForm.district}
                  onChange={(e) => setApplyForm({...applyForm, district: e.target.value})}
                  className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                  required
                />
              </div>

              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <input
                  type="text"
                  placeholder="Aadhar Card Number"
                  value={applyForm.aadhar}
                  onChange={(e) => setApplyForm({...applyForm, aadhar: e.target.value})}
                  className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                  required
                />
              </div>

              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <input
                  type="text"
                  placeholder="Press ID"
                  value={applyForm.pressId}
                  onChange={(e) => setApplyForm({...applyForm, pressId: e.target.value})}
                  className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                  <select
                    value={applyForm.state}
                    onChange={(e) => setApplyForm({ ...applyForm, state: e.target.value, district: '' })}
                    className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium appearance-none"
                    required
                  >
                    <option value="" disabled>Select State</option>
                    {Object.keys(INDIA_STATES).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                  <select
                    value={applyForm.district}
                    onChange={(e) => setApplyForm({ ...applyForm, district: e.target.value })}
                    className="w-full bg-white border border-[#D6E4F5] rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium appearance-none"
                    required
                    disabled={!applyForm.state}
                  >
                    <option value="" disabled>Select District</option>
                    {applyForm.state && INDIA_STATES[applyForm.state]?.map((dist) => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-[12px] mt-2 bg-[#CC1E1E] hover:bg-[#b51919] active:bg-[#991515] text-white rounded-[10px] font-bold text-[15px] font-serif tracking-wide transition-all shadow-[0_2px_8px_rgba(204,30,30,0.25)] flex items-center justify-center disabled:opacity-70 cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
              </button>

              {/* Boxed button for Check Status */}
              <div className="mt-4 pt-4 border-t border-[#D6E4F5] text-center">
                <p className="text-[#64748B] text-xs font-medium mb-2.5">
                  If you have already submitted?
                </p>
                <button
                  type="button"
                  onClick={() => { setActiveTab('check-status'); setError(''); setSuccessMsg(''); }}
                  className="w-full py-[11px] bg-[#EAF2FB] hover:bg-[#D6E4F5] active:bg-[#C2D8F0] text-[#015BB3] border border-[#015BB3]/30 rounded-[10px] font-bold text-[14px] tracking-wide transition-all shadow-sm flex items-center justify-center cursor-pointer font-serif"
                >
                  Check Status
                </button>
              </div>
            </form>
          ) : (
            <CheckStatusTab />
          )}

          {/* Only render OR and alternative login methods on LOGIN tab */}
          {activeTab === 'login' && (
            <>
              <div className="mt-5 flex items-center justify-center gap-3">
                <div className="h-px bg-[#D6E4F5] flex-1"></div>
                <span className="text-[#0F487F] text-[10.5px] uppercase font-bold tracking-wider">Or</span>
                <div className="h-px bg-[#D6E4F5] flex-1"></div>
              </div>

              <div className="flex flex-col gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => navigate('/login/otp')}
                  className="w-full py-[12px] bg-[#015BB3] hover:bg-[#1254A8] active:bg-[#0c4387] text-white rounded-[10px] font-bold text-[14.5px] tracking-wide transition-all shadow-[0_2px_8px_rgba(1,91,179,0.25)] flex items-center justify-center gap-2 cursor-pointer font-serif border border-[#0B56A6]/20"
                >
                  <Phone className="w-4 h-4 text-white" />
                  Login with Mobile OTP
                </button>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-[12px] bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-[#D6E4F5] text-[#0F172A] rounded-[10px] font-bold text-[14px] tracking-wide transition-colors shadow-sm flex items-center justify-center gap-3 disabled:opacity-70 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Sign in with Google
                </button>
              </div>

              <div className="mt-6 text-center flex flex-col gap-1.5">
                <p className="text-[#64748B] text-xs font-medium">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-[#015BB3] font-bold hover:underline transition-colors">
                    Sign Up
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <div className="py-3 px-4 flex items-center justify-center shrink-0 relative z-20">
        <span className="text-[#0F487F]/70 text-[10px] font-medium tracking-wide">
          Spot News 24x7 &middot; Secured Reporter Authentication
        </span>
      </div>
    </div>
  );
};
