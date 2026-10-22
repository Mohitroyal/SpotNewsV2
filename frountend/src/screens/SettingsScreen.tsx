import { useState, useEffect, useRef } from 'react';
import { useAuthStore, useUIStore, useGenerationStore, getReporterPhoto, saveReporterPhoto, getReporterName, isAdminUser, isSuperAdminUser, getEffectiveReporterPhoto } from '@/store';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Trash2, Shield, Check, QrCode, LogOut, AlertTriangle, User as UserIcon, UserCircle, ChevronRight, FileText, History, Crown, Loader2, MapPin, Megaphone, Download, Share2, Printer, FileImage, ExternalLink, RotateCw, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { useTranslation } from '@/lib/i18n';
import { authService } from '@/services/auth.service';
import { INDIA_STATES } from '@/utils/indiaStates';
import { initPush, disablePush, requestPushPermission, checkPushPermission, isPushSupported } from '@/lib/push';
import { RtiIdCard, type RtiCardData } from '@/components/RtiIdCard';
import { exportIdCardPdf, exportIdCardPng, printIdCard, shareIdCard } from '@/utils/idCardExport';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { notificationService, type NotificationType } from '@/services/notification.service';

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${enabled ? "bg-[#145AB1]" : "bg-gray-200"}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function SettingsSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-3xl overflow-hidden shadow-sm transition-colors duration-300">
      <div className="px-5 py-4 border-b border-[#D0E2F7] flex items-center gap-3 bg-[#E8F2FC]">
        <Icon className="h-4 w-4 text-[#015BB3]" />
        <h2 className="text-sm font-bold text-[#0A2540]">{title}</h2>
      </div>
      <div className="divide-y divide-[#D0E2F7]">{children}</div>
    </div>
  );
}

function SettingsRow({ label, description, control }: { label: string; description?: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4 transition-colors duration-300">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#0A2540]">{label}</p>
        {description && <p className="text-xs text-[#6B7A90] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

// ── Toast Component ─────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold whitespace-nowrap
        ${type === 'success'
          ? 'bg-gray-900 dark:bg-gray-800 text-white border border-gray-700'
          : 'bg-red-600 text-white'
        }`}
    >
      {type === 'success' ? (
        <Check className="w-4 h-4 text-green-400 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      {message}
    </motion.div>
  );
}

export const SettingsScreen = () => {
  const { user, logout, userState, setUserState, district, setDistrict } = useAuthStore();
  const resetGenerations = useGenerationStore((state) => state.resetConfig);
  const navigate = useNavigate();

  // ── Admin check (checks super admin, user metadata, Supabase profiles table & backend API) ──
  const [isAdminAccess, setIsAdminAccess] = useState(
    isAdminUser(user) ||
    (user as any)?.role === 'admin' ||
    (user as any)?.app_metadata?.role === 'admin' ||
    (user as any)?.user_metadata?.role === 'admin'
  );
  useEffect(() => {
    if (
      isAdminUser(user) ||
      (user as any)?.role === 'admin' ||
      (user as any)?.app_metadata?.role === 'admin' ||
      (user as any)?.user_metadata?.role === 'admin'
    ) {
      setIsAdminAccess(true);
      return;
    }
    if (!user?.id) return;
    (async () => {
      try {
        // 1. Check Supabase profiles table
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (prof?.role === 'admin') {
          setIsAdminAccess(true);
          return;
        }
      } catch { /* silent */ }
    })();
  }, [user?.id]);

  // ── Reporter ID Card State inside Settings ──
  const [reporterAppData, setReporterAppData] = useState<any>(null);
  const [idCardSide, setIdCardSide] = useState<'front' | 'back'>('front');
  const [isExportingCard, setIsExportingCard] = useState(false);
  const [idCardMessage, setIdCardMessage] = useState('');
  const [idCardExpanded, setIdCardExpanded] = useState(true);

  const settingsFileInputRef = useRef<HTMLInputElement>(null);

  const [settingsPhotoUrl, setSettingsPhotoUrl] = useState<string>(() => {
    return (
      getReporterPhoto(user?.email) ||
      localStorage.getItem('spotnews_active_reporter_photo') ||
      (user as any)?.avatarUrl ||
      ''
    );
  });

  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    reporterApprovalService
      .checkStatus(email)
      .then((data) => {
        if (data) {
          setReporterAppData(data);
          if (data.avatarUrl && !settingsPhotoUrl) {
            setSettingsPhotoUrl(data.avatarUrl);
          }
        }
      })
      .catch((e) => console.warn('Could not fetch reporter app details in settings:', e));
  }, [user?.email, settingsPhotoUrl]);

  const handleSettingsPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanEmail = (user?.email || reporterAppData?.email || '').toLowerCase().trim();
    const isIdPhotoLocked =
      localStorage.getItem(`spotnews_id_photo_confirmed_${cleanEmail}`) === 'true' ||
      !!localStorage.getItem(`spotnews_id_card_photo_${cleanEmail}`);

    if (isIdPhotoLocked) {
      setIdCardMessage('Photo is permanently locked to your Official ID Card and cannot be changed from Settings.');
      setTimeout(() => setIdCardMessage(''), 4000);
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSettingsPhotoUrl(dataUrl);
      if (user?.email) {
        saveReporterPhoto(user.email, dataUrl);
      }
      if (reporterAppData?.email) {
        saveReporterPhoto(reporterAppData.email, dataUrl);
      }
      localStorage.setItem('spotnews_active_reporter_photo', dataUrl);
      useAuthStore.getState().updateUser({ avatarUrl: dataUrl });
      setIdCardMessage('Photo updated successfully on your ID card!');
      setTimeout(() => setIdCardMessage(''), 4000);
    };
    reader.readAsDataURL(file);
  };

  const storedReporterName =
    getReporterName(user?.email) ||
    getReporterName(reporterAppData?.email) ||
    localStorage.getItem('spotnews_active_reporter_name');

  const settingsReporterName =
    storedReporterName ||
    reporterAppData?.name ||
    'POKKALA MOHITH ROYAL';

  const effectivePhoto = getEffectiveReporterPhoto(
    user?.email || reporterAppData?.email,
    [
      settingsPhotoUrl,
      reporterAppData?.avatarUrl,
      user?.avatarUrl,
    ]
  );

  const settingsCardData: RtiCardData = {
    cardNo:
      reporterAppData?.reporterId ||
      (reporterAppData?.refNo
        ? `RTI ${reporterAppData.refNo.replace(/\D/g, '').slice(-4) || '1147'}`
        : 'SNP-TE-2026-16EDF5'),
    name: settingsReporterName,
    designation: `${(reporterAppData?.district || district || 'PRESS').toUpperCase()} REPORTER`,
    center: (reporterAppData?.district || district || userState || 'HYDERABAD').toUpperCase(),
    validUpto: reporterAppData?.validUntil || '16 OCT 2027',
    photoUrl: effectivePhoto || '/dummy.jpg',
    address: `${reporterAppData?.district || district || 'Hyderabad'}, ${reporterAppData?.state || userState || 'Telangana'}, Andhra Pradesh & Telangana`,
    pin: '515001',
    phone: reporterAppData?.phone || user?.phone_number || '7668886666',
    relation: 'S/O',
    guardian: '',
    mediaType: 'PRINT MEDIA',
    actLine: 'RTI ACT-2005',
    logoUrl: '/logo_spotnews.png',
  };

  const handleExportPdfFromSettings = async () => {
    setIsExportingCard(true);
    setIdCardMessage('');
    try {
      const frontEl = document.getElementById('rti-card-front');
      const backEl = document.getElementById('rti-card-back');
      if (!frontEl) throw new Error('ID card element not found');
      const res = await exportIdCardPdf(settingsCardData.cardNo, frontEl, backEl);
      if (res.message) {
        setIdCardMessage(res.message);
        setTimeout(() => setIdCardMessage(''), 5000);
      }
    } catch (e: any) {
      setIdCardMessage(e.message || 'Error exporting PDF');
      setTimeout(() => setIdCardMessage(''), 5000);
    } finally {
      setIsExportingCard(false);
    }
  };

  const handleExportPngFromSettings = async (targetSide: 'front' | 'back') => {
    setIsExportingCard(true);
    setIdCardMessage('');
    try {
      setIdCardSide(targetSide);
      const elId = targetSide === 'front' ? 'rti-card-front' : 'rti-card-back';
      const el = document.getElementById(elId);
      if (!el) throw new Error('Card element not found');
      const res = await exportIdCardPng(settingsCardData.cardNo, el, targetSide === 'front' ? 'FRONT' : 'BACK', false);
      if (res.message) {
        setIdCardMessage(res.message);
        setTimeout(() => setIdCardMessage(''), 5000);
      }
    } catch (e: any) {
      setIdCardMessage(e.message || 'Error exporting PNG');
      setTimeout(() => setIdCardMessage(''), 5000);
    } finally {
      setIsExportingCard(false);
    }
  };

  const handleShareCardFromSettings = async () => {
    const shareText = `Official RTI EXPRESS Spot News 24x7 Press ID Card\n` +
      `Reporter: ${settingsCardData.name}\n` +
      `Designation: ${settingsCardData.designation}\n` +
      `Card No: ${settingsCardData.cardNo}\n` +
      `Valid Upto: ${settingsCardData.validUpto}\n` +
      `Verification Helpline: 7668886666`;

    try {
      const frontEl = document.getElementById('rti-card-front');
      const res = await shareIdCard(settingsCardData.cardNo, shareText, frontEl);
      if (res.message) {
        setIdCardMessage(res.message);
        setTimeout(() => setIdCardMessage(''), 4000);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handlePrintCardFromSettings = async () => {
    setIsExportingCard(true);
    try {
      const frontEl = document.getElementById('rti-card-front');
      const backEl = document.getElementById('rti-card-back');
      if (!frontEl) throw new Error('ID card element not found');
      const res = await printIdCard(settingsCardData.cardNo, frontEl, backEl);
      if (res.message) {
        setIdCardMessage(res.message);
        setTimeout(() => setIdCardMessage(''), 4000);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsExportingCard(false);
    }
  };

  // Use persistent UI store
  const logoMode = useUIStore((state) => state.logoMode);
  const showInnerBorders = useUIStore((state) => state.showInnerBorders);
  const toggleLogoMode = useUIStore((state) => state.toggleLogoMode);
  const toggleInnerBorders = useUIStore((state) => state.toggleInnerBorders);
  const { t, language: activeLanguage } = useTranslation();
  const setLanguage = useUIStore((state) => state.setLanguage);

  const [notifications, setNotifications] = useState({
    emailGenerations: true,
    emailBilling: true,
    emailUpdates: true,
    browserPush: true,
  });
  const [sendingNotificationType, setSendingNotificationType] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch preferences from Supabase service
    notificationService.getPreferences(user?.id, user?.email).then((prefs) => {
      setNotifications(prefs);
    });

    // 2. Also check device push permission
    checkPushPermission().then((granted) => {
      setNotifications((prev) => ({ ...prev, browserPush: granted }));
    });
  }, [user?.id, user?.email]);

  const toggle = async (key: keyof typeof notifications) => {
    if (key === 'browserPush') {
      const willEnable = !notifications.browserPush;
      if (willEnable) {
        const isNative = await isPushSupported();
        if (!isNative) {
          const next = { ...notifications, browserPush: true };
          setNotifications(next);
          await notificationService.savePreferences(user?.id, user?.email, next);
          showToast('Push notifications enabled (web)', 'success');
          return;
        }

        const granted = await requestPushPermission();
        if (granted) {
          await initPush({
            userId: user?.id,
            districtId: (user as any)?.district_id || 1,
            navigate,
          });
          const next = { ...notifications, browserPush: true };
          setNotifications(next);
          await notificationService.savePreferences(user?.id, user?.email, next);
          showToast('Device push notifications enabled', 'success');
        } else {
          showToast('Push permission denied. Enable in device settings.', 'error');
        }
      } else {
        await disablePush();
        const next = { ...notifications, browserPush: false };
        setNotifications(next);
        await notificationService.savePreferences(user?.id, user?.email, next);
        showToast('Device push notifications disabled', 'success');
      }
      return;
    }

    const nextVal = !notifications[key];
    const next = { ...notifications, [key]: nextVal };
    setNotifications(next);

    // Save preferences to Supabase
    await notificationService.savePreferences(user?.id, user?.email, next);

    // When enabling an email notification, send immediate notification to Gmail via Supabase service
    if (nextVal && user?.email) {
      const typeLabel =
        key === 'emailGenerations'
          ? 'Generation Complete'
          : key === 'emailBilling'
          ? 'Billing & Subscription'
          : 'Product Updates';

      showToast(`Notification email dispatching to ${user.email} via Supabase...`, 'success');
      try {
        const res = await notificationService.sendNotificationEmail(user.id, user.email, key as NotificationType);
        showToast(res.message, 'success');
      } catch (err: any) {
        console.warn('[SettingsScreen] Notification dispatch error:', err);
        showToast(`Saved preference to Supabase (${typeLabel})`, 'success');
      }
    } else {
      showToast('Notification preference updated in Supabase', 'success');
    }
  };

  const handleSendTestNotification = async (type: NotificationType) => {
    if (!user?.email) {
      showToast('Please log in with your Gmail to test notifications.', 'error');
      return;
    }

    setSendingNotificationType(type);
    try {
      const res = await notificationService.sendNotificationEmail(user.id, user.email, type);
      showToast(res.message, 'success');
    } catch (err: any) {
      console.error('[SettingsScreen] Send notification error:', err);
      showToast(err.message || 'Failed to send notification email.', 'error');
    } finally {
      setSendingNotificationType(null);
    }
  };

  // ── Logout state ───────────────────────────────────────────────────────────────
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * Full logout sequence:
   * 1. Sign out from Supabase (invalidates server-side session & JWT)
   * 2. Clear Zustand auth store (clears token + user from localStorage via persist)
   * 3. Clear generation store config
   * 4. Wipe all newscraft-* keys from localStorage (quota cache, profile cache, etc.)
   * 5. Navigate to /login
   */
  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      // 1. Supabase session invalidation
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Logout] Supabase signOut error (continuing anyway):', err);
    }

    try {
      // 1b. Google Auth Sign-Out to force account picker on next login
      await GoogleAuth.signOut();
    } catch (err) {
      console.warn('[Logout] Google Sign-Out error (continuing anyway):', err);
    }

    try {
      // 2. Clear Zustand auth store (persisted to localStorage as "newscraft-auth")
      logout();

      // 3. Clear generation session data from Zustand persist store
      resetGenerations();

      // 4. Wipe all newscraft-* localStorage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('newscraft')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
      showToast(t.logoutSuccess, 'success');

      // Small delay so toast is visible before navigation
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 800);
    } catch (err) {
      console.error('[Logout] Error during logout:', err);
      setIsLoggingOut(false);
      showToast(t.logoutError, 'error');
    }
  };

  // Modals state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isTfaModalOpen, setIsTfaModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaVerificationCode, setTfaVerificationCode] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match!");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setPasswordSuccess(true);
      showToast("Password updated successfully!", "success");
      setTimeout(() => {
        setPasswordSuccess(false);
        setIsPasswordModalOpen(false);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleTfaToggle = () => {
    if (tfaEnabled) {
      setTfaEnabled(false);
    } else {
      setIsTfaModalOpen(true);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "DELETE") return;
    setIsDeletingAccount(true);
    setDeleteError("");
    try {
      await authService.deleteAccount();
      // Reset local store data
      useGenerationStore.getState().resetConfig();
      if (user?.email) {
        localStorage.removeItem(`newscraft_reporter_name_${user.email}`);
        localStorage.removeItem(`newscraft_reporter_photo_${user.email}`);
      }
      setIsDeleteModalOpen(false);
      setDeleteConfirmationText("");
      logout();
      showToast("Account and all generated content deleted permanently.", "success");
      navigate('/login');
    } catch (err: any) {
      console.error("Delete account error:", err);
      const msg = err.response?.data?.detail || err.message || "Failed to delete account";
      setDeleteError(msg);
      showToast(msg, "error");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="p-6 pb-6 bg-[#F3F6FB] transition-colors duration-300">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D6E9FF] flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#015BB3]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#0A2540] transition-colors duration-300">{t.settings}</h2>
            <p className="text-xs text-[#6B7A90] mt-0.5 transition-colors duration-300">{t.manageAcc}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Reporter Profile Card */}
        <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full border-2 border-[#CC1E1E] bg-[#D6E9FF] flex items-center justify-center shadow-md overflow-hidden shrink-0">
              {effectivePhoto ? (
                <img src={effectivePhoto} alt="Reporter Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#0A2540]">
                  <UserIcon className="w-7 h-7 text-[#0A2540]/60" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#0A2540] text-base">
                  {settingsReporterName}
                </h3>
                {isAdminAccess ? (
                  <span className="bg-amber-500/15 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-amber-400/30">
                    <Crown className="w-2.5 h-2.5 text-amber-600" /> Admin
                  </span>
                ) : (
                  <span className="bg-[#CC1E1E]/10 text-[#CC1E1E] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Reporter
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7A90] mt-0.5">{user?.email || 'reporter@rtiexpress.com'}</p>
            </div>
          </div>
        </div>

        {/* Profile Settings Card */}
        <div
          onClick={() => navigate('/settings/profile')}
          className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-[12px] p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#D6E9FF] flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-[#015BB3]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A2540]">{t.profileSettings}</h3>
              <p className="text-xs text-[#6B7A90] mt-0.5">{t.profileSettingsDesc}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B7A90] shrink-0" />
        </div>

        {/* Official Press ID Card Section inside Settings */}
        <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
          <div className="px-5 py-4 border-b border-[#D0E2F7] flex items-center justify-between bg-[#E8F2FC]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0B4EA2] text-white flex items-center justify-center shrink-0 shadow-xs">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#0A2540]">Official Press ID Card</h2>
                  <span className="bg-[#CC1E1E] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                    VERIFIED
                  </span>
                </div>
                <p className="text-xs text-[#6B7A90] mt-0.5">RTI EXPRESS Spot News 24×7 Official Credential</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIdCardExpanded(!idCardExpanded)}
              className="text-xs font-bold text-[#0B4EA2] hover:underline cursor-pointer"
            >
              {idCardExpanded ? 'Hide' : 'Show'}
            </button>
          </div>

          {idCardExpanded && (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Hidden file input for changing passport photo */}
              <input
                ref={settingsFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSettingsPhotoUpload}
              />

              {/* Status & Feedback message */}
              {idCardMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{idCardMessage}</span>
                </div>
              )}

              {/* Side toggle tabs */}
              <div className="flex items-center justify-center p-1 bg-[#D0E2F7] rounded-2xl gap-1 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setIdCardSide('front')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    idCardSide === 'front' ? 'bg-white text-[#0B4EA2] shadow-sm' : 'text-[#64748B]'
                  }`}
                >
                  Front Side
                </button>
                <button
                  type="button"
                  onClick={() => setIdCardSide('back')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    idCardSide === 'back' ? 'bg-white text-[#0B4EA2] shadow-sm' : 'text-[#64748B]'
                  }`}
                >
                  Back Side
                </button>
              </div>

              {/* Centered Realistic 3D Flipping ID Card Preview */}
              <div className="flex flex-col items-center justify-center py-2 bg-gradient-to-b from-slate-200/50 to-slate-200/20 rounded-2xl border border-slate-300/60 p-3 overflow-x-auto shadow-inner">
                <RtiIdCard
                  data={settingsCardData}
                  side={idCardSide}
                  scale={0.92}
                  onPhotoClick={() => showToast('Reporter photo is permanently locked to your official application photo.', 'success')}
                  onCardFlip={() => setIdCardSide((prev) => (prev === 'front' ? 'back' : 'front'))}
                />
                <p className="text-[10px] text-[#64748B] mt-2 font-medium">Tap card or tab to flip 3D view</p>
              </div>

              {/* Official Photo Status Banner (Locked) */}
              <div className="flex items-center justify-between p-3 bg-white/90 border border-[#CBD5E1] rounded-2xl shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">Official Reporter Passport Photo</p>
                    <p className="text-[11px] text-[#64748B]">Fixed & locked from official application</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1 border border-emerald-200">
                  <Check className="w-3.5 h-3.5" />
                  Verified & Locked
                </span>
              </div>

              {/* Quick Info Bar */}
              <div className="bg-white/80 border border-[#D0E2F7] rounded-2xl p-3 space-y-1.5 text-xs text-[#0F172A]">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-[#0B4EA2]">Card No:</span>
                  <span className="font-mono text-xs font-black text-[#0A2540] bg-[#EEF4FB] px-2 py-0.5 rounded border border-[#C6DCF4]">
                    {settingsCardData.cardNo}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#64748B] text-[11px]">
                  <span>Valid Through:</span>
                  <span className="font-semibold text-emerald-700">{settingsCardData.validUpto}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleExportPdfFromSettings}
                  disabled={isExportingCard}
                  className="w-full py-3 px-4 bg-[#0B4EA2] hover:bg-[#093F84] active:scale-[0.99] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isExportingCard ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download Print-Ready ID Card (PDF)</span>
                </button>

                {/* Dedicated 3D Card Flip Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIdCardSide('front')}
                    className={`py-2.5 px-3 border rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                      idCardSide === 'front'
                        ? 'bg-[#0B4EA2] text-white border-[#0B4EA2]'
                        : 'bg-white hover:bg-slate-50 border-[#D0E2F7] text-[#0F172A]'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Flip to Front</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIdCardSide('back')}
                    className={`py-2.5 px-3 border rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                      idCardSide === 'back'
                        ? 'bg-[#0B4EA2] text-white border-[#0B4EA2]'
                        : 'bg-white hover:bg-slate-50 border-[#D0E2F7] text-[#0F172A]'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Flip to Back</span>
                  </button>
                </div>

                {/* Save PNG directly to Photos / Gallery without sharing */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportPngFromSettings('front')}
                    disabled={isExportingCard}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-[#D0E2F7] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileImage className="w-3.5 h-3.5 text-[#0B4EA2]" />
                    <span>Save Front PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPngFromSettings('back')}
                    disabled={isExportingCard}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-[#D0E2F7] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileImage className="w-3.5 h-3.5 text-[#0B4EA2]" />
                    <span>Save Back PNG</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleShareCardFromSettings}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-[#D0E2F7] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#0B4EA2]" />
                    <span>Share ID Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintCardFromSettings}
                    disabled={isExportingCard}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-[#D0E2F7] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#0B4EA2]" />
                    <span>Print Card</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/reporter/id-card')}
                  className="w-full py-2.5 px-4 bg-white/70 hover:bg-white text-[#0B4EA2] font-bold text-xs rounded-xl border border-[#D0E2F7] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Fullscreen ID Card Page</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Templates Card */}
        <div
          onClick={() => navigate('/templates')}
          className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-[12px] p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#D6E9FF] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#015BB3]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A2540]">{t.templatesTitle}</h3>
              <p className="text-xs text-[#6B7A90] mt-0.5">{t.templatesDesc}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B7A90] shrink-0" />
        </div>

        {/* History Card */}
        <div
          onClick={() => navigate('/history')}
          className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-[12px] p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#D6E9FF] flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-[#015BB3]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A2540]">{t.historyTitle}</h3>
              <p className="text-xs text-[#6B7A90] mt-0.5">{t.historyDesc}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B7A90] shrink-0" />
        </div>

        {/* Local Ads & Sponsorships Card */}
        {(isAdminAccess || user?.role === 'reporter') && (
          <div
            onClick={() => navigate('/ad-requests')}
            className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-[12px] p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#D6E9FF] flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-[#015BB3]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0A2540]">Local Ads & Sponsorships</h3>
                <p className="text-xs text-[#6B7A90] mt-0.5">Submit & manage feed advertisements</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7A90] shrink-0" />
          </div>
        )}

        {/* Admin Panel Card — only visible to approved admins (DB-checked) */}
        {isAdminAccess && (
          <div
            onClick={() => navigate('/admin')}
            className="bg-gradient-to-r from-[#E8F2FC] to-[#DDF0FF] border-2 border-amber-400/60 rounded-[12px] p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#0A2540]">
                    {isSuperAdminUser(user) ? 'Superadmin Control Center' : 'Admin Control Center'}
                  </h3>
                  <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-xs">
                    {isSuperAdminUser(user) ? 'SUPERADMIN' : 'ADMIN'}
                  </span>
                </div>
                <p className="text-xs text-[#6B7A90] mt-0.5">
                  {isSuperAdminUser(user)
                    ? 'Manage users, roles, statistics & logos'
                    : 'Manage users, roles & statistics'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-600 shrink-0" />
          </div>
        )}

        {/* Location Preferences */}
        <SettingsSection title="Content Location" icon={MapPin}>
          <div className="px-5 py-4 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-[#0A2540]">Select State</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <select
                  value={userState || ''}
                  onChange={(e) => {
                    setUserState(e.target.value);
                    setDistrict('');
                  }}
                  className="w-full bg-[#F3F6FB] border border-[#DCE6F0] rounded-[10px] py-[9px] pl-[34px] pr-3 text-[#0A2540] text-sm focus:outline-none focus:border-[#015BB3] appearance-none font-medium"
                >
                  <option value="" disabled>Select State</option>
                  {Object.keys(INDIA_STATES).map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-[#0A2540]">Select District</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
                <select
                  value={district || ''}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!userState}
                  className="w-full bg-[#F3F6FB] border border-[#DCE6F0] rounded-[10px] py-[9px] pl-[34px] pr-3 text-[#0A2540] text-sm focus:outline-none focus:border-[#015BB3] appearance-none font-medium disabled:opacity-50"
                >
                  <option value="" disabled>Select District</option>
                  {userState && INDIA_STATES[userState]?.map((dist) => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title={t.appearance} icon={Moon}>

          <SettingsRow
            label={t.innerBorders}
            description={t.innerBordersDesc}
            control={
              <ToggleSwitch
                enabled={showInnerBorders ?? true}
                onToggle={toggleInnerBorders}
              />
            }
          />
          <SettingsRow
            label={t.darkMode}
            description={t.darkModeDesc}
            control={<ToggleSwitch enabled={logoMode} onToggle={() => toggleLogoMode()} />}
          />
          <SettingsRow
            label={t.interfaceLang}
            description={t.interfaceLangDesc}
            control={
              <select
                value={activeLanguage}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#F3F6FB] border border-[#DCE6F0] rounded-xl px-3 py-2 text-sm text-[#0A2540] focus:outline-none focus:border-[#145AB1] appearance-none font-bold"
              >
                <option value="en">English</option>
                <option value="te">Telugu</option>
                <option value="hi">Hindi</option>
              </select>
            }
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title={t.notifications} icon={Bell}>
          {/* Supabase Gmail routing indicator */}
          <div className="px-5 py-3 bg-blue-50/60 border-b border-[#D0E2F7] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="text-xs truncate">
                <span className="text-[#64748B]">Send alerts to: </span>
                <span className="font-bold text-[#0A2540]">{user?.email || 'Logged in Gmail'}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[#0B4EA2] bg-white border border-blue-200 px-2.5 py-0.5 rounded-full shadow-2xs">
              Supabase Service Active
            </span>
          </div>

          <SettingsRow
            label={t.emailGen}
            description={t.emailGenDesc}
            control={
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSendTestNotification('emailGenerations')}
                  disabled={sendingNotificationType === 'emailGenerations'}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-[#0B4EA2] bg-white hover:bg-blue-50 active:scale-95 border border-[#D0E2F7] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Send generation test email to Gmail"
                >
                  {sendingNotificationType === 'emailGenerations' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B4EA2]" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  )}
                  <span>Send to Gmail</span>
                </button>
                <ToggleSwitch enabled={notifications.emailGenerations} onToggle={() => toggle("emailGenerations")} />
              </div>
            }
          />
          <SettingsRow
            label={t.emailBilling}
            description={t.emailBillingDesc}
            control={
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSendTestNotification('emailBilling')}
                  disabled={sendingNotificationType === 'emailBilling'}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-[#0B4EA2] bg-white hover:bg-blue-50 active:scale-95 border border-[#D0E2F7] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Send billing alert email to Gmail"
                >
                  {sendingNotificationType === 'emailBilling' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B4EA2]" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  )}
                  <span>Send to Gmail</span>
                </button>
                <ToggleSwitch enabled={notifications.emailBilling} onToggle={() => toggle("emailBilling")} />
              </div>
            }
          />
          <SettingsRow
            label={t.emailUpdates}
            description={t.emailUpdatesDesc}
            control={
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSendTestNotification('emailUpdates')}
                  disabled={sendingNotificationType === 'emailUpdates'}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-[#0B4EA2] bg-white hover:bg-blue-50 active:scale-95 border border-[#D0E2F7] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Send product update email to Gmail"
                >
                  {sendingNotificationType === 'emailUpdates' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B4EA2]" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  )}
                  <span>Send to Gmail</span>
                </button>
                <ToggleSwitch enabled={notifications.emailUpdates} onToggle={() => toggle("emailUpdates")} />
              </div>
            }
          />
          <SettingsRow
            label={t.browserPush}
            description={t.browserPushDesc}
            control={
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSendTestNotification('browserPush')}
                  disabled={sendingNotificationType === 'browserPush'}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-[#0B4EA2] bg-white hover:bg-blue-50 active:scale-95 border border-[#D0E2F7] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Send test push alert"
                >
                  {sendingNotificationType === 'browserPush' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B4EA2]" />
                  ) : (
                    <Bell className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  )}
                  <span>Test Push</span>
                </button>
                <ToggleSwitch enabled={notifications.browserPush} onToggle={() => toggle("browserPush")} />
              </div>
            }
          />
        </SettingsSection>

        {/* Security */}
        <SettingsSection title={t.security} icon={Shield}>
          <SettingsRow
            label={t.changePass}
            description={t.changePassDesc}
            control={
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="text-xs font-bold text-white px-4 py-2 bg-[#145AB1] rounded-xl active:scale-95 transition-transform"
              >
                {t.updateBtn}
              </button>
            }
          />
          <SettingsRow
            label={t.tfa}
            description={t.tfaDesc}
            control={<ToggleSwitch enabled={tfaEnabled} onToggle={handleTfaToggle} />}
          />
        </SettingsSection>

        {/* ── Contact Us Button ── */}
        <button
          onClick={() => window.open('https://mohitroyal.github.io/spotnews/contact-us', '_blank')}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#F3F6FB] border border-[#DCE6F0] rounded-2xl shadow-sm active:scale-[0.98] transition-all duration-200 group mb-3"
        >
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-[#D6E9FF] flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#015BB3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[#0A2540]">Contact Us</p>
              <p className="text-xs text-[#6B7A90] mt-0.5">Get help or send feedback</p>
            </div>
          </div>
        </button>

        {/* ── Professional Logout Button ─────────────────────────────────────── */}
        <button
          id="logout-btn"
          onClick={() => setIsLogoutModalOpen(true)}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#F3F6FB] border border-[#DCE6F0] rounded-2xl shadow-sm active:scale-[0.98] transition-all duration-200 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-[#D6E9FF] flex items-center justify-center transition-colors">
              <LogOut className="w-4 h-4 text-[#015BB3]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[#0A2540]">{t.logout}</p>
              <p className="text-xs text-[#6B7A90] mt-0.5">{t.logoutDesc}</p>
            </div>
          </div>
          {isLoggingOut ? (
            <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#015BB3] animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#6B7A90]" />
          )}
        </button>

        {/* ── Subtle Delete Account (bottom, demoted) ────────────────────────── */}
        <div className="pt-2 flex justify-center">
          <button
            id="delete-account-btn"
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-[#6B7A90] hover:text-red-500 transition-colors py-2 px-3 rounded-xl"
          >
            <Trash2 className="w-3 h-3" />
            {t.deleteAcc}
          </button>
        </div>
      </div>

      {/* Modals Overlay */}
      <AnimatePresence>

        {/* ── Logout Confirmation Modal ──────────────────────────────────────── */}
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-[#F3F6FB] rounded-3xl max-w-xs w-full overflow-hidden shadow-2xl border border-[#DCE6F0]"
            >
              {/* Icon header */}
              <div className="pt-7 pb-4 flex flex-col items-center gap-3 px-6">
                <div className="w-14 h-14 rounded-2xl bg-[#D6E9FF] flex items-center justify-center">
                  <LogOut className="w-7 h-7 text-[#015BB3]" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-[#0A2540]">{t.logoutTitle}</h3>
                  <p className="text-sm text-[#6B7A90] mt-1 leading-relaxed">{t.logoutMessage}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
                <button
                  id="logout-confirm-btn"
                  onClick={performLogout}
                  disabled={isLoggingOut}
                  className="w-full py-3.5 bg-[#145AB1] text-white rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Logging out…
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      {t.logoutConfirm}
                    </>
                  )}
                </button>
                <button
                  id="logout-cancel-btn"
                  onClick={() => setIsLogoutModalOpen(false)}
                  disabled={isLoggingOut}
                  className="w-full py-3.5 bg-[#EBF1FA] text-[#0A2540] rounded-2xl text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {t.logoutCancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#F3F6FB] rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-[#DCE6F0]"
            >
              <div className="p-6 border-b border-[#DCE6F0]">
                <h3 className="text-lg font-bold text-[#0A2540]">Change Password</h3>
              </div>
              <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold text-center">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess ? (
                  <div className="text-center py-6 space-y-2">
                    <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <Check className="h-6 w-6" />
                    </div>
                    <p className="text-[#0A2540] font-bold">Password Updated!</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#6B7A90]">New Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#F3F6FB] border border-[#DCE6F0] rounded-xl px-4 py-3 text-sm text-[#0A2540] focus:outline-none focus:border-[#145AB1]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#6B7A90]">Confirm Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#F3F6FB] border border-[#DCE6F0] rounded-xl px-4 py-3 text-sm text-[#0A2540] focus:outline-none focus:border-[#145AB1]"
                      />
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        disabled={passwordLoading}
                        onClick={() => setIsPasswordModalOpen(false)}
                        className="px-4 py-3 text-sm font-bold text-[#6B7A90] bg-[#EBF1FA] rounded-xl w-full"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-4 py-3 text-sm font-bold text-white bg-[#145AB1] rounded-xl w-full flex items-center justify-center disabled:opacity-60"
                      >
                        {passwordLoading ? 'Updating…' : 'Save'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}

        {isTfaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#F3F6FB] rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-[#DCE6F0]"
            >
              <div className="p-6 border-b border-[#DCE6F0]">
                <h3 className="text-lg font-bold text-[#0A2540]">Enable 2FA</h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-[#EBF1FA] p-4 rounded-2xl border border-[#DCE6F0]">
                    <QrCode className="h-32 w-32 text-[#0A2540]" />
                  </div>
                  <p className="text-xs text-[#6B7A90] leading-relaxed">
                    Scan with your authenticator app then enter the 6-digit code below.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#6B7A90]">Verification Code</label>
                  <input
                    type="number"
                    placeholder="123456"
                    value={tfaVerificationCode}
                    onChange={(e) => setTfaVerificationCode(e.target.value)}
                    className="w-full bg-[#F3F6FB] border border-[#DCE6F0] rounded-xl px-4 py-3 text-lg text-[#0A2540] focus:outline-none focus:border-[#145AB1] font-mono text-center tracking-widest"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setIsTfaModalOpen(false); setTfaVerificationCode(""); }}
                    className="px-4 py-3 text-sm font-bold text-[#6B7A90] bg-[#EBF1FA] rounded-xl w-full"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (tfaVerificationCode.length === 6) {
                        setTfaEnabled(true);
                        setIsTfaModalOpen(false);
                      } else {
                        alert("Please enter a valid 6-digit code.");
                      }
                    }}
                    className="px-4 py-3 text-sm font-bold text-white bg-[#145AB1] rounded-xl w-full"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#F3F6FB] rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-red-200"
            >
              <div className="p-6 border-b border-red-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-600">Delete Account & Content?</h3>
                  <p className="text-xs text-red-400 font-semibold">Permanent & Irreversible</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  This will permanently delete your account, authentication credentials, and <strong>all generated newspaper clippings, posts, articles, and media</strong> from our servers.
                </p>

                {deleteError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {deleteError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Type <span className="text-red-600">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmationText}
                    disabled={isDeletingAccount}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm text-red-900 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    disabled={isDeletingAccount}
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDeleteConfirmationText("");
                      setDeleteError("");
                    }}
                    className="px-4 py-3 text-sm font-bold text-[#6B7A90] bg-[#EBF1FA] rounded-xl w-full disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteConfirmationText !== "DELETE" || isDeletingAccount}
                    onClick={handleDeleteAccount}
                    className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-xl w-full disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete All</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Toast notification ─────────────────────────────────────────────── */}
        {toast && <Toast message={toast.message} type={toast.type} />}

      </AnimatePresence>
    </div>
  );
};
