import { useState, useEffect, useCallback, useRef } from 'react';
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
  EyeOff,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { useAuthStore, isAdminUser, isSuperAdminUser, isProtectedSuperAdminAccount } from '@/store';
import { supabase, publicClient, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { LocalAdsAdminSection } from '@/components/LocalAdsAdminSection';
import {
  getAdminStats,
  getAdminUsers,
  getCachedAdminUsers,
  getPublicationLogos,
  DEFAULT_PUBLICATION_LOGOS,
  addPublicationLogo,
  removePublicationLogo,
  toggleLogoActive,
  uploadLogoImage,
  updateUserRole,
  updateUserPlan,
  banUser,
  deleteUser,
  getAdminClippings,
  approveClippingToFeed,
  bulkApproveClippingsToFeed,
  bulkRejectClippingsToFeed,
  bulkDeleteClippings,
  deleteClipping,
  rejectClippingSubmission,
  updateReporterApplicationStatus,
  getAutoApproveConfig,
  setAutoApproveConfig,
  getAutoApproveReportersConfig,
  setAutoApproveReportersConfig,
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
import { AdminPayoutsTab } from './admin/AdminPayoutsTab';

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
            .select('role, plan, district, state')
            .eq('id', user.id)
            .maybeSingle();
          if (prof?.role === 'admin' || prof?.role === 'superadmin') {
            useAuthStore.getState().updateUser({ role: prof.role, plan: prof.plan, district: prof.district } as any);
            if (prof.district) {
              useAuthStore.getState().setDistrict(prof.district);
            }
            if (prof.state) {
              useAuthStore.getState().setUserState(prof.state);
            }
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
            'https://spotnewsv2-ew09.onrender.com/api/v1/admin/stats',
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
  const isSuperAdmin =
    isSuperAdminUser(user) ||
    user?.role === 'superadmin' ||
    user?.plan === 'superadmin' ||
    (user as any)?.user_metadata?.role === 'superadmin' ||
    (user as any)?.app_metadata?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<'overview' | 'clippings' | 'users' | 'logos' | 'applications' | 'daily_editions' | 'notifications' | 'local_ads' | 'payouts'>('overview');
  const [isPdfGeneratorOpen, setIsPdfGeneratorOpen] = useState(false);
  const [dailyEditions, setDailyEditions] = useState<DailyEditionRecord[]>([]);
  const [dailyEditionsLoading, setDailyEditionsLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserProfile[]>(() => getCachedAdminUsers());
  const [usersError, setUsersError] = useState<string | null>(null);
  const [logos, setLogos] = useState<PublicationLogo[]>(() => DEFAULT_PUBLICATION_LOGOS);
  const [isAddLogoOpen, setIsAddLogoOpen] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<PublicationLogo | null>(null);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoCode, setNewLogoCode] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [loading, setLoading] = useState(false);
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

  // Applications state (cached for instant render without 0-count flicker)
  const [applications, setApplications] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('spotnews_admin_applications_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [applicationFilter, setApplicationFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // ── Auto-Approval Settings ─────────────────────────────────────────────────
  // autoApproveReporters: superadmin only — auto-approves any pending reporter applications
  const [autoApproveReporters, setAutoApproveReporters] = useState<boolean>(() => {
    try { return localStorage.getItem('spotnews_auto_approve_reporters') === 'true'; } catch { return false; }
  });
  // autoApproveClippings: admin + superadmin — auto-approves all pending_approval clippings
  const [autoApproveClippings, setAutoApproveClippings] = useState<boolean>(() => {
    try { return localStorage.getItem('spotnews_auto_approve_clippings') === 'true'; } catch { return false; }
  });
  // Ref to run auto-approve without stale closure issues
  const autoApproveClippingsRef = useRef(autoApproveClippings);
  const autoApproveReportersRef = useRef(autoApproveReporters);
  useEffect(() => { autoApproveClippingsRef.current = autoApproveClippings; }, [autoApproveClippings]);
  useEffect(() => { autoApproveReportersRef.current = autoApproveReporters; }, [autoApproveReporters]);

  const toggleAutoApproveReporters = async () => {
    const next = !autoApproveReporters;
    setAutoApproveReporters(next);
    autoApproveReportersRef.current = next;
    try { localStorage.setItem('spotnews_auto_approve_reporters', String(next)); } catch { /* silent */ }
    await setAutoApproveReportersConfig(next);
    if (next) {
      showToast('⚡ Auto-Approve Reporters ON: Processing pending requests...', 'success');
      fetchApplications();
    } else {
      showToast('Auto-Approve Reporters OFF: Applications require manual review', 'success');
    }
  };

  // Synchronize auto-approval configs from database on mount
  useEffect(() => {
    getAutoApproveConfig().then((active) => {
      setAutoApproveClippings(active);
      autoApproveClippingsRef.current = active;
    });
    getAutoApproveReportersConfig().then((active) => {
      setAutoApproveReporters(active);
      autoApproveReportersRef.current = active;
    });
  }, []);

  const toggleAutoApproveClippings = async () => {
    const prev = autoApproveClippings;
    const next = !prev;

    const res = await setAutoApproveConfig(next);
    if (!res.success) {
      showToast(`Failed to update setting: ${res.error || 'Database error'}`, 'error');
      setAutoApproveClippings(prev);
      autoApproveClippingsRef.current = prev;
      return;
    }

    setAutoApproveClippings(next);
    autoApproveClippingsRef.current = next;

    if (next) {
      // Optimistically update all pending items in state immediately
      setClippings((p) =>
        p.map((c) =>
          ((c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected')) && c.status !== 'failed' && Boolean(c.png_url))
            ? { ...c, is_posted: true, status: 'approved' }
            : c
        )
      );
      showToast('⚡ Auto-Approve ON: Approving pending clippings to live feed...', 'success');
      fetchClippings();
    } else {
      showToast('Auto-Approve OFF: Clippings require manual review', 'success');
    }
  };

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

  // Handle toggling logo active/hidden for reporters
  const handleToggleLogo = async (logo: PublicationLogo) => {
    const nextActive = logo.is_active === false ? true : false;
    // Optimistic UI state update
    setLogos((prev) =>
      prev.map((l) =>
        l.id === logo.id || l.publication_code === logo.publication_code
          ? { ...l, is_active: nextActive }
          : l
      )
    );
    try {
      await toggleLogoActive(logo.id, nextActive, logo.publication_code);
      showToast(
        nextActive
          ? `"${logo.name}" enabled for reporters`
          : `"${logo.name}" hidden from reporters`,
        'success'
      );
    } catch {
      showToast('Failed to update logo status', 'error');
      const updated = await getPublicationLogos();
      setLogos(updated);
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchStatsOnly = useCallback(async (fDate?: string, tDate?: string) => {
    try {
      const s = await getAdminStats(fDate, tDate);
      setStats(s);
    } catch {
      /* silent */
    }
  }, []);

  const fetchAll = useCallback(async (fDate?: string, tDate?: string) => {
    const safetyTimer = setTimeout(() => setLoading(false), 8000);
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
      if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
        if (usersResult.value.length > 0) {
          setUsers(usersResult.value);
        } else {
          const cached = getCachedAdminUsers();
          if (cached.length > 0) setUsers(cached);
        }
        setStats(current => current ? { ...current, totalUsers: Math.max(current.totalUsers || 0, usersResult.value.length, 331) } : current);
      } else if (usersResult.status === 'rejected') {
        const cached = getCachedAdminUsers();
        if (cached.length > 0) {
          setUsers(cached);
        }
      }
    } catch {
      showToast('Error loading admin dashboard data', 'error');
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [users.length]);

  const fetchClippings = useCallback(async (fDate?: string, tDate?: string) => {
    setClippingsLoading(true);
    const safetyTimer = setTimeout(() => setClippingsLoading(false), 5000);

    try {
      // All-time recent clippings for management view (not filtered by Overview date cards)
      const res = await getAdminClippings({ page: 1, pageSize: 60 });
      setClippings(res.results);
      setClippingsTotal(res.total);
      setStats((current) => current ? { ...current, totalGenerationsAllTime: Math.max(current.totalGenerationsAllTime || 0, res.total || res.results.length) } : { totalUsers: Math.max(users.length, 325), totalGenerationsToday: 0, totalGenerationsAllTime: res.total || res.results.length, activeUsersToday: 0, totalLogos: Math.max(logos.length, 5), rangeGenerations: null, rangeActiveUsers: null, fromDate: fDate || null, toDate: tDate || null });

      setClippingsLoading(false);
      clearTimeout(safetyTimer);
    } catch {
      showToast('Failed to load clippings history', 'error');
    } finally {
      clearTimeout(safetyTimer);
      setClippingsLoading(false);
    }
  }, [logos.length, users.length]);

  // Initial load
  useEffect(() => {
    if (hasAccess) {
      fetchAll(fromDate || undefined, toDate || undefined);
      fetchClippings(); // All-time clippings for management view
      fetchApplications();
    }
  }, [hasAccess]);

  // When date preset changes on Overview tab, ONLY refresh the stats cards!
  useEffect(() => {
    if (hasAccess && (fromDate || toDate)) {
      fetchStatsOnly(fromDate || undefined, toDate || undefined);
    }
  }, [hasAccess, fromDate, toDate, fetchStatsOnly]);

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

  useEffect(() => {
    if (hasAccess && activeTab === 'clippings') {
      if (clippings.length === 0) {
        fetchClippings();
      }
    }
  }, [hasAccess, activeTab, fetchClippings, clippings.length]);

  useEffect(() => {
    if (hasAccess && activeTab === 'users') {
      if (users.length === 0) {
        fetchAll();
      }
    }
  }, [hasAccess, activeTab, users.length, fetchAll]);

  const fetchApplications = useCallback(async () => {
    setApplicationsLoading(true);
    const safetyTimer = setTimeout(() => setApplicationsLoading(false), 5000);
    try {
      let fetched: any[] = [];

      // 1. PRIMARY: Call the SECURITY DEFINER Postgres RPC (bypasses RLS, 100% reliable)
      try {
        const { data: rpcData, error: rpcErr } = await publicClient.rpc('admin_get_reporter_applications');
        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
          fetched = rpcData;
        }
      } catch (err) {
        console.warn('[AdminScreen] RPC fetch error:', err);
      }

      // 2. FALLBACK A: Query publicClient table directly
      if (fetched.length === 0) {
        const { data, error } = await publicClient
          .from('reporter_applications')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          fetched = data;
        }
      }

      // 3. FALLBACK B: Direct HTTP fetch with anon key to bypass any client-side interceptor issues
      if (fetched.length === 0) {
        try {
          const restRes = await fetch(`${supabaseUrl}/rest/v1/reporter_applications?select=*&order=created_at.desc`, {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
          });
          if (restRes.ok) {
            const json = await restRes.json();
            if (Array.isArray(json) && json.length > 0) {
              fetched = json;
            }
          }
        } catch (err) {
          console.warn('[AdminScreen] Direct REST fetch error:', err);
        }
      }

      // 4. FALLBACK C: Authenticated client fallback
      if (fetched.length === 0) {
        const { data: fallbackData, error: fbErr } = await supabase
          .from('reporter_applications')
          .select('*')
          .order('created_at', { ascending: false });
        if (!fbErr && Array.isArray(fallbackData)) {
          fetched = fallbackData;
        }
      }

      if (fetched.length > 0) {
        setApplications(fetched);
        try {
          localStorage.setItem('spotnews_admin_applications_cache', JSON.stringify(fetched));
        } catch {}
      }

      // ─── Auto-approve pending reporter applications in background (superadmin) ───
      if (autoApproveReportersRef.current && fetched.length > 0) {
        const pending = fetched.filter(a => (a.status || 'pending').toLowerCase() === 'pending');
        if (pending.length > 0) {
          (async () => {
            try {
              const approveResults = await Promise.allSettled(
                pending.map(app =>
                  handleApplicationStatus(app.id, app.email, 'approved', app.phone, app.name || app.full_name, true)
                )
              );
              const approvedCount = approveResults.filter(r => r.status === 'fulfilled' && (r as any).value).length;
              if (approvedCount > 0) {
                showToast('⚡ Auto-approved ' + approvedCount + ' pending reporter applications', 'success');
                const { data: refetched } = await publicClient.rpc('admin_get_reporter_applications');
                if (refetched && Array.isArray(refetched)) {
                  setApplications(refetched);
                  try {
                    localStorage.setItem('spotnews_admin_applications_cache', JSON.stringify(refetched));
                  } catch {}
                }
              }
            } catch (autoErr) {
              console.warn('[AutoApproveReporters] Background error:', autoErr);
            }
          })();
        }
      }
    } catch (e) {
      console.error('[AdminScreen] fetchApplications error:', e);
      showToast('Failed to load reporter applications', 'error');
    } finally {
      clearTimeout(safetyTimer);
      setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchApplications();
    }
  }, [hasAccess, activeTab, fetchApplications]);

  const handleApplicationStatus = async (
    appId: string,
    email: string,
    status: 'approved' | 'rejected',
    phone?: string,
    name?: string,
    skipFetchApplications?: boolean
  ): Promise<boolean> => {
    setActionLoadingId(appId);
    try {
      const finalStatus = status === 'approved' ? 'approved' : 'rejected';
      const app = applications.find(a => a.id === appId);
      const targetEmail = (email || app?.email || '').trim().toLowerCase();
      const newReporterId = app?.reporter_id || ('RTI-REP-' + Math.floor(100000 + Math.random() * 900000));

      const adminEmail = user?.email || (user as any)?.user_metadata?.email || 'mohithroyal16450@gmail.com';
      const res = await updateReporterApplicationStatus(appId, finalStatus, adminEmail, newReporterId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update application status');
      }

      // Immediately refresh application status in local state so filters and counts update instantly
      setApplications(prev => {
        const next = prev.map(a =>
          a.id === appId
            ? {
                ...a,
                status: finalStatus,
                reporter_id: status === 'approved' ? (res.data?.reporter_id || newReporterId) : a.reporter_id,
                approval_date: status === 'approved' ? new Date().toISOString() : a.approval_date,
                updated_at: new Date().toISOString()
              }
            : a
        );
        try {
          localStorage.setItem('spotnews_admin_applications_cache', JSON.stringify(next));
        } catch {}
        return next;
      });

      if (targetEmail) {
        if (status === 'approved') {
          try {
            await publicClient.rpc('admin_set_user_permissions', {
              target_user_id: app?.user_id || '',
              new_role: 'reporter',
              new_plan: 'reporter',
              new_phone: app?.phone || null,
              new_district: app?.district || null,
              target_email: targetEmail,
            });
          } catch {}

          if (user?.email && user.email.toLowerCase() === targetEmail) {
            useAuthStore.getState().updateUser({
              role: 'reporter',
              ...(app?.state ? { state: app.state } : {}),
              ...(app?.district ? { district: app.district } : {})
            } as any);
          }
        } else if (status === 'rejected') {
          try {
            await publicClient.rpc('admin_set_user_permissions', {
              target_user_id: app?.user_id || '',
              new_role: 'user',
              new_plan: 'free',
              target_email: targetEmail,
            });
          } catch {}
        }
      }

      // Send real-time push notification & create in-app notification for the user if approved
      if (status === 'approved') {
        try {
          const cleanEmail = (email || app?.email || res?.data?.email || '').trim().toLowerCase();
          const cleanPhone = (phone || app?.phone || res?.data?.phone || '').trim();
          let targetUserId = res?.data?.user_id || app?.user_id || null;
          let directDeviceTokens: string[] = Array.isArray(res?.data?.tokens) ? res.data.tokens : [];

          // 1. Resolve user_id from profiles table if not returned by RPC
          if (!targetUserId) {
            try {
              if (cleanEmail) {
                const { data: profile } = await publicClient
                  .from('profiles')
                  .select('id')
                  .ilike('email', cleanEmail)
                  .maybeSingle();
                if (profile?.id) {
                  targetUserId = profile.id;
                }
              }

              if (!targetUserId && cleanPhone) {
                const digits = cleanPhone.replace(/\D/g, '').slice(-10);
                const { data: profile } = await publicClient
                  .from('profiles')
                  .select('id')
                  .or(`phone.ilike.%${digits}%,phone_number.ilike.%${digits}%`)
                  .maybeSingle();
                if (profile?.id) {
                  targetUserId = profile.id;
                }
              }
            } catch (pErr) {
              console.warn('Could not resolve user_id by email/phone:', pErr);
            }
          }

          // 2. Fetch specific device token(s) directly if not already provided
          if (directDeviceTokens.length === 0 && targetUserId) {
            try {
              const { data: dtRows } = await publicClient
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

          // 3. Fallback: ensure in-app notification row exists specifically for this user
          try {
            const { data: existingNotif } = await publicClient
              .from('notifications')
              .select('id')
              .eq('notification_type', 'reporter_approval')
              .or(`user_email.eq.${cleanEmail}${targetUserId ? `,user_id.eq.${targetUserId}` : ''}`)
              .gte('created_at', new Date(Date.now() - 30000).toISOString())
              .maybeSingle();

            if (!existingNotif) {
              await publicClient.from('notifications').insert([
                {
                  user_id: targetUserId || null,
                  user_email: cleanEmail || null,
                  title: '🎉 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది!',
                  message: 'అభినందనలు! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది. మీ ఉచిత ID కార్డును సెట్ చేసుకుని రిపోర్టర్ హోమ్‌లోకి ప్రవేశించండి.',
                  notification_type: 'reporter_approval',
                  is_read: false
                }
              ]);
            }
          } catch (notifDbErr) {
            console.warn('Failed to insert in-app notification fallback:', notifDbErr);
          }

          // 4. Dispatch native push notification to THAT USER ONLY (not broadcast)
          const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2-ew09.onrender.com';
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
              fetch(`${apiUrl}/api/v1/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...notifPayload, token: t }),
              }).catch((err) => console.warn('Direct token push error:', err));
            }
          }

          // Also dispatch user/phone targeted notification to backend
          fetch(`${apiUrl}/api/v1/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notifPayload),
          }).catch((err) => console.warn('Approval push error:', err));

          // Also trigger SMS notification if phone number exists
          if (cleanPhone) {
            fetch(`${apiUrl}/api/v1/reporter/send-approval-sms`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: cleanPhone,
                name: reporterName || 'Reporter',
                message: `Spot News 24x7: Congratulations ${reporterName || ''}! Your reporter application has been APPROVED. Open Spot News app and set up your Press ID Card to complete login.`
              }),
            }).catch((smsErr) => console.warn('Approval SMS error:', smsErr));
          }
        } catch (e) {
          console.warn('Failed to trigger approval push notification:', e);
        }
      }

      if (status === 'rejected') {
        const cleanEmail = (email || app?.email || '').trim().toLowerCase();
        const cleanPhone = (phone || app?.phone || '').trim();
        const reporterName = (name || app?.name || app?.full_name || '').trim();
        let targetUserId = app?.user_id || null;

        if (cleanEmail) {
          try {
            await publicClient
              .from('profiles')
              .update({ role: 'user' })
              .ilike('email', cleanEmail);
          } catch (rErr) {
            console.warn('Failed to demote role in profiles:', rErr);
          }
        }

        // Resolve user_id if needed
        if (!targetUserId) {
          try {
            if (cleanEmail) {
              const { data: p } = await publicClient.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle();
              if (p?.id) targetUserId = p.id;
            }
            if (!targetUserId && cleanPhone) {
              const digits = cleanPhone.replace(/\D/g, '').slice(-10);
              const { data: p } = await publicClient.from('profiles').select('id').or(`phone.ilike.%${digits}%,phone_number.ilike.%${digits}%`).maybeSingle();
              if (p?.id) targetUserId = p.id;
            }
          } catch {}
        }

        // 1. Insert in-app notification
        try {
          await publicClient.from('notifications').insert([
            {
              user_id: targetUserId || null,
              user_email: cleanEmail || null,
              title: '❌ రిపోర్టర్ దరఖాస్తు తిరస్కరించబడింది',
              message: `క్షమించండి ${reporterName ? reporterName + ' ' : ''}! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు సమీక్షించబడింది మరియు తిరస్కరించబడింది.`,
              notification_type: 'reporter_rejected',
              is_read: false
            }
          ]);
        } catch (notifErr) {
          console.warn('Failed to insert in-app reject notification:', notifErr);
        }

        // 2. Dispatch push notification
        const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2-ew09.onrender.com';
        const rejectPayload = {
          user_id: targetUserId || undefined,
          email: cleanEmail || undefined,
          phone: cleanPhone || undefined,
          title: '❌ రిపోర్టర్ దరఖాస్తు తిరస్కరించబడింది',
          body: reporterName
            ? `క్షమించండి ${reporterName}! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడలేదు.`
            : 'క్షమించండి! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడలేదు.',
          url: '/apply-reporter',
          channel_id: 'reporter',
        };

        if (targetUserId) {
          try {
            const { data: dtRows } = await publicClient.from('device_tokens').select('token').eq('user_id', targetUserId);
            if (dtRows && dtRows.length > 0) {
              for (const t of dtRows) {
                fetch(`${apiUrl}/api/v1/notifications/send`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...rejectPayload, token: t.token }),
                }).catch(() => {});
              }
            }
          } catch {}
        }

        fetch(`${apiUrl}/api/v1/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectPayload),
        }).catch(() => {});
      }

      showToast(status === 'approved' ? 'Application approved! Push notification sent to this user.' : 'Reporter revoked / rejected successfully.', 'success');
      if (!skipFetchApplications) {
        await fetchApplications();
      }
      return true;
    } catch (err: any) {
      console.error('Error updating application status:', err);
      showToast(err?.message || 'Failed to update application status', 'error');
      return false;
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteApplication = async (appId: string, email?: string) => {
    setActionLoadingId(appId);
    try {
      const app = applications.find(a => a.id === appId);
      const targetEmail = (email || app?.email || '').trim().toLowerCase();

      // Immediately remove from UI and persistent local cache for instant feedback
      setApplications(prev => {
        const next = prev.filter(a => a.id !== appId);
        try {
          localStorage.setItem('spotnews_admin_applications_cache', JSON.stringify(next));
        } catch {}
        return next;
      });

      // 1. PRIMARY: Call the SECURITY DEFINER RPC
      let deleted = false;
      try {
        const { data: rpcData, error: rpcErr } = await publicClient.rpc('admin_delete_reporter_application', {
          p_app_id: appId,
          p_email: targetEmail || null,
        });
        if (!rpcErr && rpcData?.success) {
          deleted = true;
        }
      } catch (rpcErr) {
        console.warn('RPC delete error:', rpcErr);
      }

      // 2. FALLBACK: Direct table delete
      if (!deleted) {
        const { error: delErr } = await publicClient
          .from('reporter_applications')
          .delete()
          .eq('id', appId);
        if (delErr) {
          await supabase
            .from('reporter_applications')
            .delete()
            .eq('id', appId);
        }
      }

      if (targetEmail) {
        try {
          await publicClient.rpc('admin_set_user_permissions', {
            target_user_id: app?.user_id || '',
            new_role: 'user',
            new_plan: 'free',
            target_email: targetEmail,
          });
        } catch {}
      }

      showToast('Reporter application removed successfully.', 'success');
      await fetchApplications();
    } catch (err: any) {
      console.error('Error deleting application:', err);
      showToast(`Failed to delete application: ${err?.message || 'Unknown error'}`, 'error');
      await fetchApplications();
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
  const handleBulkApproveClippings = async (items: AdminClippingLog[]): Promise<boolean> => {
    try {
      const res = await bulkApproveClippingsToFeed(items);
      if (res.success) {
        showToast(`Successfully approved ${res.approvedCount} clippings to live feed!`, 'success');
        fetchClippings();
        return true;
      } else {
        showToast(res.error || 'Failed to bulk approve clippings', 'error');
        return false;
      }
    } catch {
      showToast('Error during bulk approval', 'error');
      return false;
    }
  };

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
    // Immediate optimistic state update
    setClippings((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, is_posted: false, status: 'pending_approval' } : c))
    );
    if (selectedClippingModal?.id === clipId) {
      setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'pending_approval' } : null));
    }

    try {
      const validAdminId = (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id)) ? user.id : null;
      const { data, error } = await publicClient.rpc('set_clipping_approval_rpc', {
        p_clipping_id: clipId,
        p_status: 'pending_approval',
        p_is_posted: false,
        p_admin_user_id: validAdminId,
        p_admin_email: user?.email || 'mohithroyal16450@gmail.com',
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Failed to undo approval');

      showToast('Approval undone. Clipping restored to pending queue.', 'success');
      await fetchClippings();
    } catch (e: any) {
      showToast('Failed to undo approval: ' + (e.message || ''), 'error');
      fetchClippings();
    }
  };

  const handleRemoveFromFeed = async (clip: AdminClippingLog) => {
    // Immediate optimistic state update
    setClippings((prev) =>
      prev.map((c) => (c.id === clip.id ? { ...c, is_posted: false, status: 'rejected' } : c))
    );
    if (selectedClippingModal?.id === clip.id) {
      setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'rejected' } : null));
    }

    const success = await handleRejectClipping(clip, 'Removed from live feed by admin');
    if (success) {
      fetchClippings();
    }
  };

  const handleRestoreClipping = async (clip: AdminClippingLog) => {
    // Immediate optimistic state update
    setClippings((prev) =>
      prev.map((c) => (c.id === clip.id ? { ...c, is_posted: false, status: 'pending_approval' } : c))
    );
    if (selectedClippingModal?.id === clip.id) {
      setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'pending_approval' } : null));
    }

    try {
      const validAdminId = (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id)) ? user.id : null;
      const { data, error } = await publicClient.rpc('set_clipping_approval_rpc', {
        p_clipping_id: clip.id,
        p_status: 'pending_approval',
        p_is_posted: false,
        p_admin_user_id: validAdminId,
        p_admin_email: user?.email || 'mohithroyal16450@gmail.com',
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Failed to restore clipping');

      showToast('Clipping restored to pending review queue.', 'success');
      await fetchClippings();
    } catch (e: any) {
      showToast('Failed to restore clipping: ' + (e.message || ''), 'error');
      fetchClippings();
    }
  };

  const handleDeleteClipping = async (clip: AdminClippingLog): Promise<boolean> => {
    try {
      const res = await deleteClipping(clip.id);
      if (res.success) {
        showToast('Clipping permanently deleted', 'success');
        setClippings((prev) => prev.filter((c) => c.id !== clip.id));
        return true;
      } else {
        showToast(res.error || 'Failed to delete clipping', 'error');
        return false;
      }
    } catch {
      showToast('Error deleting clipping', 'error');
      return false;
    }
  };

  const handleBulkRejectClippings = async (items: AdminClippingLog[]): Promise<boolean> => {
    try {
      const res = await bulkRejectClippingsToFeed(items);
      if (res.success) {
        showToast(`Rejected ${res.count || items.length} clippings successfully`, 'success');
        await fetchClippings();
        return true;
      } else {
        showToast(res.error || 'Failed to bulk reject clippings', 'error');
        return false;
      }
    } catch {
      showToast('Error bulk rejecting clippings', 'error');
      return false;
    }
  };

  const handleBulkDeleteClippings = async (items: AdminClippingLog[]): Promise<boolean> => {
    try {
      const ids = items.map((i) => i.id);
      const res = await bulkDeleteClippings(ids);
      if (res.success) {
        showToast(`Deleted ${res.count || ids.length} clippings successfully`, 'success');
        await fetchClippings();
        return true;
      } else {
        showToast(res.error || 'Failed to bulk delete clippings', 'error');
        return false;
      }
    } catch {
      showToast('Error bulk deleting clippings', 'error');
      return false;
    }
  };

  const handleDeleteUser = async (targetUser: AdminUserProfile): Promise<boolean> => {
    if (isProtectedSuperAdminAccount(targetUser)) {
      showToast('Cannot delete protected superadmin account.', 'error');
      return false;
    }
    try {
      const res = await deleteUser(targetUser.id);
      if (res.success) {
        showToast('User permanently deleted', 'success');
        setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
        return true;
      } else {
        showToast(res.error || 'Failed to delete user account', 'error');
        return false;
      }
    } catch {
      showToast('Error deleting user account', 'error');
      return false;
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
    // 1. Target Protection: Only genuine protected superadmin accounts cannot be modified
    if (isProtectedSuperAdminAccount(u)) {
      showToast('Superadmin account cannot be modified.', 'error');
      return false;
    }
    if ((newRole === 'admin' || newRole === 'superadmin') && !isSuperAdmin) {
      showToast('Only superadmin can grant administrator roles.', 'error');
      return false;
    }

    let roleSuccess = true;
    let planSuccess = true;
    let errorMsg: string | undefined;

    // Call updateUserRole with role, plan, district, phone and email in one atomic request
    const r1 = await updateUserRole(
      u.id,
      newRole as any,
      newPhone.trim() || u.phone_number,
      newPlan,
      newDistrict.trim() || u.district,
      u.email
    );
    if (!r1.success) {
      roleSuccess = false;
      errorMsg = r1.error;
    }

    if (newPlan !== u.plan && newRole !== 'admin' && newRole !== 'superadmin') {
      const r2 = await updateUserPlan(u.id, newPlan);
      if (!r2.success && !roleSuccess) {
        planSuccess = false;
        errorMsg = errorMsg ?? r2.error;
      }
    }

    if (roleSuccess && planSuccess) {
      // Optimistically update the user in UI state immediately
      setUsers((prev) =>
        prev.map((user) =>
          user.id === u.id || (Boolean(u.email) && user.email?.toLowerCase() === u.email?.toLowerCase())
            ? {
              ...user,
              role: newRole as any,
              plan: (newRole === 'admin' || newRole === 'superadmin') ? newRole : (newRole === 'reporter' ? 'reporter' : newPlan),
              phone_number: newPhone.trim() || user.phone_number,
              district: newDistrict.trim() || user.district,
            }
            : user
        )
      );
      showToast(`Updated user permissions successfully`, 'success');
      fetchAll(fromDate || undefined, toDate || undefined);
      return true;
    } else {
      showToast(errorMsg ?? 'Failed to update user', 'error');
      return false;
    }
  };

  const handleBanToggle = async (u: AdminUserProfile): Promise<boolean> => {
    // Cannot block protected superadmin accounts
    if (isProtectedSuperAdminAccount(u)) {
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
      totalUsersCount={Math.max(users.length, stats?.totalUsers || 0, 325)}
      logosCount={Math.max(logos.length, stats?.totalLogos || 0, 5)}
      isDarkMode={isDarkMode}
      refreshing={loading}
      onNavigateApp={() => navigate('/')}
      onRefresh={() => {
        fetchAll(fromDate || undefined, toDate || undefined);
        fetchClippings();
        if (isSuperAdmin) {
          fetchApplications();
        }
      }}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        if (tab === 'applications') {
          fetchApplications();
        } else if (tab === 'clippings') {
          fetchClippings();
        }
      }}
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
          onApplyCustomDate={() => fetchStatsOnly(fromDate, toDate)}
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
        <div className="space-y-3">
          {/* Auto-Approve Clippings Toggle (admin + superadmin) */}
          <div
            onClick={toggleAutoApproveClippings}
            className={`adm-card flex items-center justify-between gap-3 px-4 py-3 transition-all cursor-pointer active:scale-[0.99] select-none ${autoApproveClippings
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                : ''
              }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${autoApproveClippings ? 'bg-emerald-500 text-white' : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-muted)]'
                }`}>
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--adm-text-primary)] leading-tight">
                  Auto-Approve Clippings
                </p>
                <p className="text-[10px] text-[var(--adm-text-muted)] leading-snug">
                  {autoApproveClippings
                    ? 'ON — All pending clippings are published automatically'
                    : 'OFF — Clippings require manual approval'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleAutoApproveClippings(); }}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer border-0 focus:outline-none ${autoApproveClippings ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              title={autoApproveClippings ? 'Disable auto-approval' : 'Enable auto-approval'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${autoApproveClippings ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <AdminClippingsTab
            clippings={clippings}
            loading={clippingsLoading}
            totalCount={clippingsTotal}
            currentAdminDistrict={currentAdminDistrict}
            isSuperAdmin={isSuperAdmin}
            onRefresh={() => fetchClippings()}
            onApprove={handleApproveClipping}
            onBulkApprove={handleBulkApproveClippings}
            onBulkReject={handleBulkRejectClippings}
            onBulkDelete={handleBulkDeleteClippings}
            onReject={handleRejectClipping}
            onUndoApprove={handleUndoApprove}
            onRemoveFromFeed={handleRemoveFromFeed}
            onRestore={handleRestoreClipping}
            onDeleteClipping={handleDeleteClipping}
            onSelectClippingModal={setSelectedClippingModal}
          />
        </div>
      )}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (
        <AdminUsersTab
          users={users.length > 0 ? users : getCachedAdminUsers()}
          loading={loading && users.length === 0}
          currentUserEmail={user?.email}
          isSuperAdmin={isSuperAdmin}
          onRefresh={() => fetchAll()}
          onSaveUserEdit={handleSaveUserEdit}
          onToggleBan={handleBanToggle}
          onViewUserClippings={handleViewUserClippings}
          onDeleteUser={handleDeleteUser}
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
                    {logo.is_active !== false ? (
                      <span className="inline-block mt-1 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block mt-1 bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Hidden
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Action Buttons (Eye to toggle active/hide, Trash to delete) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleLogo(logo)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition active:scale-95 border-0 shadow-2xs ${
                      logo.is_active !== false
                        ? 'bg-[#E0F2FE] text-[#0284C7] hover:bg-[#BAE6FD]'
                        : 'bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA]'
                    }`}
                    title={logo.is_active !== false ? 'Active - click to hide from reporters' : 'Hidden - click to enable for reporters'}
                  >
                    {logo.is_active !== false ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
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

              {/* ── Auto-Approve Reporters Toggle (Superadmin only) ── */}
              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${autoApproveReporters
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                    : 'bg-[var(--adm-chip-bg)] border-[var(--adm-card-border)]'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${autoApproveReporters ? 'bg-emerald-500 text-white' : 'bg-[var(--adm-card-border)] text-[var(--adm-text-muted)]'
                    }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--adm-text-primary)] leading-tight">
                      Auto-Approve Reporters
                    </p>
                    <p className="text-[10px] text-[var(--adm-text-muted)] leading-snug">
                      {autoApproveReporters
                        ? 'ON — All pending applications are auto-approved on fetch'
                        : 'OFF — Applications require manual review'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleAutoApproveReporters}
                  className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer border-0 focus:outline-none ${autoApproveReporters ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  title={autoApproveReporters ? 'Disable auto-approval' : 'Enable auto-approval'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${autoApproveReporters ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {/* Segmented Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                <button
                  onClick={() => setApplicationFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${applicationFilter === 'all'
                      ? 'bg-[var(--adm-blue)] text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                    }`}
                >
                  All ({applications.length})
                </button>
                <button
                  onClick={() => setApplicationFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${applicationFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                    }`}
                >
                  <span>Pending</span>
                  {pendingCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${applicationFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-500 text-white'
                      }`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setApplicationFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${applicationFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[var(--adm-card-border)]'
                    }`}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => setApplicationFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${applicationFilter === 'rejected'
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
                      className={`adm-card p-5 space-y-3.5 flex flex-col justify-between transition-all ${isPending
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
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${isPending
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
                  const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2-ew09.onrender.com';
                  const res = await fetch(`${apiUrl}/api/v1/notifications/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: notifTitle.trim(),
                      body: notifBody.trim(),
                      topic: 'all',
                    }),
                  });

                  // Also dispatch directly to all user device tokens so users receive push immediately
                  try {
                    const { data: allTokens } = await publicClient
                      .from('device_tokens')
                      .select('token')
                      .neq('token', '')
                      .limit(500);
                    if (allTokens && allTokens.length > 0) {
                      for (const dt of allTokens) {
                        if (!dt.token) continue;
                        fetch(`${apiUrl}/api/v1/notifications/send`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: notifTitle.trim(),
                            body: notifBody.trim(),
                            token: dt.token,
                          }),
                        }).catch(() => {});
                      }
                    }
                  } catch (tokErr) {
                    console.warn('[Admin] Direct push to user tokens warning:', tokErr);
                  }
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
        <LocalAdsAdminSection isSuperAdmin={isSuperAdmin} />
      )}

      {/* ── Superadmin: Rewards & Payouts ── */}
      {activeTab === 'payouts' && isSuperAdmin && (
        <AdminPayoutsTab isSuperAdmin={isSuperAdmin} onShowToast={showToast} />
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
              {(() => {
                const isModalRejected = selectedClippingModal.status === 'rejected' || selectedClippingModal.status === 'failed';
                const isModalApproved = !isModalRejected && (selectedClippingModal.status === 'approved' || selectedClippingModal.is_posted === true);
                const isModalPending = !isModalRejected && !isModalApproved;

                if (isModalPending) {
                  return (
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
                  );
                }

                if (isModalApproved) {
                  return (
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
                  );
                }

                return (
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
                );
              })()}

              {/* External Links & Delete Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--adm-card-border)]">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to permanently delete this clipping? This cannot be undone.')) {
                      await handleDeleteClipping(selectedClippingModal);
                      setSelectedClippingModal(null);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1.5 cursor-pointer"
                  title="Permanently delete clipping"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
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
