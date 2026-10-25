import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  RefreshCw,
  X,
  Check,
  AlertTriangle,
  FileText,
  Download,
  Send,
  ExternalLink,
  Eye,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuthStore, isAdminUser, isSuperAdminUser } from '@/store';
import { supabase } from '@/lib/supabase';
import { LocalAdsAdminSection } from '@/components/LocalAdsAdminSection';
import {
  getAdminStats,
  getAdminUsers,
  getCachedAdminUsers,
  getPublicationLogos,
  addPublicationLogo,
  removePublicationLogo,
  uploadLogoImage,
  updateUserRole,
  updateUserPlan,
  banUser,
  getAdminClippings,
  approveClippingToFeed,
  rejectClippingSubmission,
  type AdminStats,
  type AdminUserProfile,
  type PublicationLogo,
  type AdminClippingLog,
} from '@/services/admin.service';
import { DailyNewspaperGeneratorModal } from '@/components/DailyNewspaperGeneratorModal';
import { dailyNewspaperService, type DailyEditionRecord } from '@/services/daily-newspaper.service';

// Scoped Admin Design System & Presentational Components
import './admin/admin.css';
import { AdminShell } from './admin/AdminShell';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminClippingsTab } from './admin/AdminClippingsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminRedemptionsTab } from './admin/AdminRedemptionsTab';

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white border border-white/20"
      style={{ background: type === 'success' ? '#059669' : '#d32f2f' }}
    >
      {type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span>{message}</span>
    </motion.div>
  );
}

// ─── Main AdminScreen Component ───────────────────────────────────────────────
export const AdminScreen = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // ── Access guard ──────────────────────────────────────────────────────────
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      // 1. Superadmin fast-path
      if (isSuperAdminUser(user)) {
        setHasAccess(true);
        setAccessChecked(true);
        return true;
      }

      // 2. AdminUser helper
      if (isAdminUser(user)) {
        setHasAccess(true);
        setAccessChecked(true);
        return true;
      }

      // 3. Supabase profiles check
      if (user?.id) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (prof?.role === 'admin' || prof?.role === 'superadmin') {
            setHasAccess(true);
            setAccessChecked(true);
            return true;
          }
        } catch { /* silent */ }
      }

      // 4. Backend API check (real ground truth)
      try {
        const raw = localStorage.getItem('newscraft-auth');
        const token = raw ? JSON.parse(raw)?.state?.token : null;
        if (token) {
          const res = await fetch(
            'https://spotnewsv2.onrender.com/api/v1/admin/stats',
            { headers: { Authorization: 'Bearer ' + token } }
          );
          if (res.status === 200) {
            setHasAccess(true);
            setAccessChecked(true);
            return true;
          }
        }
      } catch { /* silent */ }

      setHasAccess(false);
      setAccessChecked(true);
      return false;
    };

    if (user) {
      checkAccess();
      return;
    }

    const timer = setTimeout(() => {
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      checkAccess();
    }, 300);

    return () => clearTimeout(timer);
  }, [user, navigate]);

  // ── Theme State ───────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('spotnews_admin_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('spotnews_admin_theme', next ? 'dark' : 'light');
      } catch { /* silent */ }
      return next;
    });
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = isSuperAdminUser(user);
  const [activeTab, setActiveTab] = useState<'overview' | 'clippings' | 'users' | 'logos' | 'applications' | 'daily_editions' | 'notifications' | 'local_ads' | 'redemptions'>('overview');
  const [isPdfGeneratorOpen, setIsPdfGeneratorOpen] = useState(false);
  const [dailyEditions, setDailyEditions] = useState<DailyEditionRecord[]>([]);
  const [dailyEditionsLoading, setDailyEditionsLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserProfile[]>(() => getCachedAdminUsers());
  const [usersError, setUsersError] = useState<string | null>(null);
  const [logos, setLogos] = useState<PublicationLogo[]>([]);
  const [isAddLogoOpen, setIsAddLogoOpen] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<PublicationLogo | null>(null);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoCode, setNewLogoCode] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [loading, setLoading] = useState(() => getCachedAdminUsers().length === 0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Push Notification broadcast state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifSending, setNotifSending] = useState(false);

  // Date filtering state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');

  // Clippings state
  const [clippings, setClippings] = useState<AdminClippingLog[]>([]);
  const [clippingsLoading, setClippingsLoading] = useState(false);
  const [clippingsTotal, setClippingsTotal] = useState(0);
  const [selectedClippingModal, setSelectedClippingModal] = useState<AdminClippingLog | null>(null);

  // District Admin & Approval Filtering State
  const [currentAdminDistrict, setCurrentAdminDistrict] = useState<string>('');

  // Fetch logged in admin's assigned district
  useEffect(() => {
    const fetchAdminDistrict = async () => {
      if (!user?.id) return;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, district')
          .eq('id', user.id)
          .maybeSingle();

        if (prof?.role === 'admin' && !isSuperAdmin) {
          const d = prof.district || '';
          if (d) {
            setCurrentAdminDistrict(d);
          }
        }
      } catch (err) {
        console.warn('Could not fetch admin district:', err);
      }
    };
    fetchAdminDistrict();
  }, [user?.id, isSuperAdmin]);

  // Applications state
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [applicationFilter, setApplicationFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  // Handle adding a new logo
  const handleAddLogoSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newLogoName.trim()) {
      setLogoError('Please enter publication name');
      return;
    }
    const cleanCode = (newLogoCode.trim() || newLogoName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    if (!cleanCode) {
      setLogoError('Please enter publication code');
      return;
    }
    if (!newLogoUrl.trim()) {
      setLogoError('Please upload an image or provide an image URL');
      return;
    }

    setLogoSaving(true);
    setLogoError('');
    try {
      const res = await addPublicationLogo(newLogoName.trim(), newLogoUrl.trim(), cleanCode);
      if (res.success) {
        showToast(`Logo "${newLogoName}" added successfully`, 'success');
        const updated = await getPublicationLogos();
        setLogos(updated);
        setNewLogoName('');
        setNewLogoCode('');
        setNewLogoUrl('');
        setIsAddLogoOpen(false);
      } else {
        setLogoError(res.error || 'Failed to add logo');
      }
    } catch (err: any) {
      setLogoError(err?.message || 'Error saving logo');
    } finally {
      setLogoSaving(false);
    }
  };

  // Handle logo image upload from device
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setLogoError('');
    try {
      const res = await uploadLogoImage(file);
      if (res.url) {
        setNewLogoUrl(res.url);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setNewLogoUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setNewLogoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setLogoUploading(false);
    }
  };

  // Handle deleting a logo
  const handleDeleteLogo = async (logo: PublicationLogo) => {
    if (!window.confirm(`Are you sure you want to delete "${logo.name}"?`)) return;
    try {
      await removePublicationLogo(logo.id);
      setLogos((prev) => prev.filter((l) => l.id !== logo.id && l.publication_code !== logo.publication_code));
      showToast(`Logo "${logo.name}" deleted`, 'success');
    } catch {
      showToast('Failed to delete logo', 'error');
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (fDate?: string, tDate?: string) => {
    // Only show full skeleton loader if we don't already have users loaded
    if (users.length === 0) {
      setLoading(true);
    }
    setUsersError(null);
    try {
      const [statsResult, usersResult, logosResult] = await Promise.allSettled([
        getAdminStats(fDate, tDate),
        getAdminUsers(),
        getPublicationLogos(),
      ]);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (logosResult.status === 'fulfilled') setLogos(logosResult.value);
      if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value) && usersResult.value.length > 0) {
        setUsers(usersResult.value);
        setStats(current => current ? { ...current, totalUsers: usersResult.value.length } : current);
      } else if (usersResult.status === 'rejected') {
        const cached = getCachedAdminUsers();
        if (cached.length > 0) {
          setUsers(cached);
        }
        const status = usersResult.reason?.response?.status;
        setUsersError(status === 401
          ? 'Your session has expired. Please sign out and sign in again to load admin users.'
          : status === 403
            ? 'This account does not have permission to load the admin user list.'
            : 'The complete user list could not be loaded. Please retry when the server is available.');
      }
    } catch {
      showToast('Error loading admin dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [users.length]);

  const fetchClippings = useCallback(async (fDate?: string, tDate?: string) => {
    setClippingsLoading(true);
    try {
      const res = await getAdminClippings({ fromDate: fDate, toDate: tDate, page: 1, pageSize: 60 });
      setClippings(res.results);
      setClippingsTotal(res.total);
    } catch {
      showToast('Failed to load clippings history', 'error');
    } finally {
      setClippingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchAll(fromDate || undefined, toDate || undefined);
      fetchClippings(fromDate || undefined, toDate || undefined);
    }
  }, [hasAccess, fetchAll, fetchClippings, fromDate, toDate]);

  const fetchDailyEditions = useCallback(async () => {
    setDailyEditionsLoading(true);
    try {
      const editions = await dailyNewspaperService.getDailyEditions();
      setDailyEditions(editions);
    } catch {
      showToast('Failed to load daily newspaper editions', 'error');
    } finally {
      setDailyEditionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && activeTab === 'daily_editions' && isSuperAdmin) {
      fetchDailyEditions();
    }
  }, [hasAccess, activeTab, isSuperAdmin, fetchDailyEditions]);

  const fetchApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reporter_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApplications(data || []);
    } catch {
      showToast('Failed to load reporter applications', 'error');
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && isSuperAdmin && (activeTab === 'applications' || applications.length === 0)) {
      fetchApplications();
    }
  }, [hasAccess, isSuperAdmin, activeTab, fetchApplications]);

  const handleApplicationStatus = async (
    appId: string,
    email: string,
    status: 'approved' | 'rejected',
    phone?: string,
    name?: string
  ) => {
    setActionLoadingId(appId);
    try {
      const finalStatus = status === 'approved' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('reporter_applications')
        .update({ 
          status: finalStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', appId);
      if (error) throw error;
      
      const app = applications.find(a => a.id === appId);
      const targetEmail = (email || app?.email || '').trim().toLowerCase();
      if (targetEmail && (app?.state || app?.district)) {
        await supabase
          .from('profiles')
          .update({
            ...(app?.state ? { state: app.state } : {}),
            ...(app?.district ? { district: app.district } : {})
          })
          .eq('email', targetEmail);
      }

      // Send real-time push notification & create in-app notification for the user if approved
      if (status === 'approved') {
        try {
          const cleanEmail = (email || app?.email || '').trim().toLowerCase();
          const cleanPhone = (phone || app?.phone || '').trim();

          // 1. Resolve user_id from app or profiles table (checking both email and phone)
          let targetUserId = app?.user_id || null;
          if (!targetUserId && cleanEmail) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .ilike('email', cleanEmail)
                .maybeSingle();
              if (profile?.id) {
                targetUserId = profile.id;
              }
            } catch (pErr) {
              console.warn('Could not resolve user_id by email:', pErr);
            }
          }

          if (!targetUserId && cleanPhone) {
            try {
              const digits = cleanPhone.replace(/\D/g, '').slice(-10);
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .ilike('phone', `%${digits}%`)
                .maybeSingle();
              if (profile?.id) {
                targetUserId = profile.id;
              }
            } catch (pErr) {
              console.warn('Could not resolve user_id by phone:', pErr);
            }
          }

          // 2. Fetch specific device token(s) directly from Supabase device_tokens table
          let directDeviceTokens: string[] = [];
          if (targetUserId) {
            try {
              const { data: dtRows } = await supabase
                .from('device_tokens')
                .select('token')
                .eq('user_id', targetUserId);
              if (dtRows && dtRows.length > 0) {
                directDeviceTokens = dtRows.map(r => r.token).filter(Boolean);
              }
            } catch (dtErr) {
              console.warn('Could not fetch device tokens:', dtErr);
            }
          }

          // 3. Insert in-app notification row specifically for this user
          try {
            await supabase.from('notifications').insert([
              {
                user_id: targetUserId || null,
                user_email: cleanEmail || null,
                title: '🎉 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది!',
                message: 'అభినందనలు! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది. మీ ఉచిత ID కార్డును సెట్ చేసుకుని లాగిన్ పూర్తి చేయండి.',
                notification_type: 'reporter_approval',
                is_read: false
              }
            ]);
          } catch (notifDbErr) {
            console.warn('Failed to insert in-app notification:', notifDbErr);
          }

          // 4. Dispatch native push notification to THAT USER ONLY (not broadcast)
          const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com';
          const reporterName = (name || app?.name || app?.full_name || '').trim();
          const notifPayload = {
            user_id: targetUserId || undefined,
            email: cleanEmail || undefined,
            phone: cleanPhone || undefined,
            title: '🎉 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది!',
            body: reporterName
              ? `అభినందనలు ${reporterName}! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది. మీ ఉచిత ప్రెస్ ID కార్డును సెట్ చేసుకోండి.`
              : 'అభినందనలు! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది. మీ ఉచిత ప్రెస్ ID కార్డును సెట్ చేసుకోండి.',
            image_url: 'https://rffrqokpnqoycpozrjuc.supabase.co/storage/v1/object/public/newscraft-clippings/assets/app_logo.png',
            url: '/reporter/payment',
            channel_id: 'reporter',
          };

          if (directDeviceTokens.length > 0) {
            for (const t of directDeviceTokens) {
              await fetch(`${apiUrl}/api/v1/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...notifPayload, token: t }),
              }).catch((err) => console.warn('Direct token push error:', err));
            }
          } else {
            await fetch(`${apiUrl}/api/v1/notifications/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notifPayload),
            }).catch((err) => console.warn('Approval push error:', err));
          }
        } catch (e) {
          console.warn('Failed to trigger approval push notification:', e);
        }
      }

      if (status === 'rejected') {
        const cleanEmail = (email || app?.email || '').trim().toLowerCase();
        if (cleanEmail) {
          try {
            await supabase
              .from('profiles')
              .update({ role: 'user' })
              .ilike('email', cleanEmail);
          } catch (rErr) {
            console.warn('Failed to demote role in profiles:', rErr);
          }
        }
      }

      showToast(status === 'approved' ? 'Application approved! Push notification sent to this user.' : 'Reporter revoked / rejected successfully.', 'success');
      await fetchApplications();
    } catch (err: any) {
      console.error('Error updating application status:', err);
      showToast(`Failed to update application status: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteApplication = async (appId: string, email?: string) => {
    if (!window.confirm('Are you sure you want to completely remove this reporter application? This action cannot be undone.')) {
      return;
    }
    setActionLoadingId(appId);
    try {
      const app = applications.find(a => a.id === appId);
      const targetEmail = (email || app?.email || '').trim().toLowerCase();

      const { error } = await supabase
        .from('reporter_applications')
        .delete()
        .eq('id', appId);
      if (error) throw error;

      if (targetEmail) {
        try {
          await supabase
            .from('profiles')
            .update({ role: 'user' })
            .ilike('email', targetEmail);
        } catch (rErr) {
          console.warn('Failed to reset role on delete:', rErr);
        }
      }

      showToast('Reporter application removed successfully.', 'success');
      await fetchApplications();
    } catch (err: any) {
      console.error('Error deleting application:', err);
      showToast(`Failed to delete application: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Date presets ──────────────────────────────────────────────────────────
  const handleDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setActiveDatePreset(preset);
    let f = '';
    let t = '';
    if (preset === 'today') {
      f = getTodayStr();
      t = getTodayStr();
    } else if (preset === 'yesterday') {
      f = getYesterdayStr();
      t = getYesterdayStr();
    } else if (preset === 'week') {
      f = getDaysAgoStr(7);
      t = getTodayStr();
    } else if (preset === 'month') {
      f = getDaysAgoStr(30);
      t = getTodayStr();
    }
    setFromDate(f);
    setToDate(t);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch { /* continue */ }
    logout();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('newscraft') || key.startsWith('spotnews'))) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch { /* continue */ }
    navigate('/welcome', { replace: true });
  };

  // Approval Handlers for District Admin / Superadmin
  const handleApproveClipping = async (clip: AdminClippingLog): Promise<boolean> => {
    try {
      const res = await approveClippingToFeed(clip.id, {
        headline: clip.headline,
        district: clip.district,
        user_id: clip.user_id,
        user_email: clip.user_email,
        png_url: clip.png_url,
      });
      if (res.success) {
        showToast('Clipping approved & published to live feed!', 'success');
        setClippings((prev) =>
          prev.map((c) => (c.id === clip.id ? { ...c, is_posted: true, status: 'approved' } : c))
        );
        if (selectedClippingModal?.id === clip.id) {
          setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: true, status: 'approved' } : null));
        }
        return true;
      } else {
        showToast(res.error || 'Failed to approve clipping', 'error');
        return false;
      }
    } catch {
      showToast('Error approving clipping', 'error');
      return false;
    }
  };

  const handleRejectClipping = async (
    clip: AdminClippingLog,
    reason: string,
    note?: string
  ): Promise<boolean> => {
    try {
      const fullReason = note ? `${reason}: ${note}` : reason;
      const res = await rejectClippingSubmission(clip.id, {
        headline: clip.headline,
        user_id: clip.user_id,
        user_email: clip.user_email,
        reason: fullReason || undefined,
      });
      if (res.success) {
        showToast('Clipping marked as rejected.', 'success');
        setClippings((prev) =>
          prev.map((c) => (c.id === clip.id ? { ...c, is_posted: false, status: 'rejected' } : c))
        );
        if (selectedClippingModal?.id === clip.id) {
          setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'rejected' } : null));
        }
        return true;
      } else {
        showToast(res.error || 'Failed to reject clipping', 'error');
        return false;
      }
    } catch {
      showToast('Error rejecting clipping', 'error');
      return false;
    }
  };

  const handleUndoApprove = async (clipId: string) => {
    try {
      const { error } = await supabase
        .from('clippings')
        .update({ status: 'pending_approval', is_posted: false })
        .eq('id', clipId);
      if (error) throw error;

      setClippings((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, is_posted: false, status: 'pending_approval' } : c))
      );
      if (selectedClippingModal?.id === clipId) {
        setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'pending_approval' } : null));
      }
      showToast('Approval undone. Clipping restored to pending queue.', 'success');
    } catch (e: any) {
      showToast('Failed to undo approval: ' + (e.message || ''), 'error');
    }
  };

  const handleRemoveFromFeed = async (clip: AdminClippingLog) => {
    await handleRejectClipping(clip, 'Removed from live feed by admin');
  };

  const handleRestoreClipping = async (clip: AdminClippingLog) => {
    try {
      const { error } = await supabase
        .from('clippings')
        .update({ status: 'pending_approval', is_posted: false })
        .eq('id', clip.id);
      if (error) throw error;

      setClippings((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, is_posted: false, status: 'pending_approval' } : c))
      );
      if (selectedClippingModal?.id === clip.id) {
        setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'pending_approval' } : null));
      }
      showToast('Clipping restored to pending review queue.', 'success');
    } catch (e: any) {
      showToast('Failed to restore clipping: ' + (e.message || ''), 'error');
    }
  };

  // User Actions
  const handleSaveUserEdit = async (
    u: AdminUserProfile,
    newRole: string,
    newPlan: string,
    newPhone: string,
    newDistrict: string
  ): Promise<boolean> => {
    if (isSuperAdminUser(u) && !isSuperAdmin) {
      showToast('Only a superadmin can modify a superadmin account.', 'error');
      return false;
    }
    if ((newRole === 'admin' || newRole === 'superadmin') && !isSuperAdmin) {
      showToast('Only superadmin can grant administrator roles.', 'error');
      return false;
    }

    let roleSuccess = true;
    let planSuccess = true;
    let errorMsg: string | undefined;

    const roleChanged = newRole !== u.role;
    const phoneChanged = newPhone.trim() !== (u.phone_number ?? '').trim();
    const districtChanged = newDistrict.trim() !== (u.district ?? '').trim();
    const planChanged = newPlan !== u.plan;

    if (roleChanged || phoneChanged || districtChanged || planChanged) {
      const r1 = await updateUserRole(
        u.id,
        newRole as any,
        newPhone.trim() || u.phone_number,
        newPlan,
        newDistrict.trim() || undefined
      );
      if (!r1.success) {
        roleSuccess = false;
        errorMsg = r1.error;
      }
    }
    if (planChanged && roleSuccess && newRole !== 'superadmin' && newRole !== 'admin') {
      const r2 = await updateUserPlan(u.id, newPlan);
      if (!r2.success) {
        planSuccess = false;
        errorMsg = errorMsg ?? r2.error;
      }
    }

    if (roleSuccess && planSuccess) {
      showToast(`Updated user permissions successfully`, 'success');
      fetchAll(fromDate || undefined, toDate || undefined);
      return true;
    } else {
      showToast(errorMsg ?? 'Failed to update user', 'error');
      return false;
    }
  };

  const handleBanToggle = async (u: AdminUserProfile): Promise<boolean> => {
    if (isSuperAdminUser(u)) {
      showToast('Superadmin cannot be blocked.', 'error');
      return false;
    }
    const duration = u.is_banned ? 'none' : '876600h';
    const res = await banUser(u.id, duration);
    if (res.success) {
      showToast(u.is_banned ? `Unblocked ${u.email || u.full_name}` : `Blocked ${u.email || u.full_name}`, 'success');
      fetchAll(fromDate || undefined, toDate || undefined);
      return true;
    } else {
      showToast(res.error ?? 'Action failed', 'error');
      return false;
    }
  };

  // Deep link from Users tab to Clippings tab
  const handleViewUserClippings = (_userIdentifier: string) => {
    setActiveTab('clippings');
  };

  // ── Access Denied / Loading State ─────────────────────────────────────────
  if (!accessChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eaf1fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-[#015bb3] border-t-transparent animate-spin" />
          <p className="text-[#0a2540] text-sm font-bold">Verifying Administrator Access…</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#eaf1fb]">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border border-[#d0e2f7] rounded-3xl p-8 text-center max-w-sm shadow-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
            <Shield className="w-8 h-8 text-[#d32f2f]" />
          </div>
          <h2 className="text-[#0a2540] text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-[#6b7a90] text-xs leading-relaxed mb-6">
            You do not have administrator privileges to view this control panel. If you believe this is an error, please contact support.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#015bb3] shadow-sm active:scale-95 transition-transform cursor-pointer"
          >
            Return to App
          </button>
        </motion.div>
      </div>
    );
  }

  // Pending count for tab badge
  const pendingCount = clippings.filter((c) => {
    if (currentAdminDistrict && !isSuperAdmin) {
      if ((c.district || '').toLowerCase() !== currentAdminDistrict.toLowerCase()) return false;
    }
    return c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected');
  }).length;

  const pendingApplicationsCount = applications.filter((a) => !a.status || a.status.toLowerCase() === 'pending').length;

  return (
    <AdminShell
      adminEmail={user?.email || 'admin@spotnews.in'}
      isSuperAdmin={isSuperAdmin}
      activeTab={activeTab}
      pendingClippingsCount={pendingCount}
      pendingApplicationsCount={pendingApplicationsCount}
      totalUsersCount={users.length}
      logosCount={logos.length}
      isDarkMode={isDarkMode}
      refreshing={loading}
      onNavigateApp={() => navigate('/')}
      onRefresh={() => {
        fetchAll(fromDate || undefined, toDate || undefined);
        fetchClippings(fromDate || undefined, toDate || undefined);
        if (isSuperAdmin) {
          fetchApplications();
        }
      }}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      onSelectTab={setActiveTab}
    >
      {/* User list error notification if server returned 401/403/500 */}
      {usersError && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
          <span>{usersError}</span>
          <button
            onClick={() => fetchAll(fromDate || undefined, toDate || undefined)}
            className="underline font-bold ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <AdminOverviewTab
          stats={stats}
          users={users}
          clippings={clippings}
          activeDatePreset={activeDatePreset}
          fromDate={fromDate}
          toDate={toDate}
          onSelectDatePreset={handleDatePreset}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onApplyCustomDate={() => fetchAll(fromDate, toDate)}
          onSwitchTab={(tab) => {
            setActiveTab(tab);
          }}
          onOpenBroadcastModal={() => {
            if (isSuperAdmin) {
              setActiveTab('notifications');
            } else {
              showToast('Broadcast notifications are managed by Superadmin.', 'error');
            }
          }}
        />
      )}

      {/* ── Clippings Tab ── */}
      {activeTab === 'clippings' && (
        <AdminClippingsTab
          clippings={clippings}
          loading={clippingsLoading}
          totalCount={clippingsTotal}
          currentAdminDistrict={currentAdminDistrict}
          isSuperAdmin={isSuperAdmin}
          onRefresh={() => fetchClippings(fromDate || undefined, toDate || undefined)}
          onApprove={handleApproveClipping}
          onReject={handleRejectClipping}
          onUndoApprove={handleUndoApprove}
          onRemoveFromFeed={handleRemoveFromFeed}
          onRestore={handleRestoreClipping}
          onSelectClippingModal={setSelectedClippingModal}
        />
      )}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (
        <AdminUsersTab
          users={users}
          loading={loading}
          currentUserEmail={user?.email}
          isSuperAdmin={isSuperAdmin}
          onRefresh={() => fetchAll(fromDate || undefined, toDate || undefined)}
          onSaveUserEdit={handleSaveUserEdit}
          onToggleBan={handleBanToggle}
          onViewUserClippings={handleViewUserClippings}
        />
      )}

      {/* ── Superadmin: Daily Editions ── */}
      {activeTab === 'daily_editions' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="adm-card p-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[var(--adm-text-primary)]">Daily Newspaper Editions</h3>
              <p className="text-xs text-[var(--adm-text-muted)] mt-0.5">Archive of generated PDF editions for print and digital distribution</p>
            </div>
            <button
              onClick={() => setIsPdfGeneratorOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ffb900] text-[#0a2540] flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generate News PDF</span>
            </button>
          </div>
          {dailyEditionsLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--adm-blue)] border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs text-[var(--adm-text-muted)]">Loading editions…</p>
            </div>
          ) : dailyEditions.length === 0 ? (
            <div className="adm-card p-10 text-center">
              <FileText className="w-12 h-12 text-[var(--adm-text-muted)] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-[var(--adm-text-primary)]">No editions generated yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyEditions.map((ed) => (
                <div key={ed.id} className="adm-card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--adm-text-primary)]">{ed.publication_name || 'Spot News Edition'}</h4>
                      <p className="text-xs text-[var(--adm-text-muted)]">{ed.edition_date}</p>
                    </div>
                    {ed.pdf_url && (
                      <a href={ed.pdf_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl bg-[var(--adm-blue)] text-white text-xs font-bold flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Superadmin: Publication Logos ── */}
      {activeTab === 'logos' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="adm-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[var(--adm-text-primary)]">Brand Publication Logos</h3>
              <p className="text-xs text-[var(--adm-text-muted)] mt-0.5">Manage masthead logos available to reporters during news generation</p>
            </div>
            <button
              onClick={() => {
                setNewLogoName('');
                setNewLogoCode('');
                setNewLogoUrl('');
                setLogoError('');
                setIsAddLogoOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#015BB3] hover:bg-[#0d4a8f] text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Logo</span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="adm-card p-4 flex items-center justify-between gap-4 rounded-2xl bg-white border border-[#E2EDF8] shadow-sm"
              >
                {/* Left: Logo image + info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-[#F0F6FC] border border-[#D0E2F7] p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={logo.logo_url}
                      alt={logo.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-[#0F172A] truncate m-0">
                      {logo.name}
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5 m-0">
                      Code: {logo.publication_code ? <code>{logo.publication_code}</code> : ''}
                    </p>
                    <span className="inline-block mt-1 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                </div>

                {/* Right: Action Buttons (Eye to preview, Trash to delete) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewLogo(logo)}
                    className="w-9 h-9 rounded-xl bg-[#E0F2FE] text-[#0284C7] hover:bg-[#BAE6FD] flex items-center justify-center cursor-pointer transition active:scale-95 border-0 shadow-2xs"
                    title="Preview logo"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLogo(logo)}
                    className="w-9 h-9 rounded-xl bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] flex items-center justify-center cursor-pointer transition active:scale-95 border-0 shadow-2xs"
                    title="Delete logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Superadmin: Applications ── */}
      {activeTab === 'applications' && isSuperAdmin && (() => {
        const pendingCount = applications.filter((a) => !a.status || a.status.toLowerCase() === 'pending').length;
        const approvedCount = applications.filter((a) => a.status?.toLowerCase() === 'approved' || a.status?.toLowerCase() === 'active').length;
        const rejectedCount = applications.filter((a) => a.status?.toLowerCase() === 'rejected').length;

        const filteredApplications = applications.filter((app) => {
          if (applicationFilter === 'all') return true;
          if (applicationFilter === 'pending') return !app.status || app.status.toLowerCase() === 'pending';
          if (applicationFilter === 'approved') return app.status?.toLowerCase() === 'approved' || app.status?.toLowerCase() === 'active';
          if (applicationFilter === 'rejected') return app.status?.toLowerCase() === 'rejected';
          return true;
        });

        return (
          <div className="space-y-4">
            {/* Header card with counts & filter chips */}
            <div className="adm-card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--adm-text-primary)]">Reporter Registration Requests</h3>
                  <p className="text-xs text-[var(--adm-text-muted)] mt-0.5">
                    Review and accept or reject new reporter applications. Accepted reporters can proceed to payment.
                  </p>
                </div>
                <button
                  onClick={() => fetchApplications()}
                  disabled={applicationsLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--adm-blue)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto hover:opacity-90 active:scale-95 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${applicationsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Segmented Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                <button
                  onClick={() => setApplicationFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    applicationFilter === 'all'
                      ? 'bg-[var(--adm-blue)] text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                  }`}
                >
                  All ({applications.length})
                </button>
                <button
                  onClick={() => setApplicationFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    applicationFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                  }`}
                >
                  <span>Pending</span>
                  {pendingCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      applicationFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setApplicationFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    applicationFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                  }`}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => setApplicationFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    applicationFilter === 'rejected'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                  }`}
                >
                  Rejected ({rejectedCount})
                </button>
              </div>
            </div>

            {/* Applications List */}
            {applicationsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--adm-blue)] border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-xs text-[var(--adm-text-muted)]">Loading applications…</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="adm-card p-10 text-center">
                <FileText className="w-12 h-12 text-[var(--adm-text-muted)] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-[var(--adm-text-primary)]">
                  {applicationFilter === 'pending'
                    ? 'No pending applications'
                    : applicationFilter === 'approved'
                    ? 'No approved applications'
                    : applicationFilter === 'rejected'
                    ? 'No rejected applications'
                    : 'No applications found'}
                </p>
                <p className="text-xs text-[var(--adm-text-muted)] mt-1">
                  {applicationFilter !== 'all'
                    ? 'Try selecting a different filter status above.'
                    : 'Reporter applications submitted via signup will appear here.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredApplications.map((app) => {
                  const statusLower = (app.status || 'pending').toLowerCase();
                  const isPending = statusLower === 'pending';
                  const isApproved = statusLower === 'approved';
                  const isActive = statusLower === 'active';
                  const isRejected = statusLower === 'rejected';
                  const isActionLoading = actionLoadingId === app.id;

                  return (
                    <div
                      key={app.id}
                      className={`adm-card p-5 space-y-3.5 flex flex-col justify-between transition-all ${
                        isPending
                          ? 'adm-border-left-orange'
                          : isApproved || isActive
                          ? 'adm-border-left-green'
                          : 'adm-border-left-red'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* District Badge & Status Pill */}
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-[var(--adm-blue)] bg-[#e0f2fe] dark:bg-[#1a3353] dark:text-[#60a5fa] px-2.5 py-0.5 rounded-full tracking-wide">
                            {app.district || 'Telangana'} {app.state ? `• ${app.state}` : ''}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60'
                                : isApproved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60'
                                : isActive
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/60'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300/60'
                            }`}
                          >
                            {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            {isApproved && <Check className="w-3 h-3" />}
                            {isRejected && <X className="w-3 h-3" />}
                            {isActive && <Shield className="w-3 h-3" />}
                            <span>{app.status || 'Pending'}</span>
                          </span>
                        </div>

                        {/* Name & Contact */}
                        <div>
                          <h4 className="text-base font-bold text-[var(--adm-text-primary)]">{app.name}</h4>
                          <p className="text-xs text-[var(--adm-text-muted)] mt-0.5">
                            <span className="text-[var(--adm-blue)] font-semibold">{app.email}</span>
                            {app.phone ? (
                              <span> · Mobile: <strong className="text-[var(--adm-text-primary)] font-semibold">{app.phone}</strong></span>
                            ) : ''}
                          </p>
                        </div>

                        {/* Credentials / Government ID Box */}
                        <div className="bg-[var(--adm-chip-bg)]/60 border border-[var(--adm-card-border)] rounded-xl p-3 space-y-1.5 text-xs text-[var(--adm-text-secondary)]">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--adm-text-muted)] block">Aadhar Card</span>
                              <span className="font-semibold text-[var(--adm-text-primary)] font-mono">{app.aadhar_card || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--adm-text-muted)] block">Press ID</span>
                              <span className="font-semibold text-[var(--adm-text-primary)] font-mono">{app.press_id || '—'}</span>
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-[var(--adm-card-border)]/60 text-[11px] text-[var(--adm-text-muted)] flex items-center justify-between">
                            <span>Submitted: {formatDateTime(app.created_at)}</span>
                            {app.updated_at && app.updated_at !== app.created_at && (
                              <span>Updated: {formatDateTime(app.updated_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Accept / Reject */}
                      <div className="pt-2 border-t border-[var(--adm-card-border)]">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApplicationStatus(app.id, app.email, 'approved', app.phone, app.name)}
                              disabled={isActionLoading}
                              className="flex-1 py-2 px-3 bg-[#059669] hover:bg-[#047857] active:scale-[0.98] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                              title="Accept application and trigger SMS for this reporter"
                            >
                              {isActionLoading ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span>Accept & Approve</span>
                            </button>
                            <button
                              onClick={() => handleApplicationStatus(app.id, app.email, 'rejected', app.phone, app.name)}
                              disabled={isActionLoading}
                              className="py-2 px-3.5 bg-transparent border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title="Reject application"
                            >
                              <X className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                            <button
                              onClick={() => handleDeleteApplication(app.id, app.email)}
                              disabled={isActionLoading}
                              className="p-2 bg-transparent border border-gray-300 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-300 rounded-xl transition cursor-pointer disabled:opacity-50"
                              title="Delete application"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : isApproved ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Approved · ID Card Setup Pending
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApplicationStatus(app.id, app.email, 'rejected', app.phone, app.name)}
                                  disabled={isActionLoading}
                                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer disabled:opacity-50"
                                  title="Revoke approval"
                                >
                                  Revoke
                                </button>
                                <span className="text-[var(--adm-text-muted)]">·</span>
                                <button
                                  onClick={() => handleDeleteApplication(app.id, app.email)}
                                  disabled={isActionLoading}
                                  className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-bold cursor-pointer disabled:opacity-50 flex items-center gap-0.5"
                                  title="Permanently remove application"
                                >
                                  <Trash2 className="w-3 h-3" /> Remove
                                </button>
                              </div>
                            </div>
                            {app.phone && (
                              <div className="flex items-center gap-2 pt-1">
                                <a
                                  href={`sms:${app.phone}?body=${encodeURIComponent(
                                    `Spot News 24x7: Congratulations ${app.name || ''}! Your reporter application is APPROVED. Please open the app to set up your ID Card: https://spotnews24x7.com`
                                  )}`}
                                  className="flex-1 py-1.5 px-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] font-bold text-center hover:bg-blue-100 transition flex items-center justify-center gap-1"
                                >
                                  💬 Send SMS
                                </a>
                                <a
                                  href={`https://wa.me/91${app.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                                    `Spot News 24x7: Congratulations ${app.name || ''}! Your reporter application is APPROVED. Please open the Spot News app to set up your ID Card and complete login.`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 py-1.5 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-bold text-center hover:bg-emerald-100 transition flex items-center justify-center gap-1"
                                >
                                  📲 WhatsApp
                                </a>
                              </div>
                            )}
                          </div>
                        ) : isRejected ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Application Rejected
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApplicationStatus(app.id, app.email, 'approved', app.phone, app.name)}
                                disabled={isActionLoading}
                                className="text-[11px] text-[var(--adm-blue)] font-bold hover:underline cursor-pointer disabled:opacity-50"
                              >
                                Re-approve
                              </button>
                              <span className="text-[var(--adm-text-muted)]">·</span>
                              <button
                                onClick={() => handleDeleteApplication(app.id, app.email)}
                                disabled={isActionLoading}
                                className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-bold cursor-pointer disabled:opacity-50 flex items-center gap-0.5"
                                title="Permanently remove application"
                              >
                                <Trash2 className="w-3 h-3" /> Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1">
                                <Shield className="w-3.5 h-3.5" /> Activated Reporter
                              </span>
                              {app.reporter_id && (
                                <span className="text-[11px] text-[var(--adm-text-muted)] font-mono font-bold">
                                  ID: {app.reporter_id}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--adm-card-border)]/60">
                              <button
                                onClick={() => handleApplicationStatus(app.id, app.email, 'rejected', app.phone, app.name)}
                                disabled={isActionLoading}
                                className="flex-1 py-1.5 px-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Revoke reporter permissions and demote role back to normal user"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Revoke Reporter</span>
                              </button>
                              <button
                                onClick={() => handleDeleteApplication(app.id, app.email)}
                                disabled={isActionLoading}
                                className="py-1.5 px-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Completely remove / delete this reporter application"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                            {app.phone && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <a
                                  href={`sms:${app.phone}?body=${encodeURIComponent(
                                    `Spot News 24x7: Hello ${app.full_name || ''}, your reporter status update.`
                                  )}`}
                                  className="flex-1 py-1 px-2 bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] border border-[var(--adm-card-border)] rounded-md text-[11px] font-semibold text-center hover:bg-[var(--adm-card-border)] transition flex items-center justify-center gap-1"
                                >
                                  💬 SMS
                                </a>
                                <a
                                  href={`https://wa.me/91${app.phone.replace(/\D/g, '').slice(-10)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 py-1 px-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md text-[11px] font-semibold text-center hover:bg-emerald-100 transition flex items-center justify-center gap-1"
                                >
                                  📲 WhatsApp
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Superadmin: Notifications Broadcast ── */}
      {activeTab === 'notifications' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="adm-card p-5">
            <h3 className="text-base font-bold text-[var(--adm-text-primary)] mb-1">Push Broadcast Notifications</h3>
            <p className="text-xs text-[var(--adm-text-muted)] mb-4">Send instant push notifications to active subscribers</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!notifTitle.trim() || !notifBody.trim()) {
                  showToast('Title and Message are required', 'error');
                  return;
                }
                setNotifSending(true);
                try {
                  const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com';
                  const res = await fetch(`${apiUrl}/api/v1/notifications/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: notifTitle.trim(),
                      body: notifBody.trim(),
                      topic: 'all',
                    }),
                  });
                  if (res.ok) {
                    showToast('Notification broadcast sent successfully!', 'success');
                    setNotifTitle('');
                    setNotifBody('');
                  } else {
                    showToast('Failed to dispatch notification', 'error');
                  }
                } catch {
                  showToast('Error broadcasting notification', 'error');
                } finally {
                  setNotifSending(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">Notification Title</label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. Breaking News Alert"
                  className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--adm-text-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">Notification Body</label>
                <textarea
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  placeholder="Enter message text..."
                  rows={3}
                  className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl p-3 text-xs font-medium text-[var(--adm-text-primary)]"
                />
              </div>
              <button
                type="submit"
                disabled={notifSending}
                className="px-5 py-2.5 rounded-xl bg-[var(--adm-blue)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                {notifSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Broadcast Push</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Superadmin: Local Ads ── */}
      {activeTab === 'local_ads' && (
        <LocalAdsAdminSection />
      )}

      {/* ── Superadmin: Coin Redemptions & Payouts ── */}
      {activeTab === 'redemptions' && (
        <AdminRedemptionsTab showToast={showToast} />
      )}

      {/* ── Selected Clipping Detail Modal ── */}
      <AnimatePresence>
        {selectedClippingModal && (
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setSelectedClippingModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--adm-card-bg)] border border-[var(--adm-card-border)] rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--adm-card-border)] pb-3">
                <div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#dee9f5] text-[var(--adm-blue)] uppercase">
                    {selectedClippingModal.publication_name || 'Spot News 24x7'}
                  </span>
                  <h3 className="adm-telugu text-base font-bold text-[var(--adm-text-primary)] mt-1.5 leading-snug">
                    {selectedClippingModal.headline}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedClippingModal(null)}
                  className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text-primary)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedClippingModal.png_url ? (
                <div className="rounded-2xl overflow-hidden border border-[var(--adm-card-border)] bg-[var(--adm-chip-bg)] max-h-80 flex items-center justify-center">
                  <img
                    src={selectedClippingModal.png_url}
                    alt="Clipping"
                    className="w-full h-auto max-h-80 object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-[var(--adm-chip-bg)] text-center text-xs text-[var(--adm-text-muted)]">
                  No preview artwork available for this item.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-[var(--adm-chip-bg)]">
                  <p className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold">Author</p>
                  <p className="font-bold text-[var(--adm-text-primary)] truncate">
                    {selectedClippingModal.user_name} ({selectedClippingModal.user_email})
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--adm-chip-bg)]">
                  <p className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold">District</p>
                  <p className="font-bold text-[var(--adm-text-primary)]">{selectedClippingModal.district || 'Telangana'}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--adm-chip-bg)]">
                  <p className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold">Generated</p>
                  <p className="font-bold text-[var(--adm-text-primary)]">{formatDateTime(selectedClippingModal.created_at)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--adm-chip-bg)]">
                  <p className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold">Status</p>
                  <p className="font-bold text-[var(--adm-text-primary)] capitalize">
                    {selectedClippingModal.is_posted
                      ? 'Live on Feed'
                      : selectedClippingModal.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending District Review'}
                  </p>
                </div>
              </div>

              {/* Approval & Moderation Actions inside Modal */}
              {(!selectedClippingModal.is_posted || selectedClippingModal.status === 'pending_approval') && (
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--adm-card-border)]">
                  <button
                    onClick={async () => {
                      await handleApproveClipping(selectedClippingModal);
                    }}
                    className="flex-1 py-2.5 px-3 bg-[var(--adm-green)] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Post to Feed</span>
                  </button>
                  <button
                    onClick={async () => {
                      await handleRejectClipping(selectedClippingModal, 'Rejected by admin');
                    }}
                    className="py-2.5 px-4 bg-white dark:bg-[#132742] border border-[var(--adm-card-border)] text-[var(--adm-red)] hover:bg-red-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}

              {selectedClippingModal.is_posted && (
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--adm-card-border)]">
                  <button
                    onClick={async () => {
                      await handleUndoApprove(selectedClippingModal.id);
                    }}
                    className="flex-1 py-2.5 px-3 bg-[var(--adm-chip-bg)] text-[var(--adm-blue)] text-xs font-bold rounded-xl hover:bg-[#d5e4f5] transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Undo Approval (Move to Pending)</span>
                  </button>
                  <button
                    onClick={async () => {
                      await handleRemoveFromFeed(selectedClippingModal);
                    }}
                    className="py-2.5 px-3.5 bg-white dark:bg-[#132742] border border-[var(--adm-card-border)] text-[var(--adm-red)] hover:bg-red-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>Remove from Live Feed</span>
                  </button>
                </div>
              )}

              {selectedClippingModal.status === 'rejected' && (
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--adm-card-border)]">
                  <button
                    onClick={async () => {
                      await handleRestoreClipping(selectedClippingModal);
                    }}
                    className="flex-1 py-2.5 px-3 bg-[var(--adm-chip-bg)] text-[var(--adm-blue)] text-xs font-bold rounded-xl hover:bg-[#d5e4f5] transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore to Pending Queue</span>
                  </button>
                  <button
                    onClick={async () => {
                      await handleApproveClipping(selectedClippingModal);
                    }}
                    className="flex-1 py-2.5 px-4 bg-[var(--adm-green)] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Post to Feed</span>
                  </button>
                </div>
              )}

              {/* External Links Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--adm-card-border)]">
                {selectedClippingModal.png_url && (
                  <a
                    href={selectedClippingModal.png_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--adm-chip-bg)] text-[var(--adm-blue)] border border-[var(--adm-card-border)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Full Image</span>
                  </a>
                )}
                {selectedClippingModal.pdf_url && (
                  <a
                    href={selectedClippingModal.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--adm-blue)] text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open PDF</span>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Add Brand Publication Logo ── */}
      {isAddLogoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setIsAddLogoOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#0F172A] m-0">Add Brand Publication Logo</h3>
              <button
                type="button"
                onClick={() => setIsAddLogoOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLogoSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Publication Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Extra News, National News"
                  value={newLogoName}
                  onChange={(e) => {
                    setNewLogoName(e.target.value);
                    if (!newLogoCode) {
                      setNewLogoCode(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#015BB3] focus:bg-white box-border"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Publication Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. the_extra_news"
                  value={newLogoCode}
                  onChange={(e) => setNewLogoCode(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-gray-900 outline-none focus:border-[#015BB3] focus:bg-white box-border"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Logo Image *
                </label>

                {/* Upload from device button */}
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex-1 py-2.5 px-3 rounded-xl bg-[#EAF2FB] hover:bg-[#D9E9FA] text-[#015BB3] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-[#BFDBFE] transition active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>{logoUploading ? 'Uploading Image...' : 'Choose Image from Device'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                      disabled={logoUploading}
                    />
                  </label>
                </div>

                {/* Or paste URL */}
                <input
                  type="url"
                  placeholder="Or enter image URL (https://...)"
                  value={newLogoUrl}
                  onChange={(e) => setNewLogoUrl(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 outline-none focus:border-[#015BB3] focus:bg-white box-border"
                />
              </div>

              {/* Logo Preview */}
              {newLogoUrl && (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white border border-[#CBD5E1] p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                    <img src={newLogoUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Live Preview</span>
                    <span className="text-xs font-bold text-gray-900 truncate block">{newLogoName || 'New Publication'}</span>
                    <span className="text-[10px] font-mono text-gray-500 truncate block">Code: {newLogoCode || 'code'}</span>
                  </div>
                </div>
              )}

              {logoError && (
                <p className="text-xs text-red-600 font-semibold m-0">{logoError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLogoOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logoSaving || logoUploading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#015BB3] hover:bg-[#0d4a8f] text-white transition active:scale-95 cursor-pointer border-0 shadow-sm disabled:opacity-50"
                >
                  {logoSaving ? 'Adding...' : 'Add Logo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Preview Logo ── */}
      {previewLogo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setPreviewLogo(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#0F172A] m-0">{previewLogo.name}</h3>
              <button
                type="button"
                onClick={() => setPreviewLogo(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full h-40 bg-[#F0F6FC] rounded-2xl border border-[#D0E2F7] p-4 flex items-center justify-center overflow-hidden">
              <img
                src={previewLogo.logo_url}
                alt={previewLogo.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="text-left bg-gray-50 rounded-xl p-3 text-xs space-y-1">
              <p className="m-0 text-gray-600">Publication Code: <code className="font-bold text-gray-900">{previewLogo.publication_code}</code></p>
              <p className="m-0 text-gray-600">Status: <span className="font-bold text-emerald-600">Active</span></p>
            </div>

            <button
              type="button"
              onClick={() => setPreviewLogo(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#015BB3] text-white cursor-pointer border-0 shadow-sm active:scale-95 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Daily Newspaper Generator Modal ── */}
      <DailyNewspaperGeneratorModal
        isOpen={isPdfGeneratorOpen}
        onClose={() => setIsPdfGeneratorOpen(false)}
        onSuccess={fetchDailyEditions}
      />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </AdminShell>
  );
};
