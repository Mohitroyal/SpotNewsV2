import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, IdCard, Loader2, Phone, ShieldCheck, UserPlus, User as UserIcon, MapPin, Mic, Mail } from 'lucide-react';
import { PortalSwitch } from '@/components/PortalSwitch';
import { ReporterTerms, REPORTER_TERMS_VERSION } from '@/components/ReporterTerms';
import { BrandHeader, BottomWave } from '@/components/BrandHeader';
import { OTPWidget, OTPError, OTP_API_URL } from '@/services/otpService';
import { reporterAccountService, isApprovedStatus, last10 } from '@/services/reporterAccount.service';
import { generationService } from '@/services/generation.service';
import { prepareImage } from '@/utils/prepareImage';
import { useAuthStore, saveReporterName, saveReporterPhoto } from '@/store';
import { supabase } from '@/lib/supabase';
import { DISTRICTS } from '@/features/daily/dailyContentEngine';

/**
 * Reporter Login & Registration — kept as simple as possible for reporters.
 *   Login:    mobile number → OTP. Only registered reporters can log in.
 *   Register: 1) name + mobile (OTP)  2) photo + district  3) Aadhaar (+ old press ID, optional)
 *             → super admin checks the Aadhaar and approves.
 * Readers never need this screen.
 */
type Mode = 'choose' | 'login' | 'register';
type Step = 'phone' | 'otp' | 'photo' | 'docs';


export const ReporterAuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const startMode: Mode = /apply|signup|register/.test(location.pathname) ? 'register' : 'login';

  const [mode, setMode] = useState<Mode>(startMode);
  const [step, setStep] = useState<Step>('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // registration data
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [stateName, setStateName] = useState<'Andhra Pradesh' | 'Telangana'>('Andhra Pradesh');
  const [district, setDistrict] = useState('');
  const [aadhaar, setAadhaar] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);

  const districts = useMemo(() => DISTRICTS.filter((d) => d.state === stateName), [stateName]);
  const [progress, setProgress] = useState('');

  // Uploads start as soon as a photo/document is chosen, so "Submit" is quick
  const photoUpload = useRef<Promise<string> | null>(null);
  const aadhaarUpload = useRef<Promise<string> | null>(null);

  // Wake the (free-tier) server early so OTP and uploads respond fast
  useEffect(() => {
    const api = (import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com').replace(/\/+$/, '');
    fetch(`${api}/health`).catch(() => {});
    fetch(`${OTP_API_URL}/health`).catch(() => {});
  }, []);

  const startPhotoUpload = (f: File) => {
    const p = generationService.uploadImage(f).then((r) => {
      const url = r?.data?.url || '';
      if (!url) throw new Error('photo upload failed');
      return url;
    });
    p.catch(() => {});
    photoUpload.current = p;
  };
  const startDocUpload = (f: File) => {
    const p = prepareImage(f, { maxEdge: 2000, fileName: 'aadhaar' }).then((img) => reporterAccountService.uploadPrivateDoc(img, 'aadhaar'));
    p.catch(() => {});
    aadhaarUpload.current = p;
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const reset = (m: Mode) => {
    setMode(m); setStep('phone'); setOtp(''); setError(''); setNotRegistered(false);
  };

  const goAfterLogin = async (userId: string, ph: string) => {
    const app = await reporterAccountService.findMyApplication(userId, ph);
    const user = useAuthStore.getState().user;
    const role = (user?.role || '').toLowerCase();
    if (role === 'superadmin' || role === 'admin') return navigate('/', { replace: true });
    if (app && isApprovedStatus(app.status)) {
      useAuthStore.getState().updateUser({ role: 'reporter', district: app.district || undefined, state: app.state || undefined } as any);
      return navigate('/generate', { replace: true });
    }
    if (app) return navigate('/reporter/status', { replace: true });
    // Logged in but registration not finished yet → continue registration
    setMode('register');
    setStep('photo');
  };

  const sendOtp = async () => {
    setError(''); setNotRegistered(false);
    if (last10(phone).length !== 10) return setError('10 అంకెల మొబైల్ నంబర్ ఇవ్వండి / Enter your 10-digit mobile number');
    if (mode === 'register' && name.trim().length < 2) return setError('మీ పేరు ఇవ్వండి / Enter your name');
    setBusy(true);
    try {
      await OTPWidget.sendOTP({ phone: last10(phone), purpose: mode === 'register' ? 'register' : 'login' });
      setStep('otp'); setCooldown(30);
    } catch (e: any) {
      if (e instanceof OTPError && e.code === 'NOT_REGISTERED') setNotRegistered(true);
      setError(e?.message || 'OTP పంపడం విఫలమైంది / Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (otp.replace(/\D/g, '').length !== 6) return setError('6 అంకెల OTP ఇవ్వండి / Enter the 6-digit OTP');
    setBusy(true);
    try {
      const res = await OTPWidget.verifyOTP({
        phone: last10(phone), otp: otp.replace(/\D/g, ''),
        purpose: mode === 'register' ? 'register' : 'login',
        full_name: mode === 'register' ? name.trim() : undefined,
      });
      if (!res.success || !res.token || !res.user) throw new Error(res.message || 'OTP తప్పు / Wrong OTP');
      const u: any = { ...res.user, phone_number: `+91${last10(phone)}` };
      try {
        const { data: prof } = await supabase.from('profiles').select('role, district, state').eq('id', u.id).maybeSingle();
        if (prof?.role) u.role = prof.role;
        if (prof?.district) { u.district = prof.district; useAuthStore.getState().setDistrict(prof.district); }
        if (prof?.state) { u.state = prof.state; useAuthStore.getState().setUserState(prof.state); }
      } catch { /* ignore */ }
      if (mode === 'register' && name.trim()) { u.full_name = name.trim(); saveReporterName(u.email, name.trim()); }
      login(u, res.token);
      if (mode === 'register') {
        if (photoFile && !photoUpload.current) startPhotoUpload(photoFile);
        const existing = await reporterAccountService.findMyApplication(u.id, phone);
        if (existing && existing.status !== 'rejected') return goAfterLogin(u.id, phone);
        setStep('photo');
      } else {
        await goAfterLogin(u.id, phone);
      }
    } catch (e: any) {
      if (e instanceof OTPError && e.code === 'NOT_REGISTERED') setNotRegistered(true);
      setError(e?.message || 'OTP తప్పు / Wrong OTP');
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async (f?: File | null) => {
    if (!f) return;
    try {
      const prepared = await prepareImage(f, { maxEdge: 900, fileName: 'reporter_photo' });
      setPhotoFile(prepared);
      const cur = useAuthStore.getState().user;
      if (cur && !String(cur.id || '').startsWith('guest_')) startPhotoUpload(prepared);
      else photoUpload.current = null;
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(URL.createObjectURL(prepared));
    } catch (e: any) {
      setError(e?.message || 'ఫోటో తెరవలేకపోయాం / Could not open the photo');
    }
  };

  const submit = async () => {
    setError('');
    const user = useAuthStore.getState().user;
    if (!user) return reset('register');
    if (!aadhaar) return setError('ఆధార్ కార్డు ఫోటో అవసరం / Aadhaar card photo is required');
    if (!agreed) return setError('వార్తల ప్రచురణ నియమాలు అంగీకరించండి / Please accept the news publishing rules');
    setBusy(true);
    try {
      // Uploads normally finished in the background already; retry once if one failed
      const retry = async (ref: React.MutableRefObject<Promise<string> | null>, again: () => void) => {
        try { return ref.current ? await ref.current : (again(), await ref.current!); }
        catch { again(); return await ref.current!; }
      };
      setProgress('ఫోటో పంపుతున్నాం… · Uploading photo');
      const photoUrl = photoFile ? await retry(photoUpload, () => startPhotoUpload(photoFile)) : '';
      setProgress('ఆధార్ పంపుతున్నాం… · Uploading Aadhaar');
      const aadhaarPath = await retry(aadhaarUpload, () => startDocUpload(aadhaar));
      setProgress('నమోదు పూర్తి చేస్తున్నాం… · Finishing');
      await reporterAccountService.submitRegistration({
        userId: user.id, name: name.trim() || user.full_name, phone: phone || user.phone_number || '',
        email: user.email, state: stateName, district, photoUrl, aadhaarPath,
        termsVersion: REPORTER_TERMS_VERSION,
      });
      if (photoUrl && !photoUrl.startsWith('data:')) {
        saveReporterPhoto(user.email, photoUrl);
        useAuthStore.getState().updateUser({ avatarUrl: photoUrl, district, state: stateName } as any);
      }
      useAuthStore.getState().setDistrict(district);
      useAuthStore.getState().setUserState(stateName);
      navigate('/reporter/status', { replace: true });
    } catch (e: any) {
      setError(`పంపడం విఫలమైంది, మళ్ళీ ప్రయత్నించండి / Could not submit: ${e?.message || e}`);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const regSteps = ['phone', 'photo', 'docs'] as const;
  const regIndex = step === 'otp' ? 0 : regSteps.indexOf(step as any);
  const tabMode: 'login' | 'register' = mode === 'register' ? 'register' : 'login';
  const onPhoneStep = step === 'phone' || step === 'otp';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg,#EAF2FB 0%,#F4F8FD 60%,#EAF2FB 100%)' }}>
      <BrandHeader onBack={() => navigate(-1)} waveFill="#EAF2FB"
        right={<span className="w-12 h-12 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center shrink-0 -rotate-12"><Mic className="w-7 h-7 text-white" strokeWidth={2.4} /></span>} />

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-4 -mt-2">
        <div className="relative bg-white/95 rounded-[34px] px-5 pt-6 pb-6 shadow-[0_18px_40px_rgba(11,78,162,0.14)] border border-white space-y-4"
          style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40 }}>
          <button type="button" onClick={() => (onPhoneStep ? navigate(-1) : setStep(step === 'docs' ? 'photo' : 'phone'))}
            className="inline-flex items-center gap-2 rounded-full bg-[#EAF2FB] text-[#0B4EA2] text-[16px] font-bold px-4 py-2 border-0 shadow-sm cursor-pointer">
            ← వెనుకకు (Back)
          </button>
          <div>
            <PortalSwitch active="reporters" />
            <h1 className="mt-3 mb-0 text-[30px] font-bold text-[#0A2A5C] leading-tight" style={{ fontFamily: "Georgia, 'Noto Serif Telugu', serif" }}>
              {tabMode === 'login' ? 'Reporter Login' : 'రిపోర్టర్‌గా చేరండి'}
            </h1>
            <p className="m-0 text-[20px] font-extrabold text-[#0A2A5C]">{tabMode === 'login' ? 'వార్తా ప్రతినిధి లాగిన్' : 'Join as a Reporter'}</p>
            <div className="mt-2 h-[5px] w-16 rounded-full bg-[#E11D2E]" />
            {tabMode === 'login' && onPhoneStep && (
              <p className="mt-3 mb-0 text-[15px] text-[#334155] leading-relaxed">
                వార్తలు పంపడానికి, ఫోటోలు అప్‌లోడ్ చేయడానికి మరియు మీ వార్తల స్థితి చూడటానికి లాగిన్ అవ్వండి.
                <span className="block text-[13.5px] text-[#64748B] mt-0.5">Login to report news, upload photos and track your news.</span>
              </p>
            )}
          </div>

          {onPhoneStep && (
            <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#EAF2FB] shadow-inner">
              <button type="button" onClick={() => reset('login')}
                className={`rounded-xl py-3 text-[17px] font-extrabold border-0 cursor-pointer ${tabMode === 'login' ? 'text-white shadow-md' : 'text-[#0A2A5C] bg-transparent'}`}
                style={tabMode === 'login' ? { background: 'linear-gradient(180deg,#1565D8,#0B3F8F)' } : undefined}>
                లాగిన్ · Login
              </button>
              <button type="button" onClick={() => reset('register')}
                className={`rounded-xl py-3 text-[17px] font-extrabold border-0 cursor-pointer ${tabMode === 'register' ? 'text-white shadow-md' : 'text-[#0A2A5C] bg-transparent'}`}
                style={tabMode === 'register' ? { background: 'linear-gradient(180deg,#1565D8,#0B3F8F)' } : undefined}>
                రిపోర్టర్‌గా చేరండి
              </button>
            </div>
          )}

          {tabMode === 'register' && (
            <div className="flex items-center justify-center gap-2">
              {regSteps.map((st, i) => (
                <div key={st} className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[17px] font-black ${i <= regIndex ? 'bg-[#0B4EA2] text-white' : 'bg-white text-[#94A3B8] border-2 border-[#CBD9EA]'}`}>
                    {i < regIndex ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                  </div>
                  {i < regSteps.length - 1 && <div className={`w-8 h-1 rounded ${i < regIndex ? 'bg-[#0B4EA2]' : 'bg-[#CBD9EA]'}`} />}
                </div>
              ))}
            </div>
          )}

          {onPhoneStep && (
            <>
              {tabMode === 'register' ? (
                <label className="flex flex-col items-center gap-2 py-1 cursor-pointer">
                  <div className="relative w-28 h-28 rounded-full bg-[#F4F8FD] border-[3px] border-[#E11D2E] shadow-[0_10px_24px_rgba(225,29,46,0.18)] flex items-center justify-center overflow-hidden">
                    {photoPreview ? <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" /> : <Camera className="w-11 h-11 text-[#0B4EA2]" strokeWidth={2.2} />}
                  </div>
                  <span className="rounded-full bg-[#EAF2FB] px-4 py-1.5 text-[16px] font-extrabold text-[#0B4EA2]">
                    {photoPreview ? 'ఫోటో మార్చండి · Change photo' : '📷 మీ ఫోటో జోడించండి · Add your photo'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </label>
              ) : (
                <div className="flex justify-center py-1">
                  <div className="w-24 h-24 rounded-full bg-[#F4F8FD] border-[3px] border-[#E11D2E] shadow-[0_10px_24px_rgba(225,29,46,0.18)] flex items-center justify-center">
                    <UserIcon className="w-11 h-11 text-[#0B4EA2]" strokeWidth={2.2} />
                  </div>
                </div>
              )}

              {tabMode === 'register' && (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-[#D6E4F5] bg-white px-4 py-3.5 shadow-sm">
                  <UserIcon className="w-6 h-6 text-[#0B4EA2] shrink-0" />
                  <input className="flex-1 min-w-0 text-[19px] font-semibold outline-none bg-transparent" value={name} disabled={step === 'otp'}
                    onChange={(e) => setName(e.target.value)} placeholder="మీ పేరు · Your name" />
                </div>
              )}

              <div className="flex items-center gap-3 rounded-2xl border-2 border-[#D6E4F5] bg-white px-4 py-3.5 shadow-sm">
                <Phone className="w-6 h-6 text-[#0B4EA2] shrink-0" />
                <span className="text-[19px] font-extrabold text-[#0F172A]">+91</span>
                <span className="w-px h-7 bg-[#CBD9EA]" />
                <input className="flex-1 min-w-0 text-[19px] font-semibold outline-none bg-transparent" inputMode="numeric" maxLength={10}
                  value={phone} disabled={step === 'otp'}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="మొబైల్ నంబర్ · Mobile" />
              </div>

              <div className="flex items-center gap-3 rounded-2xl border-2 border-[#D6E4F5] bg-white pl-4 pr-2 py-2 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-[#0B4EA2] shrink-0" />
                <input className="flex-1 min-w-0 text-[19px] font-semibold outline-none bg-transparent tracking-[0.2em]" inputMode="numeric" maxLength={6}
                  value={otp} disabled={step !== 'otp'}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="OTP" />
                <span className="w-px h-7 bg-[#CBD9EA]" />
                <button type="button" onClick={sendOtp} disabled={busy || cooldown > 0}
                  className="px-3 py-2 text-[17px] font-extrabold text-[#0B4EA2] bg-transparent border-0 cursor-pointer disabled:opacity-50">
                  {step === 'otp' ? (cooldown > 0 ? `${cooldown}s` : 'మళ్ళీ') : 'Get OTP'}
                </button>
              </div>
              {step === 'otp' && (
                <div className="flex justify-between text-[15.5px] font-bold -mt-1">
                  <button className="text-[#0B4EA2] bg-transparent border-0 p-0 cursor-pointer" onClick={() => { setStep('phone'); setOtp(''); }}>నంబర్ మార్చండి</button>
                  <button className="text-[#E11D2E] bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={sendOtp}>Resend OTP</button>
                </div>
              )}

              <button className="w-full rounded-2xl py-4 text-[21px] font-bold text-white border-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_10px_22px_rgba(225,29,46,0.35)]"
                style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)', fontFamily: "Georgia, 'Noto Serif Telugu', serif" }}
                disabled={busy} onClick={step === 'phone' ? sendOtp : verifyOtp}>
                {busy && <Loader2 className="w-6 h-6 animate-spin" />}
                {step === 'phone' ? 'OTP పంపండి · Send OTP' : tabMode === 'register' ? 'ధృవీకరించండి · Verify' : 'లాగిన్ · Login'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#D6E4F5]" />
                <span className="rounded-full bg-[#EAF2FB] text-[#0A2A5C] text-[14px] font-extrabold px-3 py-1">OR</span>
                <div className="flex-1 h-px bg-[#D6E4F5]" />
              </div>
              {tabMode === 'login' ? (
                <p className="text-center text-[17px] text-[#334155] m-0">
                  కొత్త రిపోర్టరా? <button className="text-[#0B4EA2] font-extrabold bg-transparent border-0 p-0 cursor-pointer" onClick={() => reset('register')}>నమోదు · Sign Up</button>
                </p>
              ) : (
                <p className="text-center text-[17px] text-[#334155] m-0">
                  ఇప్పటికే నమోదయ్యారా? <button className="text-[#0B4EA2] font-extrabold bg-transparent border-0 p-0 cursor-pointer" onClick={() => reset('login')}>లాగిన్ · Login</button>
                </p>
              )}
              {tabMode === 'login' && (
                <button type="button" onClick={() => navigate('/login/email')}
                  className="w-full rounded-2xl py-3 text-[16px] font-extrabold text-[#0B4EA2] bg-white border-2 border-[#D6E4F5] cursor-pointer flex items-center justify-center gap-2">
                  <Mail className="w-5 h-5" /> ఈమెయిల్ లాగిన్ (అడ్మిన్) · Email login
                </button>
              )}
              <p className="text-center text-[14.5px] text-[#64748B] m-0">వార్తలు చదవడానికి లాగిన్ అవసరం లేదు · Readers need no login</p>
            </>
          )}

          {tabMode === 'register' && step === 'photo' && (
            <>
              <p className="text-[19px] font-bold text-[#0F172A] m-0">మీ ఫోటో, జిల్లా · Your photo and district</p>
              <label className="flex flex-col items-center gap-3 cursor-pointer">
                <div className="w-36 h-36 rounded-full border-[3px] border-[#E11D2E] bg-[#F4F8FD] overflow-hidden flex items-center justify-center shadow-[0_10px_24px_rgba(225,29,46,0.18)]">
                  {photoPreview ? <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" /> : <Camera className="w-12 h-12 text-[#0B4EA2]" />}
                </div>
                <span className="text-[17px] font-extrabold text-[#0B4EA2]">{photoPreview ? 'ఫోటో మార్చండి · Change photo' : 'ఫోటో తీయండి / ఎంచుకోండి · Add photo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#EAF2FB]">
                {(['Andhra Pradesh', 'Telangana'] as const).map((st) => (
                  <button key={st} onClick={() => { setStateName(st); setDistrict(''); }}
                    className={`rounded-xl py-3 text-[17px] font-extrabold border-0 cursor-pointer ${stateName === st ? 'text-white shadow-md' : 'bg-transparent text-[#0A2A5C]'}`}
                    style={stateName === st ? { background: 'linear-gradient(180deg,#1565D8,#0B3F8F)' } : undefined}>
                    {st === 'Andhra Pradesh' ? 'ఆంధ్రప్రదేశ్' : 'తెలంగాణ'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-[#D6E4F5] bg-white px-4 py-1 shadow-sm">
                <MapPin className="w-6 h-6 text-[#0B4EA2] shrink-0" />
                <select className="flex-1 min-w-0 text-[18px] font-semibold outline-none bg-transparent py-3" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="">మీ జిల్లా · Your district</option>
                  {districts.map((d) => <option key={d.en} value={d.en}>{d.te} ({d.en})</option>)}
                </select>
              </div>
              <button className="w-full rounded-2xl py-4 text-[20px] font-bold text-white border-0 cursor-pointer disabled:opacity-50 shadow-[0_10px_22px_rgba(225,29,46,0.3)]"
                style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)' }}
                disabled={!photoFile || !district} onClick={() => setStep('docs')}>కొనసాగండి · Next</button>
            </>
          )}

          {tabMode === 'register' && step === 'docs' && (
            <>
              <p className="text-[19px] font-bold text-[#0F172A] m-0">పత్రాలు · Documents</p>
              <p className="text-[15.5px] text-[#475569] m-0 leading-relaxed">సూపర్ అడ్మిన్ మాత్రమే మీ ఆధార్ చూస్తారు. · Only the super admin can see your Aadhaar.</p>
              <DocPicker label="ఆధార్ కార్డు ఫోటో (తప్పనిసరి)" sub="Aadhaar card photo (required)" file={aadhaar}
                onPick={(f) => { setAadhaar(f); if (f) startDocUpload(f); }} />
              <ReporterTerms agreed={agreed} onChange={setAgreed} />
              <button className="w-full rounded-2xl py-4 text-[20px] font-bold text-white border-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_10px_22px_rgba(225,29,46,0.3)]"
                style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)' }}
                disabled={busy || !aadhaar || !agreed} onClick={submit}>
                {busy && <Loader2 className="w-6 h-6 animate-spin" />} నమోదు పంపండి · Submit
              </button>
              {busy && progress && <p className="text-center text-[16px] font-bold text-[#0B4EA2] m-0">{progress}</p>}
              <p className="text-center text-[14.5px] text-[#64748B] m-0"><IdCard className="w-4 h-4 inline -mt-0.5" /> ప్రెస్ ID కార్డు ఐచ్ఛికం — ఆమోదం తర్వాత కావాలంటే దరఖాస్తు చేయండి.</p>
            </>
          )}

          {error && (
            <div className="rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] p-4 space-y-3">
              <p className="text-[16.5px] font-semibold text-[#991B1B] m-0 leading-relaxed">{error}</p>
              {notRegistered && (
                <button className="w-full rounded-2xl py-3.5 text-[18px] font-extrabold text-white border-0 cursor-pointer flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)' }}
                  onClick={() => { setError(''); setNotRegistered(false); setMode('register'); setStep('phone'); }}>
                  <UserPlus className="w-6 h-6" /> ఇప్పుడే నమోదు చేసుకోండి · Register now
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <BottomWave />
    </div>
  );
};

const DocPicker: React.FC<{ label: string; sub: string; file: File | null; onPick: (f: File | null) => void }> = ({ label, sub, file, onPick }) => (
  <label className={`flex items-center gap-4 rounded-2xl border-2 p-4 cursor-pointer ${file ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-dashed border-[#015BB3] bg-[#F8FBFF]'}`}>
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${file ? 'bg-[#16A34A]' : 'bg-[#015BB3]'}`}>
      {file ? <CheckCircle2 className="w-8 h-8 text-white" /> : <Camera className="w-8 h-8 text-white" />}
    </div>
    <div className="min-w-0">
      <div className="text-[17px] font-extrabold text-[#0F172A]">{label}</div>
      <div className="text-[14.5px] text-[#475569] font-semibold">{file ? `✓ ${file.name}` : sub}</div>
    </div>
    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
  </label>
);
