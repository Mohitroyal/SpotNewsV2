import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Plus, Newspaper, Home, Megaphone, CloudSun, Grid3x3, BarChart3 } from 'lucide-react';
// import { useTranslation } from './lib/i18n';
import mastheadLogo from './assets/rti_express_logo.png';
import { DoubleWave, BRAND_GRADIENT } from './components/BrandHeader';
import watermarkLogo from './assets/rti_express_watermark.png';
import { SplashScreen } from './screens/SplashScreen';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { GenerateScreen } from './screens/GenerateScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ProfileSettingsScreen } from './screens/ProfileSettingsScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { CreatePasswordScreen } from './screens/CreatePasswordScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { AdminScreen } from './screens/AdminScreen';
import { FeedScreen } from './screens/FeedScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ApplicationWaitingScreen } from './screens/ApplicationWaitingScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { PaymentPendingScreen } from './screens/PaymentPendingScreen';
import { PaymentSuccessScreen } from './screens/PaymentSuccessScreen';
import { PaymentFailedScreen } from './screens/PaymentFailedScreen';
import { IdGeneratingScreen } from './screens/IdGeneratingScreen';
import { ReporterIdCardScreen } from './screens/ReporterIdCardScreen';
import { ApplicationRejectedScreen } from './screens/ApplicationRejectedScreen';
import { ReporterAdRequestsScreen } from './screens/ReporterAdRequestsScreen';
import { PortalChooserScreen } from './screens/PortalChooserScreen';
import { ReaderHomeScreen } from './screens/ReaderHomeScreen';
import { PostAdScreen } from './screens/PostAdScreen';
import { UserNameScreen } from './screens/UserNameScreen';
import { LocationSelectScreen } from './screens/LocationSelectScreen';
import { ReporterAuthScreen } from './screens/ReporterAuthScreen';
import { ReporterStatusScreen } from './screens/ReporterStatusScreen';
import { IdCardApplyScreen } from './screens/IdCardApplyScreen';
import { useAuthStore, useUIStore, getReporterPhoto, getReporterName, isSuperAdminUser, isAdminUser } from './store';
import { supabase } from './lib/supabase';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

import { ErrorBoundary } from './ErrorBoundary';

// Bottom navigation (same look for readers and reporters)
const BottomNav = ({ path, search, reporter }: { path: string; search: string; reporter: boolean }) => {
  const cat = new URLSearchParams(search).get('cat');
  const items = reporter
    ? [
        { to: '/', icon: Home, te: 'హోమ్', en: 'Home', on: path === '/' },
        { to: '/feed', icon: Newspaper, te: 'వార్తలు', en: 'News', on: path === '/feed' },
        { to: '/generate', icon: Plus, te: 'వార్త పంపు', en: 'Create', on: path === '/generate', raised: true },
        { to: '/stats', icon: BarChart3, te: 'నా వార్తలు', en: 'My news', on: path === '/stats' },
        { to: '/settings', icon: Grid3x3, te: 'మరిన్ని', en: 'More', on: path.startsWith('/settings') },
      ]
    : [
        { to: '/', icon: Home, te: 'హోమ్', en: 'Home', on: path === '/' },
        { to: '/feed', icon: Newspaper, te: 'వార్తలు', en: 'News', on: path === '/feed' && cat !== 'weather' },
        { to: '/post-ad', icon: Megaphone, te: 'ప్రకటనలు', en: 'Post Ad', on: path === '/post-ad' || path === '/ad-requests' },
        { to: '/feed?cat=weather', icon: CloudSun, te: 'వాతావరణం', en: 'Weather', on: path === '/feed' && cat === 'weather' },
        { to: '/settings', icon: Grid3x3, te: 'మరిన్ని', en: 'More', on: path.startsWith('/settings') },
      ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full pb-safe z-30 border-t border-[#E2EDF8] shadow-[0_-4px_14px_rgba(11,78,162,0.08)]" style={{ background: '#FFFFFF' }}>
      <div className="flex items-stretch justify-around h-[68px] max-w-md mx-auto px-1.5 gap-1">
        {items.map(({ to, icon: Icon, te, en, on, raised }) => (
          <Link key={to} to={to} className="flex-1 flex items-center justify-center no-underline active:scale-95 transition-transform" style={{ textDecoration: 'none' }}>
            {raised ? (
              <span className="flex flex-col items-center -mt-6">
                <span className="w-[54px] h-[54px] rounded-full flex items-center justify-center shadow-lg border-[3px] border-white" style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)' }}>
                  <Icon className="w-7 h-7 text-white" strokeWidth={2.8} />
                </span>
                <span className="text-[12.5px] font-extrabold mt-0.5 text-[#E11D2E]">{te}</span>
              </span>
            ) : (
              <span className={`flex flex-col items-center justify-center rounded-2xl px-2.5 py-1 w-full max-w-[76px] ${on ? 'text-white' : 'text-[#0B3E8A]'}`}
                style={on ? { background: 'linear-gradient(180deg,#F0202F,#B30F1C)', boxShadow: '0 4px 10px rgba(225,29,46,0.28)' } : undefined}>
                <Icon className="w-6 h-6" strokeWidth={2.3} />
                <span className="text-[12.5px] font-extrabold leading-tight mt-0.5">{te}</span>
                <span className={`text-[10px] font-semibold leading-tight ${on ? 'text-white/85' : 'text-[#64748B]'}`}>{en}</span>
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};

// Mobile Layout with Bottom Navigation
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  // const { t } = useTranslation();
  const { user } = useAuthStore();
  const isSuperAdmin = isSuperAdminUser(user);
  const isAdmin = isAdminUser(user);
  const hasReporterAccess = user?.role === 'reporter' || isSuperAdmin || isAdmin;
  const isFullScreenFeed = useUIStore((state) => state.isFullScreenFeed);
  const userAvatar = getReporterPhoto(user?.email) || user?.avatarUrl || (user as any)?.user_metadata?.avatar_url || (user as any)?.user_metadata?.picture || (user as any)?.avatar_url;
  const userName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.full_name || user?.firstName || getReporterName(user?.email) || (isSuperAdmin ? 'Superadmin' : 'Reporter');
  const userInitials = userName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || (isSuperAdmin ? 'SA' : 'RP');

  const headerBg = BRAND_GRADIENT;
  const routeLoc = useLocation();
  const isFeed = routeLoc.pathname === '/feed';
  // The new home and Post Ad pages draw their own header
  const ownHeader = routeLoc.pathname === '/' || routeLoc.pathname === '/post-ad';

  return (
    <div className="flex flex-col h-screen bg-[#EEF3F8] transition-colors duration-300 relative font-sans">

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
          opacity: 0.1,
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


      {/* Main Content Area — masthead scrolls with content on all devices */}
      <main
        className={`flex-1 flex flex-col ${isFeed ? 'overflow-hidden' : 'overflow-y-auto'} ${!isFullScreenFeed ? (isFeed ? 'pb-[68px]' : 'pb-[92px]') : ''}`}
        style={{
          position: 'relative',
          WebkitOverflowScrolling: 'touch',
          // index.css gives <main> a 9rem bottom padding; on the feed only the nav bar height is needed
          ...(isFeed ? { paddingBottom: isFullScreenFeed ? 0 : 'calc(68px + env(safe-area-inset-bottom, 0px))' } : ownHeader ? { paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' } : {}),
          overscrollBehavior: 'contain'
        }}
      >
        {/* ── Masthead (scrolls with page) ── */}
        {/* ── Slim masthead on the news feed (more room for stories) ── */}
        {!isFullScreenFeed && isFeed && (
          <header className="w-full flex flex-col pt-safe shrink-0" style={{ background: headerBg }}>
            <div className="flex items-center gap-3 px-3 pt-2 pb-1">
              <img src={mastheadLogo} alt="RTI Express Spot News 24x7" className="w-12 h-12 rounded-full bg-white object-contain shadow-md" />
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-white font-black text-[18px] tracking-[0.12em] uppercase">RTI EXPRESS</div>
                <div className="text-white/90 font-extrabold text-[13px] tracking-[0.08em] uppercase">SPOT NEWS 24X7</div>
              </div>
              <a href="tel:7668886666" className="rounded-2xl bg-[#E50914] text-white px-3 py-1 no-underline shrink-0 text-center leading-tight" style={{ textDecoration: 'none' }}><span className="block text-[12.5px] font-extrabold">రిపోర్టర్లు కావాలి</span><span className="block text-[13px] font-black">📞 7668886666</span></a>
            </div>
            <DoubleWave fill="#F4F8FC" height={40} />
          </header>
        )}
        {!isFullScreenFeed && !isFeed && !ownHeader && (<header className="w-full flex flex-col pt-safe" style={{ background: headerBg }}>
          <div style={{ background: headerBg, paddingBottom: '6px' }}>
            {/* ── Main Header Content ── */}
            <div className="w-full flex items-start justify-between px-3 sm:px-4 pt-3 pb-2 gap-2">
              {/* Left Column: RTI Express Official Logo Emblem */}
              <Link to="/" className="flex flex-col items-center justify-center shrink-0 no-underline" title="Spot News 24x7">
                <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-white p-1.5 shadow-md border border-white/40 flex items-center justify-center overflow-hidden transition-transform active:scale-95">
                  <img
                    src={mastheadLogo}
                    alt="RTI Express Spot News 24x7"
                    className="w-full h-full object-contain"
                  />
                </div>
              </Link>

              {/* Center Column: Brand Name, Date & Wanted Reporters Pill Button */}
              <div className="flex-1 flex flex-col items-center text-center px-1 min-w-0">
                <h1 className="text-white font-black text-[16.5px] sm:text-[19px] tracking-[0.14em] uppercase leading-tight font-sans">
                  RTI EXPRESS
                </h1>
                <h2 className="text-white font-black text-[13.5px] sm:text-[15px] tracking-[0.1em] uppercase leading-tight font-sans mt-0.5">
                  SPOT NEWS 24X7
                </h2>
                <span className="text-white/90 text-[11px] sm:text-xs tracking-wide font-serif italic pt-1 whitespace-nowrap">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <a
                  href="tel:7668886666"
                  className="mt-2 inline-flex items-center justify-center px-4 sm:px-5 py-1.5 rounded-full bg-[#E50914] hover:bg-[#d00812] active:scale-95 text-white font-bold text-[12px] sm:text-[13px] tracking-wide shadow-md transition-all select-none"
                  style={{ textDecoration: 'none' }}
                >
                  Wanted reporters: 7668886666
                </a>
              </div>

              {/* Right Column: Profile Avatar -> Reporter Name */}
              <div className="flex flex-col items-center text-center shrink-0">
                <Link to="/settings" className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform" title="Reporter Profile">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Reporter Profile"
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white shadow-sm bg-white"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1e3a5f] border-2 border-white flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm">
                      {userInitials || 'Rep'}
                    </div>
                  )}
                  <div className="flex flex-col items-center leading-tight text-center mt-1">
                    <span className="text-white/80 text-[8.5px] uppercase tracking-wider font-extrabold">
                      {isSuperAdmin ? 'SUPERADMIN:' : isAdmin ? 'ADMIN:' : user?.role === 'reporter' ? 'REPORTER:' : 'USER:'}
                    </span>
                    <span className="text-white text-[9.5px] uppercase tracking-wider font-extrabold">{userName}</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Double curve (shared with every screen) ── */}
          <DoubleWave fill="#EAF2FB" />
        </header>)}

        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>


      {!isFullScreenFeed && (
        <BottomNav
          path={routeLoc.pathname}
          search={routeLoc.search}
          reporter={hasReporterAccess}
        />
      )}
    </div>
  );
};

import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { initPush, setPushDistrictName } from './lib/push';
import { scheduleMomentAlerts } from './lib/localMoments';
import { initDeepLinks } from './lib/deepLinks';

function AppUrlListener() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const cleanupDeepLinks = initDeepLinks(navigate);

    const handleUrlOpen = (ev: Event) => {
      const customEv = ev as CustomEvent;
      const type = customEv.detail?.type;
      if (type === 'recovery') {
        navigate('/reset-password');
      }
    };
    window.addEventListener('appUrlOpenRoute', handleUrlOpen);

    // Auto initialize push notifications if enabled
    const savedNotifs = localStorage.getItem('spotnews_notifications');
    let pushEnabled = true;
    if (savedNotifs) {
      try {
        pushEnabled = JSON.parse(savedNotifs).browserPush !== false;
      } catch {}
    }
    if (pushEnabled) {
      initPush({
        userId: user?.id,
        districtId: (user as any)?.district_id || 1,
        districtName: useAuthStore.getState().district,
        navigate,
      });
    }

    return () => {
      window.removeEventListener('appUrlOpenRoute', handleUrlOpen);
      if (typeof cleanupDeepLinks === 'function') cleanupDeepLinks();
    };
  }, [navigate, user?.id]);

  // District changed → follow that district's news/ads pushes and re-plan the hourly post alerts
  const district = useAuthStore((state) => state.district);
  const userState = useAuthStore((state) => state.userState);
  useEffect(() => {
    setPushDistrictName(district).catch(() => {});
    scheduleMomentAlerts(district, userState, navigate);
  }, [district, userState, navigate]);

  return null;
}

import { initBackendKeepAlive } from './lib/axios';

// Reporters log in / register here. Readers never need to log in.
const LoginRouteWrapper = ({ isRealUser }: { isRealUser: boolean }) => {
  if (!isRealUser) return <ReporterAuthScreen />;
  return <Navigate to="/" />;
};

// Reporter-only screens: guests go to login/register, pending reporters to their status
const ReporterOnly = ({ allowed, isRealUser, children }: { allowed: boolean; isRealUser: boolean; children: React.ReactNode }) => {
  if (allowed) return <>{children}</>;
  return <Navigate to={isRealUser ? '/reporter/status' : '/reporter'} replace />;
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const updateUser = useAuthStore((state) => state.updateUser);
  const setPendingCropImageSrc = useUIStore((state) => state.setPendingCropImageSrc);
  const isSuperAdmin = isSuperAdminUser(user);
  const isAdmin = isAdminUser(user);
  const hasReporterAccess = user?.role === 'reporter' || isSuperAdmin || isAdmin;
  const isRealUser = isAuthenticated && !!user && !String(user.id || '').startsWith('guest_');


  useEffect(() => {
    // Ensure full-screen feed is always reset to false on app start
    useUIStore.getState().setIsFullScreenFeed(false);

    // Initialize Google Auth plugin (Web only, native handles it via config/strings.xml)
    const isWeb = true;
    if (isWeb) {
      try {
        GoogleAuth.initialize({
          clientId: '831106920430-h8h1nj7a5j2iirgki34ve8ariuj8uroi.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
      } catch (e) {
        console.warn("GoogleAuth initialize error:", e);
      }
    }

    // Listen for deep links (e.g. Supabase OAuth callback)
    CapacitorApp.addListener('appUrlOpen', async (event) => {
      if (event.url.includes('access_token')) {
        await Browser.close().catch(() => { });
        const urlObj = new URL(event.url);
        // Supabase passes tokens in the hash like #access_token=...&refresh_token=...
        const hashStr = urlObj.hash.startsWith('#') ? urlObj.hash.substring(1) : urlObj.hash;
        const params = new URLSearchParams(hashStr);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = urlObj.searchParams.get('type') || params.get('type');

        if (access_token && refresh_token) {
          const { data } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (data.session) {
            login(data.session.user as any, data.session.access_token);
            if (type === 'recovery') {
              window.dispatchEvent(new CustomEvent('appUrlOpenRoute', { detail: { type: 'recovery' } }));
            }
          }
        }
      }
    });

    // Listen for appRestoredResult to handle Android background killing during camera/gallery intents
    CapacitorApp.addListener('appRestoredResult', (data: any) => {
      console.log('App restored result:', data);
      if (data && data.pluginId === 'Camera' && data.methodName === 'pickImages') {
        if (data.data && data.data.photos && data.data.photos.length > 0) {
          const webPath = data.data.photos[0].webPath;
          if (webPath) {
            setPendingCropImageSrc(webPath);
          }
        }
      }
    });

    // Initialize keep-alive ping immediately so Render backend never sleeps while app is active
    initBackendKeepAlive();

    // Always sync latest role, plan, and district on cold launch & app focus
    const syncUserProfile = async (userId?: string, userEmail?: string) => {
      if (!userId && !userEmail) return;
      try {
        // Only refresh session if user is already logged in
        let metaRole: string | undefined;
        let metaPlan: string | undefined;
        try {
          const { data: refreshedSession } = await supabase.auth.refreshSession();
          const authUser = refreshedSession?.session?.user;
          metaRole = (authUser as any)?.app_metadata?.role || (authUser as any)?.user_metadata?.role;
          metaPlan = (authUser as any)?.app_metadata?.plan || (authUser as any)?.user_metadata?.plan;
        } catch {}

        let prof: any = null;
        if (userId) {
          const { data } = await supabase
            .from('profiles')
            .select('role, plan, district, state')
            .eq('id', userId)
            .maybeSingle();
          if (data) prof = data;
        }
        if (!prof && userEmail) {
          const { data } = await supabase
            .from('profiles')
            .select('role, plan, district, state')
            .ilike('email', userEmail.trim())
            .maybeSingle();
          if (data) prof = data;
        }

        // Check if user has active reporter application
        if ((!prof || prof.role === 'user') && userEmail) {
          try {
            const { data: appData } = await supabase
              .from('reporter_applications')
              .select('status, district, state')
              .ilike('email', userEmail.trim())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (appData && (appData.status === 'active' || appData.status === 'approved')) {
              prof = {
                role: 'reporter',
                plan: prof?.plan || 'reporter',
                district: appData.district || prof?.district,
                state: appData.state || prof?.state,
              };
            }
          } catch {}
        }

        // Database profiles table is the ground truth updated by Superadmin
        const isSuperAdminEmail = (userEmail || '').trim().toLowerCase() === 'mohithroyal16450@gmail.com';
        const effectiveRole = isSuperAdminEmail
          ? 'superadmin'
          : (prof?.role || (metaRole && metaRole !== 'authenticated' && metaRole !== 'user' ? metaRole : prof?.role || 'user'));
        const effectivePlan = prof?.plan || metaPlan;

        const updates: any = {};
        if (effectiveRole) updates.role = effectiveRole;
        if (effectivePlan) updates.plan = effectivePlan;
        if (prof?.district) {
          updates.district = prof.district;
          useAuthStore.getState().setDistrict(prof.district);
        }
        if (prof?.state) {
          updates.state = prof.state;
          useAuthStore.getState().setUserState(prof.state);
        }
        if (Object.keys(updates).length > 0) {
          updateUser(updates);
        }
      } catch (err) {
        console.warn('[App] Failed to sync profile on launch:', err);
      }
    };

    const currentLoggedInUser = useAuthStore.getState().user;
    if (currentLoggedInUser?.id || currentLoggedInUser?.email) {
      syncUserProfile(currentLoggedInUser.id, currentLoggedInUser.email);
    }

    const onAppVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const u = useAuthStore.getState().user;
        if (u?.id || u?.email) {
          syncUserProfile(u.id, u.email);
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onAppVisible);
    }

    // Proactive periodic role sync (every 20s) so role updates by Superadmin reflect live
    const profileSyncTimer = setInterval(() => {
      const u = useAuthStore.getState().user;
      if (u?.id || u?.email) {
        syncUserProfile(u.id, u.email);
      }
    }, 20000);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().logout();
        return;
      }
      if (!session) {
        // Do NOT log the user out just because Supabase session is null!
        // The user is authenticated via backend JWT / OTP in the store.
        return;
      }
      // Only auto-update if the user is ALREADY authenticated in the application store.
      // Explicit login flows (handleLogin, handleGoogleLogin, VerifyOtpScreen) manage the initial login
      // after database validation and application status verification.
      if (session && useAuthStore.getState().isAuthenticated) {
        const email = session.user?.email;
        const savedName = getReporterName(email);
        const savedPhoto = getReporterPhoto(email);
        const metaName = (session.user as any)?.user_metadata?.full_name || (session.user as any)?.user_metadata?.name || (session.user as any)?.full_name || '';

        // Ground-truth profile check to keep role, plan, district in sync
        let dbRole: string | undefined;
        let dbPlan: string | undefined;
        let dbDistrict: string | undefined;
        let dbState: string | undefined;
        try {
          let prof: any = null;
          if (session.user.id) {
            const { data } = await supabase
              .from('profiles')
              .select('role, plan, district, state')
              .eq('id', session.user.id)
              .maybeSingle();
            if (data) prof = data;
          }
          if (!prof && email) {
            const { data } = await supabase
              .from('profiles')
              .select('role, plan, district, state')
              .ilike('email', email.trim())
              .maybeSingle();
            if (data) prof = data;
          }
          if ((!prof || prof.role === 'user') && email) {
            const { data: appData } = await supabase
              .from('reporter_applications')
              .select('status, district, state')
              .ilike('email', email.trim())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (appData && (appData.status === 'active' || appData.status === 'approved')) {
              prof = { role: 'reporter', plan: 'reporter', district: appData.district, state: appData.state };
            }
          }
          if (prof) {
            dbRole = prof.role;
            dbPlan = prof.plan;
            dbDistrict = prof.district;
            dbState = prof.state;
          }
        } catch (e) {
          console.error(e);
        }

        const currentRole = useAuthStore.getState().user?.role;
        const effectiveRole = dbRole || (currentRole && currentRole !== 'authenticated' ? currentRole : undefined);
        const effectivePlan = dbPlan || useAuthStore.getState().user?.plan;
        const effectiveDistrict = dbDistrict || useAuthStore.getState().user?.district;
        const effectiveState = dbState || useAuthStore.getState().user?.state;

        const userObj = {
          ...session.user,
          full_name: metaName || savedName || '',
          firstName: metaName || savedName || '',
          avatarUrl: savedPhoto || (session.user as any)?.user_metadata?.avatar_url || (session.user as any)?.user_metadata?.picture || '',
          role: effectiveRole,
          plan: effectivePlan,
          district: effectiveDistrict,
          state: effectiveState,
        };
        
        login(userObj as any, session.access_token);
        if (effectiveDistrict) {
          useAuthStore.getState().setDistrict(effectiveDistrict);
        }
        if (effectiveState) {
          useAuthStore.getState().setUserState(effectiveState);
        }
      }
    });

    // Initial splash screen dismiss timer (runs once on cold start only)
    const timer = setTimeout(() => setIsInitializing(false), 1200);
    return () => {
      clearTimeout(timer);
      clearInterval(profileSyncTimer);
      authListener.subscription.unsubscribe();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onAppVisible);
      CapacitorApp.removeAllListeners();
    };
  }, []);

  if (isInitializing) return <SplashScreen />;

  return (
    <Router>
      <AppUrlListener />
      <Routes>
        <Route path="/login" element={<LoginRouteWrapper isRealUser={isRealUser} />} />
        <Route path="/reporter" element={<ReporterAuthScreen />} />
        <Route path="/apply" element={<ReporterAuthScreen />} />
        <Route path="/reporter/apply" element={<ReporterAuthScreen />} />
        <Route path="/signup" element={<ReporterAuthScreen />} />
        <Route path="/login/otp" element={<ReporterAuthScreen />} />
        <Route path="/login/verify" element={<ReporterAuthScreen />} />
        <Route path="/reporter/status" element={<ReporterStatusScreen />} />
        <Route path="/reporter/id-card-apply" element={<IdCardApplyScreen />} />
        {/* Old email/password login kept only for admins */}
        <Route path="/login/email" element={!isRealUser ? <LoginScreen /> : <Navigate to="/" />} />
        <Route
          path="/create-password"
          element={<CreatePasswordScreen />}
        />
        <Route
          path="/reset-password"
          element={<CreatePasswordScreen />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPasswordScreen />}
        />

        {/* ── Reporter Approval Flow Routes ── */}
        <Route path="/reporter/waiting" element={<ApplicationWaitingScreen />} />
        <Route path="/reporter/payment" element={<PaymentScreen />} />
        <Route path="/reporter/payment-pending" element={<PaymentPendingScreen />} />
        <Route path="/reporter/activated" element={<PaymentSuccessScreen />} />
        <Route path="/reporter/payment-success" element={<PaymentSuccessScreen />} />
        <Route path="/reporter/payment-failed" element={<PaymentFailedScreen />} />
        <Route path="/reporter/generating" element={<IdGeneratingScreen />} />
        <Route path="/reporter/id-card" element={<ReporterIdCardScreen />} />
        <Route path="/reporter/rejected" element={<ApplicationRejectedScreen />} />

        {/* ── Admin Route (standalone, only for verified admins) ── */}
        <Route
          path="/admin"
          element={
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : (
              <AdminScreen />
            )
          }
        />

        <Route
          path="/preview/:id"
          element={isAuthenticated ? <PreviewScreen /> : <Navigate to="/login" />}
        />

        <Route
          path="/welcome"
          element={<PortalChooserScreen />}
        />

        <Route
          path="/welcome/name"
          element={<UserNameScreen />}
        />

        <Route
          path="/location"
          element={<LocationSelectScreen />}
        />

        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainLayout>
                <Routes>
                  <Route path="/" element={<ReaderHomeScreen />} />
                  <Route path="/feed" element={<FeedScreen />} />
                  <Route path="/post-ad" element={<PostAdScreen />} />
                  <Route path="/location" element={<LocationSelectScreen />} />
                  <Route path="/ad-requests" element={<ReporterAdRequestsScreen />} />
                  <Route path="/stats" element={<ReporterOnly allowed={hasReporterAccess} isRealUser={isRealUser}><StatsScreen /></ReporterOnly>} />
                  <Route path="/dashboard" element={<DashboardScreen />} />
                  <Route path="/generate" element={<ReporterOnly allowed={hasReporterAccess} isRealUser={isRealUser}><GenerateScreen /></ReporterOnly>} />
                  <Route path="/templates" element={<TemplatesScreen />} />
                  <Route path="/news" element={<NewsScreen />} />
                  <Route path="/history" element={<NewsScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                  <Route path="/settings/profile" element={<ProfileSettingsScreen />} />
                  <Route path="/admin" element={<Navigate to="/admin" replace />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </MainLayout>
            ) : (
              <PortalChooserScreen />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

