import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, BarChart3, Image as ImageIcon, Shield, LogOut,
  Plus, Trash2, Eye, EyeOff, RefreshCw, X, Check,
  AlertTriangle, TrendingUp, Newspaper, Activity, Crown,
  ChevronDown, ChevronUp, Search, ArrowLeft, Ban,
  Calendar, FileText, ExternalLink, Download,
  UploadCloud, Edit2, CheckCircle2,
  Bell, Send, Radio, Smartphone, Megaphone,
  Clock, MapPin
} from 'lucide-react';
import { useAuthStore, isAdminUser, isSuperAdminUser } from '@/store';
import { supabase } from '@/lib/supabase';
import { LocalAdsAdminSection } from '@/components/LocalAdsAdminSection';
import {
  getAdminStats, getAdminUsers, getPublicationLogos,
  addPublicationLogo, updatePublicationLogo, uploadLogoImage,
  removePublicationLogo, toggleLogoActive,
  updateUserRole, updateUserPlan, banUser, deleteUser,
  getAdminClippings, approveClippingToFeed, rejectClippingSubmission,
  type AdminStats, type AdminUserProfile, type PublicationLogo, type AdminClippingLog
} from '@/services/admin.service';
import mastheadLogo from '../assets/rti_express_logo.png';
import { DailyNewspaperGeneratorModal } from '@/components/DailyNewspaperGeneratorModal';
import { dailyNewspaperService, type DailyEditionRecord } from '@/services/daily-newspaper.service';
import { INDIA_STATES } from '@/utils/indiaStates';

export const TELANGANA_DISTRICTS_LIST: string[] = INDIA_STATES['Telangana'] || [
  'Adilabad', 'Bhadradri Kothagudem', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
  'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
  'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal',
  'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet',
  'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri'
];

export const ANDHRA_DISTRICTS_LIST: string[] = INDIA_STATES['Andhra Pradesh'] || [
  'Alluri Sitharama Raju', 'Anakapalli', 'Ananthapuramu', 'Annamayya', 'Bapatla', 'Chittoor',
  'Dr. B.R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur', 'Kakinada', 'Krishna',
  'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam',
  'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tirupati', 'Visakhapatnam',
  'Vizianagaram', 'West Godavari', 'Y.S.R.'
];

export const ALL_ADMIN_DISTRICTS: string[] = [
  ...TELANGANA_DISTRICTS_LIST,
  ...ANDHRA_DISTRICTS_LIST,
];

const TELANGANA_DISTRICTS = [
  { id: 1, name: "Hyderabad / హైదరాబాద్" },
  { id: 2, name: "Rangareddy / రంగారెడ్డి" },
  { id: 3, name: "Medchal-Malkajgiri / మేడ్చల్" },
  { id: 4, name: "Warangal / వరంగల్" },
  { id: 5, name: "Karimnagar / కరీంనగర్" },
  { id: 6, name: "Nizamabad / నిజామాబాద్" },
  { id: 7, name: "Khammam / ఖమ్మం" },
  { id: 8, name: "Nalgonda / నల్గొండ" },
  { id: 9, name: "Mahabubnagar / మహబూబ్‌నగర్" },
  { id: 10, name: "Sangareddy / సంగారెడ్డి" },
  { id: 11, name: "Siddipet / సిద్దిపేట" },
  { id: 12, name: "Adilabad / ఆదిలాబాద్" },
  { id: 13, name: "Suryapet / సూర్యాపేట" },
];

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; bg: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 border border-[#D0E2F7] shadow-sm flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: bg, color }}>
          Live
        </span>
      </div>
      <div>
        <p className="text-[#0A2540] text-2xl font-black tracking-tight">{fmt(Number(value))}</p>
        <p className="text-[#6B7A90] text-xs font-bold uppercase tracking-wider mt-1">{label}</p>
        {sub && <p className="text-[#8FA3B8] text-[11px] mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    admin:      { label: 'ADMIN',      color: '#B45309', bg: '#FEF3C7' },
    pro:        { label: 'PRO',        color: '#4338CA', bg: '#EEF2FF' },
    enterprise: { label: 'ENTERPRISE', color: '#047857', bg: '#ECFDF5' },
    free:       { label: 'FREE',       color: '#475569', bg: '#F1F5F9' },
    reporter:   { label: 'REPORTER',   color: '#0369A1', bg: '#E0F2FE' },
  };
  const s = map[plan?.toLowerCase()] ?? map.free;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-current/20"
      style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isSuper = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuper;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{
        color: isSuper ? '#92400E' : isAdmin ? '#0369A1' : '#475569',
        background: isSuper ? '#FEF3C7' : isAdmin ? '#E0F2FE' : '#F1F5F9',
        border: isSuper ? '1px solid #FCD34D' : isAdmin ? '1px solid #BAE6FD' : '1px solid #E2E8F0',
      }}>
      {isSuper ? <Crown className="w-2.5 h-2.5" /> : isAdmin ? <Shield className="w-2.5 h-2.5" /> : null}
      {role || 'user'}
    </span>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white"
      style={{ background: type === 'success' ? '#059669' : '#DC2626' }}
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
          if (prof?.role === 'admin') {
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

  // ── State ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = isSuperAdminUser(user);
  const [activeTab, setActiveTab] = useState<'overview' | 'clippings' | 'users' | 'logos' | 'applications' | 'daily_editions' | 'notifications' | 'local_ads'>('overview');
  const [isPdfGeneratorOpen, setIsPdfGeneratorOpen] = useState(false);
  const [dailyEditions, setDailyEditions] = useState<DailyEditionRecord[]>([]);
  const [dailyEditionsLoading, setDailyEditionsLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [logos, setLogos] = useState<PublicationLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active_today' | 'admin' | 'reporter' | 'banned'>('all');
  const [sortField, setSortField] = useState<keyof AdminUserProfile>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Push Notification broadcast state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTargetType, setNotifTargetType] = useState<'all' | 'district' | 'token'>('all');
  const [notifDistrictId, setNotifDistrictId] = useState<number>(1);
  const [notifCustomToken, setNotifCustomToken] = useState('');
  const [notifChannel, setNotifChannel] = useState<'news' | 'weather' | 'reporter' | 'general'>('news');
  const [notifUrl, setNotifUrl] = useState('/');
  const [notifImageUrl, setNotifImageUrl] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [notifStats, setNotifStats] = useState<{ total_device_tokens: number; unique_registered_users: number; tokens_by_district: Record<string, number> } | null>(null);
  const [notifStatsLoading, setNotifStatsLoading] = useState(false);

  // Date filtering state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');

  // Clippings state
  const [clippings, setClippings] = useState<AdminClippingLog[]>([]);
  const [clippingsLoading, setClippingsLoading] = useState(false);
  const [clippingsTotal, setClippingsTotal] = useState(0);
  const [clippingsSearch, setClippingsSearch] = useState('');
  const [selectedClippingModal, setSelectedClippingModal] = useState<AdminClippingLog | null>(null);

  // District Admin & Approval Filtering State
  const [clippingApprovalFilter, setClippingApprovalFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [adminDistrictFilter, setAdminDistrictFilter] = useState<string>('all');
  const [currentAdminDistrict, setCurrentAdminDistrict] = useState<string>('');
  const [adminDistrictLoading, setAdminDistrictLoading] = useState<boolean>(!isSuperAdmin);
  const [editDistrict, setEditDistrict] = useState<string>('');

  // Map of district -> admin user (Every district will get one admin only)
  const districtAdminMap = useMemo(() => {
    const map: Record<string, AdminUserProfile> = {};
    users.forEach((u) => {
      if (u.role === 'admin' && u.district && u.district.trim()) {
        map[u.district.trim().toLowerCase()] = u;
      }
    });
    return map;
  }, [users]);

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
          const d = (prof.district || '').trim();
          setCurrentAdminDistrict(d);
          setAdminDistrictFilter(d || 'none');
        }
      } catch (err) {
        console.warn('Could not fetch admin district:', err);
      } finally {
        setAdminDistrictLoading(false);
      }
    };
    fetchAdminDistrict();
  }, [user?.id, isSuperAdmin]);

  // Applications state
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  // Guard tab for non-superadmin
  useEffect(() => {
    if (!isSuperAdmin && (activeTab === 'logos' || activeTab === 'applications' || activeTab === 'notifications')) {
      setActiveTab('overview');
    }
  }, [isSuperAdmin, activeTab]);

  const fetchNotificationStats = useCallback(async () => {
    setNotifStatsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com';
      const res = await fetch(`${apiUrl}/api/v1/notifications/tokens`);
      if (res.ok) {
        const data = await res.json();
        setNotifStats(data);
      }
    } catch (e) {
      console.warn("Failed to fetch notification stats:", e);
    } finally {
      setNotifStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications' && hasAccess) {
      fetchNotificationStats();
    }
  }, [activeTab, hasAccess, fetchNotificationStats]);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      setToast({ message: 'Title and Message are required', type: 'error' });
      return;
    }
    setNotifSending(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com';
      const payload: Record<string, any> = {
        title: notifTitle.trim(),
        body: notifBody.trim(),
        channel_id: notifChannel,
        url: notifUrl || '/',
      };
      payload.image_url = notifImageUrl.trim() || 'https://rffrqokpnqoycpozrjuc.supabase.co/storage/v1/object/public/newscraft-clippings/assets/app_logo.png';
      if (notifTargetType === 'all') {
        payload.topic = 'all';
      } else if (notifTargetType === 'district') {
        payload.topic = `district_${notifDistrictId}`;
      } else if (notifTargetType === 'token') {
        if (!notifCustomToken.trim()) {
          setToast({ message: 'Please enter a target device token', type: 'error' });
          setNotifSending(false);
          return;
        }
        payload.token = notifCustomToken.trim();
      }

      const res = await fetch(`${apiUrl}/api/v1/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.success) {
        setToast({ message: `Push notification sent successfully! (${resData.topic || 'Device'})`, type: 'success' });
        setNotifTitle('');
        setNotifBody('');
        fetchNotificationStats();
      } else {
        setToast({ message: resData.error || 'Failed to send notification', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error sending push notification', type: 'error' });
    } finally {
      setNotifSending(false);
    }
  };

  // Edit user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editPlan, setEditPlan] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Logo form and editing state
  const [showLogoForm, setShowLogoForm] = useState(false);
  const [editingLogoId, setEditingLogoId] = useState<string | null>(null);
  const [logoName, setLogoName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoCode, setLogoCode] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [logoFormLoading, setLogoFormLoading] = useState(false);
  const [logoFormError, setLogoFormError] = useState('');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (fDate?: string, tDate?: string) => {
    setLoading(true);
    setUsersError(null);
    try {
      const [statsResult, usersResult, logosResult] = await Promise.allSettled([
        getAdminStats(fDate, tDate),
        getAdminUsers(),
        getPublicationLogos(),
      ]);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (logosResult.status === 'fulfilled') setLogos(logosResult.value);
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
        // Keep the registered-account count consistent with the full directory.
        setStats(current => current ? { ...current, totalUsers: usersResult.value.length } : current);
      } else {
        setUsers([]);
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
  }, []);

  const fetchClippings = useCallback(async (fDate?: string, tDate?: string) => {
    setClippingsLoading(true);
    try {
      const activeDistrict = !isSuperAdmin
        ? (currentAdminDistrict || undefined)
        : (adminDistrictFilter !== 'all' ? adminDistrictFilter : undefined);

      const res = await getAdminClippings({
        fromDate: fDate,
        toDate: tDate,
        page: 1,
        pageSize: 60,
        district: activeDistrict,
      });
      setClippings(res.results);
      setClippingsTotal(res.total);
    } catch {
      showToast('Failed to load clippings history', 'error');
    } finally {
      setClippingsLoading(false);
    }
  }, [isSuperAdmin, currentAdminDistrict, adminDistrictFilter]);

  useEffect(() => {
    if (hasAccess) {
      fetchAll(fromDate || undefined, toDate || undefined);
    }
  }, [hasAccess, fetchAll, fromDate, toDate]);

  useEffect(() => {
    if (hasAccess && activeTab === 'clippings') {
      fetchClippings(fromDate || undefined, toDate || undefined);
    }
  }, [hasAccess, activeTab, fetchClippings, fromDate, toDate]);

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
    if (hasAccess && activeTab === 'applications' && isSuperAdmin) {
      fetchApplications();
    }
  }, [hasAccess, activeTab, isSuperAdmin, fetchApplications]);

  const handleApplicationStatus = async (appId: string, email: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('reporter_applications')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', appId);
      if (error) throw error;
      
      // Update region metadata on profile if present, but DO NOT activate 'reporter' role yet.
      // As per security specifications, role stays 'user' until payment is verified by the backend.
      const app = applications.find(a => a.id === appId);
      if (app && (app.state || app.district)) {
        await supabase
          .from('profiles')
          .update({
            ...(app.state ? { state: app.state } : {}),
            ...(app.district ? { district: app.district } : {})
          })
          .eq('email', email);
      }

      // Send real-time push notification & create in-app notification for the user if approved
      if (status === 'approved') {
        try {
          const cleanEmail = (email || app?.email || '').trim().toLowerCase();

          // 1. Resolve user_id from app or profiles table
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
              console.warn('Could not resolve user_id for approval:', pErr);
            }
          }

          // 2. Insert in-app notification row so user receives notification in the app
          try {
            await supabase.from('notifications').insert([
              {
                user_id: targetUserId || null,
                user_email: cleanEmail || null,
                title: '🎉 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది!',
                message: 'అభినందనలు! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది. ID కార్డు & యాక్సెస్ కొరకు వెంటనే చెల్లింపు పూర్తి చేయండి.',
                notification_type: 'reporter_approval',
                is_read: false
              }
            ]);
          } catch (notifDbErr) {
            console.warn('Failed to insert in-app notification:', notifDbErr);
          }

          // 3. Dispatch native push notification
          const apiUrl = import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com';
          await fetch(`${apiUrl}/api/v1/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: targetUserId || undefined,
              email: cleanEmail || undefined,
              title: '🎉 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది!',
              body: 'అభినందనలు! మీ Spot News 24x7 రిపోర్టర్ దరఖాస్తు ఆమోదించబడింది. ID కార్డు & యాక్సెస్ కొరకు వెంటనే చెల్లింపు పూర్తి చేయండి.',
              image_url: 'https://rffrqokpnqoycpozrjuc.supabase.co/storage/v1/object/public/newscraft-clippings/assets/app_logo.png',
              url: '/payment',
              channel_id: 'reporter',
            }),
          }).catch((err) => console.warn('Approval push error:', err));
        } catch (e) {
          console.warn('Failed to trigger approval notification:', e);
        }
      }

      showToast(status === 'approved' ? 'Application approved! Reporter can now proceed to payment.' : 'Application rejected.', 'success');
      fetchApplications();
    } catch {
      showToast(`Failed to update application status`, 'error');
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

  const handleClippingsTodayClick = () => {
    handleDatePreset('today');
    setClippingsSearch('');
    setActiveTab('clippings');
    fetchClippings(getTodayStr(), getTodayStr());
  };

  const handleAllClippingsClick = () => {
    handleDatePreset('all');
    setClippingsSearch('');
    setActiveTab('clippings');
    fetchClippings();
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
    navigate('/login', { replace: true });
  };

  // User Actions
  const getUserIdentifier = (u: AdminUserProfile) => {
    if (u.email && !u.email.endsWith('@phone.user')) return u.email;
    return u.phone_number || u.full_name || 'User';
  };

  const startEdit = (u: AdminUserProfile) => {
    if (isSuperAdminUser(u)) {
      showToast('Superadmin account is protected.', 'error');
      return;
    }
    setEditingUserId(u.id);
    setEditRole(u.role ?? 'user');
    setEditPlan(u.plan ?? 'free');
    setEditPhone(u.phone_number ?? '');
    setEditDistrict(u.district ?? '');
  };

  const cancelEdit = () => { setEditingUserId(null); };

  const saveEdit = async (u: AdminUserProfile) => {
    if (isSuperAdminUser(u)) {
      showToast('Superadmin account cannot be modified.', 'error');
      setEditingUserId(null);
      return;
    }
    if (editRole === 'admin') {
      if (!isSuperAdmin) {
        showToast('Only superadmin can grant admin role.', 'error');
        return;
      }
      if (!editDistrict || !editDistrict.trim()) {
        showToast('Please assign a district. Every district will get one admin only.', 'error');
        return;
      }
      const conflict = districtAdminMap[editDistrict.trim().toLowerCase()];
      if (conflict && conflict.id !== u.id) {
        showToast(`District "${editDistrict}" is already assigned to admin ${conflict.email || conflict.full_name}. Every district will get one admin only.`, 'error');
        return;
      }
    }
    setEditSaving(true);
    let roleSuccess = true;
    let planSuccess = true;
    let errorMsg: string | undefined;

    if (editRole !== u.role || editPhone !== (u.phone_number ?? '') || editDistrict !== (u.district ?? '')) {
      const r1 = await updateUserRole(u.id, editRole as any, editPhone.trim() || u.phone_number, undefined, editDistrict || undefined);
      if (!r1.success) {
        roleSuccess = false;
        errorMsg = r1.error;
      }
    }
    if (editPlan !== u.plan && editRole !== 'admin') {
      const r2 = await updateUserPlan(u.id, editPlan);
      if (!r2.success) {
        planSuccess = false;
        errorMsg = errorMsg ?? r2.error;
      }
    }

    setEditSaving(false);
    setEditingUserId(null);

    const label = getUserIdentifier(u);
    if (roleSuccess && planSuccess) {
      showToast(`Updated ${label} successfully`, 'success');
      fetchAll(fromDate || undefined, toDate || undefined);
    } else {
      showToast(errorMsg ?? 'Failed to update user', 'error');
    }
  };

  const handleBanToggle = async (u: AdminUserProfile) => {
    if (isSuperAdminUser(u)) {
      showToast('Superadmin cannot be blocked.', 'error');
      return;
    }
    const label = getUserIdentifier(u);
    setActionLoadingId(u.id);
    const duration = u.is_banned ? 'none' : '876600h';
    const res = await banUser(u.id, duration);
    setActionLoadingId(null);
    if (res.success) {
      showToast(u.is_banned ? `Unblocked ${label}` : `Blocked ${label}`, 'success');
      fetchAll(fromDate || undefined, toDate || undefined);
    } else {
      showToast(res.error ?? 'Action failed', 'error');
    }
  };

  const handleDeleteUser = async (u: AdminUserProfile) => {
    if (isSuperAdminUser(u)) {
      showToast('Superadmin cannot be deleted.', 'error');
      return;
    }
    if (!isSuperAdmin) {
      showToast('Only superadmin can delete users.', 'error');
      return;
    }
    const label = getUserIdentifier(u);
    if (!window.confirm(`Are you sure you want to permanently delete user ${label}? This action cannot be undone.`)) {
      return;
    }
    setActionLoadingId(u.id);
    const res = await deleteUser(u.id);
    setActionLoadingId(null);
    if (res.success) {
      showToast(`User ${label} deleted successfully.`, 'success');
      fetchAll(fromDate || undefined, toDate || undefined);
    } else {
      showToast(res.error ?? 'Failed to delete user.', 'error');
    }
  };

  // Logo handlers
  const resetLogoForm = () => {
    setLogoName('');
    setLogoUrl('');
    setLogoCode('');
    setLogoFile(null);
    setLogoPreview('');
    setShowManualUrl(false);
    setEditingLogoId(null);
    setShowLogoForm(false);
    setLogoFormError('');
  };

  const handleLogoFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setLogoFormError('Please select a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setLogoFormError('Image size must be less than 50MB');
      return;
    }
    setLogoFile(file);
    setLogoFormError('');
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (!logoName.trim()) {
      setLogoFormError('Publication name is required');
      return;
    }
    if (!logoCode.trim()) {
      setLogoFormError('Publication code is required');
      return;
    }
    if (!editingLogoId && !logoFile && !logoUrl.trim()) {
      setLogoFormError('Please upload a logo image or provide an image URL');
      return;
    }

    setLogoFormLoading(true);
    setLogoFormError('');

    let finalLogoUrl = logoUrl.trim();
    if (logoFile) {
      const uploadRes = await uploadLogoImage(logoFile);
      if (uploadRes.error || !uploadRes.url) {
        setLogoFormLoading(false);
        setLogoFormError(uploadRes.error ?? 'Failed to upload logo image');
        return;
      }
      finalLogoUrl = uploadRes.url;
    }

    if (editingLogoId) {
      const updates: any = { name: logoName.trim(), publication_code: logoCode.trim() };
      if (finalLogoUrl) updates.logo_url = finalLogoUrl;
      const result = await updatePublicationLogo(editingLogoId, updates);
      setLogoFormLoading(false);
      if (result.success) {
        showToast('Publication logo updated successfully!', 'success');
        resetLogoForm();
        fetchAll();
      } else {
        setLogoFormError(result.error ?? 'Failed to update logo.');
      }
    } else {
      const result = await addPublicationLogo(logoName, finalLogoUrl, logoCode);
      setLogoFormLoading(false);
      if (result.success) {
        showToast('Publication logo added successfully!', 'success');
        resetLogoForm();
        fetchAll();
      } else {
        setLogoFormError(result.error ?? 'Failed to add logo.');
      }
    }
  };

  const handleToggleLogo = async (id: string, current: boolean) => {
    if (!isSuperAdmin) {
      showToast('Only superadmin can manage logos.', 'error');
      return;
    }
    await toggleLogoActive(id, !current);
    showToast(`Logo ${!current ? 'enabled' : 'disabled'}`, 'success');
    fetchAll();
  };

  const handleDeleteLogo = async (id: string, name: string) => {
    if (!isSuperAdmin) {
      showToast('Only superadmin can manage logos.', 'error');
      return;
    }
    if (!window.confirm(`Delete logo "${name}"? This cannot be undone.`)) return;
    const result = await removePublicationLogo(id);
    if (result.success) {
      showToast('Logo removed.', 'success');
      fetchAll();
    } else {
      showToast('Failed to remove logo.', 'error');
    }
  };

  // ── Access Denied / Loading State ─────────────────────────────────────────
  if (!accessChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EAF1FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-[#015BB3] border-t-transparent animate-spin" />
          <p className="text-[#0A2540] text-sm font-bold">Verifying Administrator Access…</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#EAF1FB]">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border border-[#D0E2F7] rounded-3xl p-8 text-center max-w-sm shadow-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
            <Shield className="w-8 h-8 text-[#DC2626]" />
          </div>
          <h2 className="text-[#0A2540] text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-[#6B7A90] text-xs leading-relaxed mb-6">
            You do not have administrator privileges to view this control panel. If you believe this is an error, please contact support.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#015BB3] shadow-sm active:scale-95 transition-transform"
          >
            Return to App
          </button>
        </motion.div>
      </div>
    );
  }

  // Counts for user filter tabs
  const activeTodayCount = users.filter((u) => u.is_active_today).length;
  const reportersCount = users.filter((u) => u.role === 'reporter').length;
  const adminsCount = users.filter((u) => u.role === 'admin').length;
  const bannedCount = users.filter((u) => u.is_banned).length;

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.phone_number && u.phone_number.toLowerCase().includes(q)) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.plan || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (userFilter === 'active_today') return Boolean(u.is_active_today);
    if (userFilter === 'admin') return u.role === 'admin';
    if (userFilter === 'reporter') return u.role === 'reporter';
    if (userFilter === 'banned') return Boolean(u.is_banned);
    return true;
  }).sort((a, b) => {
    const aVal = a[sortField] ?? '';
    const bVal = b[sortField] ?? '';
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  // Approval Handlers for District Admin / Superadmin
  const handleApproveClipping = async (clip: AdminClippingLog) => {
    setActionLoadingId(clip.id);
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
      } else {
        showToast(res.error || 'Failed to approve clipping', 'error');
      }
    } catch {
      showToast('Error approving clipping', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectClipping = async (clip: AdminClippingLog) => {
    const reason = window.prompt(
      'Enter reason for rejecting this clipping (optional):',
      'Clipping does not meet editorial publication standards.'
    );
    if (reason === null) return;

    setActionLoadingId(clip.id);
    try {
      const res = await rejectClippingSubmission(clip.id, {
        headline: clip.headline,
        user_id: clip.user_id,
        user_email: clip.user_email,
        reason: reason || undefined,
      });
      if (res.success) {
        showToast('Clipping marked as rejected.', 'success');
        setClippings((prev) =>
          prev.map((c) => (c.id === clip.id ? { ...c, is_posted: false, status: 'rejected' } : c))
        );
        if (selectedClippingModal?.id === clip.id) {
          setSelectedClippingModal((prev) => (prev ? { ...prev, is_posted: false, status: 'rejected' } : null));
        }
      } else {
        showToast(res.error || 'Failed to reject clipping', 'error');
      }
    } catch {
      showToast('Error rejecting clipping', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Pending clippings count for current district scope
  const pendingClippingsCount = clippings.filter((c) => {
    if (!isSuperAdmin) {
      if (!currentAdminDistrict) return false;
      if ((c.district || '').trim().toLowerCase() !== currentAdminDistrict.trim().toLowerCase()) return false;
    } else if (adminDistrictFilter !== 'all') {
      if ((c.district || '').trim().toLowerCase() !== adminDistrictFilter.trim().toLowerCase()) return false;
    }
    return c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected');
  }).length;

  // Filtered clippings with District Admin and Approval status logic
  const filteredClippings = clippings.filter((c) => {
    const q = clippingsSearch.toLowerCase();
    const matchQuery =
      c.headline.toLowerCase().includes(q) ||
      c.user_email.toLowerCase().includes(q) ||
      (c.user_name || '').toLowerCase().includes(q) ||
      (c.district || '').toLowerCase().includes(q) ||
      (c.publication_name || '').toLowerCase().includes(q) ||
      (c.language || '').toLowerCase().includes(q);

    if (!matchQuery) return false;

    // Strict District filter (1 admin per district)
    if (!isSuperAdmin) {
      if (!currentAdminDistrict) return false;
      if ((c.district || '').trim().toLowerCase() !== currentAdminDistrict.trim().toLowerCase()) return false;
    } else if (adminDistrictFilter !== 'all') {
      if ((c.district || '').trim().toLowerCase() !== adminDistrictFilter.trim().toLowerCase()) return false;
    }

    // Approval status filter
    if (clippingApprovalFilter === 'pending') {
      return c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected');
    }
    if (clippingApprovalFilter === 'approved') {
      return c.is_posted === true || c.status === 'approved';
    }
    if (clippingApprovalFilter === 'rejected') {
      return c.status === 'rejected';
    }
    return true;
  });

  // ── Render Dashboard ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EAF1FB] pb-24 text-[#0A2540] font-sans">
      {/* ── Spot News Masthead Header ── */}
      <header className="w-full bg-[#015BB3] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-auto bg-white p-1 rounded-lg border border-white/20 flex items-center justify-center shrink-0">
              <img src={mastheadLogo} alt="Spot News" className="h-full w-auto object-contain max-w-[70px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white text-lg font-black tracking-wide leading-tight" style={{ fontFamily: "'Georgia', serif" }}>
                  Spot News 24x7
                </h1>
                <span className="bg-amber-400 text-[#0A2540] text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs">
                  {isSuperAdmin ? 'SUPERADMIN' : 'ADMIN'}
                </span>
              </div>
              <p className="text-white/75 text-[11px] font-medium">Control Center & Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                onClick={() => setIsPdfGeneratorOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md active:scale-95 transition-all hover:brightness-105"
                title="Generate Daily Newspaper PDF"
              >
                <Newspaper className="w-4 h-4" />
                <span>Generate News PDF</span>
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white/15 text-white active:scale-95 transition-transform hover:bg-white/20"
              title="Return to App"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
            <button
              onClick={() => fetchAll(fromDate || undefined, toDate || undefined)}
              disabled={loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 text-white active:scale-95 transition-transform hover:bg-white/20"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#D32F2F] text-white active:scale-95 transition-transform hover:bg-[#B71C1C]"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User bar */}
        <div className="bg-[#0A2540]/30 border-t border-white/10 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-white/80">
            <div className="flex items-center gap-2 truncate">
              <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                Admin: <strong className="text-white font-bold">{user?.email}</strong>
              </span>
            </div>
            <span className="text-[11px] text-white/60 shrink-0">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── Segmented Navigation Tabs ── */}
      {usersError && (
        <div role="alert" className="max-w-5xl mx-auto mt-4 px-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{usersError}</p>
          <button disabled={loading} onClick={() => fetchAll(fromDate || undefined, toDate || undefined)}
              className="mt-2 font-bold underline disabled:opacity-50">Retry loading users</button>
          </div>
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-1 flex items-center gap-1 shadow-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-[#015BB3] text-white shadow-sm'
                : 'text-[#415A77] hover:bg-white/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('clippings')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'clippings'
                ? 'bg-[#015BB3] text-white shadow-sm'
                : 'text-[#415A77] hover:bg-white/50'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>Clippings</span>
            {pendingClippingsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white shadow-xs">
                {pendingClippingsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-[#015BB3] text-white shadow-sm'
                : 'text-[#415A77] hover:bg-white/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{usersError ? 'Users (unavailable)' : `Users (${users.length})`}</span>
          </button>

          {isSuperAdmin && (
            <>
              <button
                onClick={() => setActiveTab('daily_editions')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'daily_editions'
                    ? 'bg-[#015BB3] text-white shadow-sm'
                    : 'text-[#415A77] hover:bg-white/50'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-300" />
                <span>Daily Editions</span>
              </button>

              <button
                onClick={() => setActiveTab('logos')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'logos'
                    ? 'bg-[#015BB3] text-white shadow-sm'
                    : 'text-[#415A77] hover:bg-white/50'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Logos ({logos.length})</span>
              </button>
              
              <button
                onClick={() => setActiveTab('applications')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'applications'
                    ? 'bg-[#015BB3] text-white shadow-sm'
                    : 'text-[#415A77] hover:bg-white/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Requests</span>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'notifications'
                    ? 'bg-[#015BB3] text-white shadow-sm'
                    : 'text-[#415A77] hover:bg-white/50'
                }`}
              >
                <Bell className="w-4 h-4 text-amber-300" />
                <span>Push Alerts</span>
              </button>

              <button
                onClick={() => setActiveTab('local_ads')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'local_ads'
                    ? 'bg-[#015BB3] text-white shadow-sm'
                    : 'text-[#415A77] hover:bg-white/50'
                }`}
              >
                <Megaphone className="w-4 h-4 text-emerald-300" />
                <span>Local Ads</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main Tab Content ── */}
      <main className="max-w-5xl mx-auto px-4 pt-4">

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW                                                      */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Date Preset Filter Bar */}
            <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-3 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0A2540]">
                  <Calendar className="w-3.5 h-3.5 text-[#015BB3]" />
                  <span>Filter Statistics by Period</span>
                </div>
                {stats?.rangeGenerations !== null && stats?.rangeGenerations !== undefined && (
                  <span className="text-[11px] font-bold text-[#015BB3] bg-[#D6E9FF] px-2 py-0.5 rounded-full">
                    {stats.rangeGenerations} clippings in range
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleDatePreset(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      activeDatePreset === p
                        ? 'bg-[#015BB3] text-white shadow-xs'
                        : 'bg-white text-[#415A77] border border-[#D0E2F7] hover:bg-white/80'
                    }`}
                  >
                    {p === 'all' ? 'All Time' : p === 'week' ? 'Last 7D' : p === 'month' ? 'Last 30D' : p}
                  </button>
                ))}
              </div>

              {activeDatePreset === 'custom' && (
                <div className="mt-3 pt-3 border-t border-[#D0E2F7] flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#6B7A90] font-semibold">From:</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="bg-white border border-[#D0E2F7] rounded-lg px-2 py-1 text-xs text-[#0A2540]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#6B7A90] font-semibold">To:</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="bg-white border border-[#D0E2F7] rounded-lg px-2 py-1 text-xs text-[#0A2540]"
                    />
                  </div>
                  <button
                    onClick={() => fetchAll(fromDate, toDate)}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-[#015BB3] text-white"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={Users}
                label="Total Users"
                value={Math.max(stats?.totalUsers ?? 0, users.length)}
                sub={usersError ? 'User list unavailable' : 'Registered accounts'}
                color="#015BB3"
                bg="#E0F2FE"
              />
              <div
                onClick={handleClippingsTodayClick}
                className="cursor-pointer active:scale-95 transition-transform"
                title="Tap to view clippings generated today"
              >
                <StatCard
                  icon={TrendingUp}
                  label="Clippings Today"
                  value={stats?.totalGenerationsToday ?? 0}
                  sub="Published today · Tap to view →"
                  color="#059669"
                  bg="#ECFDF5"
                />
              </div>
              <div
                onClick={handleAllClippingsClick}
                className="cursor-pointer active:scale-95 transition-transform"
                title="Tap to view all clippings"
              >
                <StatCard
                  icon={Newspaper}
                  label="Total Clippings"
                  value={stats?.totalGenerationsAllTime ?? 0}
                  sub="All-time created · Tap to view →"
                  color="#D97706"
                  bg="#FEF3C7"
                />
              </div>
              <div
                onClick={() => {
                  setUserFilter('active_today');
                  setActiveTab('users');
                }}
                className="cursor-pointer active:scale-95 transition-transform"
                title="Tap to see users active today"
              >
                <StatCard
                  icon={Activity}
                  label="Active Reporters"
                  value={Math.max(stats?.activeUsersToday ?? 0, activeTodayCount)}
                  sub="Active today · Tap to view →"
                  color="#059669"
                  bg="#ECFDF5"
                />
              </div>
            </div>

            {/* Range highlight if filtered */}
            {stats?.rangeGenerations !== null && stats?.rangeGenerations !== undefined && (
              <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-4 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#6B7A90] uppercase tracking-wider">Filtered Period Metric</span>
                  <h4 className="text-xl font-black text-[#015BB3] mt-0.5">
                    {stats.rangeGenerations} Clippings · {stats.rangeActiveUsers ?? 0} Active Users
                  </h4>
                  <p className="text-xs text-[#6B7A90] mt-0.5">
                    From {formatDate(stats.fromDate || fromDate)} to {formatDate(stats.toDate || toDate)}
                  </p>
                </div>
                <button
                  onClick={() => handleDatePreset('all')}
                  className="text-xs font-bold text-[#015BB3] underline active:opacity-70"
                >
                  Clear Filter
                </button>
              </div>
            )}

            {/* Quick Actions Card */}
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#0A2540] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#015BB3]" />
                <span>Quick Operations</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setUserFilter('active_today');
                    setActiveTab('users');
                  }}
                  className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-left hover:bg-emerald-100/60 transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-emerald-950">Active Reporters</p>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5 font-medium">
                      {activeTodayCount} online / generating today
                    </p>
                  </div>
                  <Activity className="w-4 h-4 text-emerald-600" />
                </button>

                <button
                  onClick={() => {
                    setUserFilter('all');
                    setActiveTab('users');
                  }}
                  className="p-3 rounded-xl bg-[#E8F2FC] border border-[#D0E2F7] text-left hover:bg-[#D6E9FF] transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-[#0A2540]">Manage Users & Roles</p>
                    <p className="text-[11px] text-[#6B7A90] mt-0.5">Promote, demote or ban users</p>
                  </div>
                  <Users className="w-4 h-4 text-[#015BB3]" />
                </button>

                <button
                  onClick={() => setActiveTab('clippings')}
                  className="p-3 rounded-xl bg-[#E8F2FC] border border-[#D0E2F7] text-left hover:bg-[#D6E9FF] transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-[#0A2540]">Review Clippings</p>
                    <p className="text-[11px] text-[#6B7A90] mt-0.5">Browse news generation feed</p>
                  </div>
                  <Newspaper className="w-4 h-4 text-[#015BB3]" />
                </button>

                {isSuperAdmin && (
                  <button
                    onClick={() => { setActiveTab('logos'); setShowLogoForm(true); }}
                    className="p-3 rounded-xl bg-[#E8F2FC] border border-[#D0E2F7] text-left hover:bg-[#D6E9FF] transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#0A2540]">Add Publication Logo</p>
                      <p className="text-[11px] text-[#6B7A90] mt-0.5">Upload new masthead logo</p>
                    </div>
                    <Plus className="w-4 h-4 text-[#015BB3]" />
                  </button>
                )}
              </div>
            </div>

            {/* System Status */}
            <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-[#0A2540]">Production Engine Active</span>
              </div>
              <span className="text-[#6B7A90]">Backend v1.0 · Supabase Secure RLS</span>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: CLIPPINGS                                                     */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'clippings' && (
          <div className="space-y-4">
            {/* District Admin Scope Banner */}
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#015BB3] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#0A2540]">
                      {currentAdminDistrict && !isSuperAdmin
                        ? `${currentAdminDistrict} District Admin Review`
                        : 'District Clippings Review & Approvals'}
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-[#015BB3] uppercase tracking-wider">
                      {isSuperAdmin ? 'Superadmin Scope' : 'District Admin (Exclusive)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7A90] mt-0.5">
                    {currentAdminDistrict && !isSuperAdmin
                      ? `Clippings submitted by reporters in ${currentAdminDistrict} require your approval before appearing on the public feed. (1 Admin per District)`
                      : !isSuperAdmin
                      ? 'No district assigned to your account. Contact superadmin to assign your district.'
                      : 'Review and approve clippings submitted by reporters across districts before they go live on the public feed.'}
                  </p>
                </div>
              </div>

              {/* District Filter Dropdown (Superadmin) or Fixed District Badge (District Admin) */}
              {isSuperAdmin ? (
                <div className="flex items-center gap-2 self-stretch md:self-auto">
                  <span className="text-xs font-bold text-[#0A2540] shrink-0">District:</span>
                  <select
                    value={adminDistrictFilter}
                    onChange={(e) => setAdminDistrictFilter(e.target.value)}
                    className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl px-3 py-1.5 text-xs font-bold text-[#0A2540] focus:outline-none"
                  >
                    <option value="all">📍 All Districts</option>
                    <optgroup label="Telangana">
                      {TELANGANA_DISTRICTS_LIST.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Andhra Pradesh">
                      {ANDHRA_DISTRICTS_LIST.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#015BB3] text-xs font-bold shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{currentAdminDistrict ? `${currentAdminDistrict} (Assigned)` : 'No District Assigned'}</span>
                </div>
              )}
            </div>

            {!isSuperAdmin && !currentAdminDistrict && !adminDistrictLoading && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-center shadow-xs">
                <MapPin className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-amber-900">No District Assigned to Your Admin Account</h4>
                <p className="text-xs text-amber-800 mt-1 max-w-md mx-auto">
                  Every district in Spot News is assigned to exactly one administrator. Your account has not yet been assigned to a district by the Superadmin. Once assigned, you will receive news submitted by reporters in your district for approval.
                </p>
              </div>
            )}

            {/* Approval Status Filters & Search Bar */}
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setClippingApprovalFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    clippingApprovalFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-[#E8F2FC] text-[#415A77] hover:bg-[#D6E9FF]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Approval ({pendingClippingsCount})</span>
                </button>

                <button
                  onClick={() => setClippingApprovalFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    clippingApprovalFilter === 'approved'
                      ? 'bg-[#059669] text-white shadow-xs'
                      : 'bg-[#E8F2FC] text-[#415A77] hover:bg-[#D6E9FF]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Live on Feed</span>
                </button>

                <button
                  onClick={() => setClippingApprovalFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    clippingApprovalFilter === 'rejected'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-[#E8F2FC] text-[#415A77] hover:bg-[#D6E9FF]'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Rejected</span>
                </button>

                <button
                  onClick={() => setClippingApprovalFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    clippingApprovalFilter === 'all'
                      ? 'bg-[#015BB3] text-white shadow-xs'
                      : 'bg-[#E8F2FC] text-[#415A77] hover:bg-[#D6E9FF]'
                  }`}
                >
                  All Clippings
                </button>
              </div>

              {/* Search & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-[#8FA3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search headline, reporter, district..."
                    value={clippingsSearch}
                    onChange={(e) => setClippingsSearch(e.target.value)}
                    className="w-full bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#0A2540] placeholder-[#8FA3B8] focus:outline-none focus:border-[#015BB3]"
                  />
                </div>

                <button
                  onClick={() => fetchClippings(fromDate || undefined, toDate || undefined)}
                  disabled={clippingsLoading}
                  className="px-3 py-1.5 rounded-xl bg-[#015BB3] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${clippingsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh ({clippingsTotal || clippings.length})</span>
                </button>
              </div>
            </div>

            {/* Clippings List */}
            {clippingsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#015BB3] border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#6B7A90] font-bold">Loading clippings…</p>
              </div>
            ) : filteredClippings.length === 0 ? (
              <div className="bg-white border border-[#D0E2F7] rounded-2xl p-10 text-center shadow-sm">
                <Newspaper className="w-12 h-12 text-[#8FA3B8] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-[#0A2540]">
                  {clippingApprovalFilter === 'pending'
                    ? 'No Clippings Pending Approval'
                    : 'No clippings found matching criteria'}
                </p>
                <p className="text-xs text-[#6B7A90] mt-1">
                  {clippingApprovalFilter === 'pending'
                    ? 'When reporters submit clippings from their device, they will show up here for District Admin review.'
                    : 'Try selecting a different filter or clearing search terms.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredClippings.map((clip) => {
                  const isPending = clip.status === 'pending_approval' || (!clip.is_posted && clip.status !== 'rejected');
                  const isApproved = clip.is_posted === true || clip.status === 'approved';
                  const isRejected = clip.status === 'rejected';

                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClippingModal(clip)}
                      className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm hover:border-[#015BB3] transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                    >
                      <div>
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] uppercase tracking-wider">
                              {clip.publication_name || 'Spot News'}
                            </span>
                            {clip.district && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />
                                <span>{clip.district}</span>
                              </span>
                            )}
                          </div>

                          {/* Approval Status Badge */}
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isRejected
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {isApproved ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Live on Feed</span>
                              </>
                            ) : isPending ? (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>Pending Approval</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                <span>Rejected</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Thumbnail & Headline Row */}
                        <div className="flex items-start gap-3 mb-2">
                          {clip.png_url && (
                            <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-100 border border-[#D0E2F7] shrink-0">
                              <img src={clip.png_url} alt="Thumbnail" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-[#0A2540] line-clamp-2 leading-snug group-hover:text-[#015BB3] transition-colors">
                              {clip.headline || 'Untitled Clipping'}
                            </h4>
                            <p className="text-[11px] text-[#8FA3B8] mt-1">
                              Submitted {timeAgo(clip.created_at)}
                            </p>
                          </div>
                        </div>

                        {/* Who Generated It: Reporter Card */}
                        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-2">
                          <div className="w-7 h-7 rounded-full bg-[#E0F2FE] border border-[#015BB3]/30 text-[#015BB3] font-bold text-xs flex items-center justify-center shrink-0">
                            {(clip.user_name || clip.user_email || 'R').substring(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#0A2540] truncate">
                              {clip.user_name || 'Reporter'}
                            </p>
                            <p className="text-[10px] text-[#6B7A90] truncate">
                              {clip.user_email}
                            </p>
                          </div>
                          {clip.user_plan && <PlanBadge plan={clip.user_plan} />}
                        </div>
                      </div>

                      {/* Card Footer & Direct Action Buttons */}
                      <div className="space-y-2 pt-2 border-t border-[#E8F2FC]">
                        {isPending ? (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleApproveClipping(clip)}
                              disabled={actionLoadingId === clip.id}
                              className="flex-1 py-2 px-3 bg-[#059669] hover:bg-[#047857] active:scale-[0.98] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              {actionLoadingId === clip.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Approve & Post to Feed</span>
                            </button>

                            <button
                              onClick={() => handleRejectClipping(clip)}
                              disabled={actionLoadingId === clip.id}
                              className="py-2 px-3 bg-white border border-[#CBD5E1] text-[#DC2626] hover:bg-red-50 active:scale-[0.98] text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] text-[#8FA3B8]">{formatDateTime(clip.created_at)}</span>
                            <span className="font-bold text-[#015BB3] flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Full Preview</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: USERS                                                         */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Sort Bar */}
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8FA3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email, name, role or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0A2540] placeholder-[#8FA3B8] focus:outline-none focus:border-[#015BB3]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl px-2.5 py-2 text-xs text-[#0A2540] font-bold focus:outline-none"
                >
                  <option value="created_at">Joined Date</option>
                  <option value="email">Email</option>
                  <option value="role">Role</option>
                  <option value="total_generations">Most Clippings</option>
                </select>

                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="p-2 rounded-xl bg-[#E8F2FC] border border-[#D0E2F7] text-[#0A2540] hover:bg-[#D6E9FF]"
                  title="Toggle sort direction"
                >
                  {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setUserFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  userFilter === 'all'
                    ? 'bg-[#015BB3] text-white shadow-xs'
                    : 'bg-white text-[#415A77] border border-[#D0E2F7] hover:bg-[#E8F2FC]'
                }`}
              >
                All Users ({users.length})
              </button>

              <button
                onClick={() => setUserFilter('active_today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                  userFilter === 'active_today'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Today ({activeTodayCount})</span>
              </button>

              <button
                onClick={() => setUserFilter('reporter')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  userFilter === 'reporter'
                    ? 'bg-[#015BB3] text-white shadow-xs'
                    : 'bg-white text-[#415A77] border border-[#D0E2F7] hover:bg-[#E8F2FC]'
                }`}
              >
                Reporters ({reportersCount})
              </button>

              <button
                onClick={() => setUserFilter('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  userFilter === 'admin'
                    ? 'bg-[#015BB3] text-white shadow-xs'
                    : 'bg-white text-[#415A77] border border-[#D0E2F7] hover:bg-[#E8F2FC]'
                }`}
              >
                Admins ({adminsCount})
              </button>

              {bannedCount > 0 && (
                <button
                  onClick={() => setUserFilter('banned')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    userFilter === 'banned'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                  }`}
                >
                  Blocked ({bannedCount})
                </button>
              )}
            </div>

            {/* Empty State if no users match */}
            {!usersError && filteredUsers.length === 0 && (
              <div className="bg-white border border-[#D0E2F7] rounded-2xl p-8 text-center">
                <Users className="w-8 h-8 text-[#8FA3B8] mx-auto mb-2" />
                <h4 className="text-sm font-bold text-[#0A2540]">No users found</h4>
                <p className="text-xs text-[#6B7A90] mt-1">
                  {userFilter === 'active_today'
                    ? 'No reporters have logged in or generated clippings today yet.'
                    : 'Try changing your search query or filter.'}
                </p>
                {userFilter !== 'all' && (
                  <button
                    onClick={() => setUserFilter('all')}
                    className="mt-3 px-4 py-1.5 rounded-xl bg-[#015BB3] text-white text-xs font-bold shadow-xs active:scale-95"
                  >
                    View All Users ({users.length})
                  </button>
                )}
              </div>
            )}

            {/* Users List */}
            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const isSuper = isSuperAdminUser(u);
                const isSelf = Boolean(
                  (user?.email && u.email && user.email.toLowerCase() === u.email.toLowerCase()) ||
                  (user?.phone_number && u.phone_number && user.phone_number === u.phone_number)
                );
                const isPhoneAccount = Boolean(
                  (u.email && u.email.endsWith('@phone.user')) ||
                  (!u.email && u.phone_number)
                );
                return (
                  <div
                    key={u.id}
                    className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#D6E9FF] border border-[#015BB3]/30 flex items-center justify-center font-bold text-[#015BB3] shrink-0 text-sm relative">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (u.full_name && !u.full_name.startsWith('User ') ? u.full_name : (u.phone_number ? u.phone_number.slice(-4) : (u.email || 'U'))).substring(0, 2).toUpperCase()
                        )}
                        {u.is_active_today && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs"
                            title="Active Today"
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-[#0A2540] truncate">
                            {u.full_name || (u.phone_number ? `User (${u.phone_number})` : 'Reporter')}
                          </h4>
                          <RoleBadge role={isSuper ? 'superadmin' : u.role} />
                          {u.role === 'admin' && !isSuper && (
                            u.district ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 shadow-2xs">
                                <MapPin className="w-2.5 h-2.5" />
                                <span>{u.district} Admin</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1 shadow-2xs">
                                ⚠️ No District Assigned
                              </span>
                            )
                          )}
                          <PlanBadge plan={u.plan} />

                          {u.is_active_today && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Today
                            </span>
                          )}

                          {Boolean((u.generations_today ?? 0) > 0) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              ⚡ {u.generations_today} clipping{(u.generations_today ?? 0) > 1 ? 's' : ''} today
                            </span>
                          )}

                          {u.is_banned && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">
                              Blocked
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {isPhoneAccount ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              📱 Mobile OTP
                            </span>
                          ) : (
                            <p className="text-xs text-[#6B7A90] truncate">{u.email}</p>
                          )}
                          {u.phone_number && (
                            <span className="text-[11px] font-semibold text-[#015BB3] bg-[#E8F2FC] border border-[#D0E2F7] px-2 py-0.5 rounded-md">
                              📞 {u.phone_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#8FA3B8] mt-0.5 flex-wrap">
                          <span>Joined {formatDate(u.created_at)}</span>
                          {u.last_sign_in_at && (
                            <span className="text-[#015BB3] font-medium">
                              · Last active: {formatDate(u.last_sign_in_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Clippings Generated Per User Badge */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setClippingsSearch(isPhoneAccount ? (u.phone_number || u.full_name || '') : u.email);
                        setActiveTab('clippings');
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 text-[#015BB3] hover:border-[#015BB3] hover:shadow-xs transition-all cursor-pointer group shrink-0 self-start md:self-center"
                      title={`View clippings generated by ${u.full_name || u.email || u.phone_number}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#015BB3] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Newspaper className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#0A2540]">
                            {u.total_generations ?? 0}
                          </span>
                          <span className="text-xs font-bold text-[#6B7A90]">
                            {(u.total_generations ?? 0) === 1 ? 'Clipping' : 'Clippings'}
                          </span>
                          {(u.generations_today ?? 0) > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                              +{u.generations_today} today
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#015BB3] font-semibold group-hover:underline">
                          View clippings →
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      {!isSuper && (
                        <>
                          <button
                            onClick={() => startEdit(u)}
                            className="px-3 py-1.5 rounded-xl bg-[#E8F2FC] text-[#015BB3] border border-[#D0E2F7] text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleBanToggle(u)}
                            disabled={actionLoadingId === u.id}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border active:scale-95 transition-transform ${
                              u.is_banned
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{u.is_banned ? 'Unblock' : 'Block'}</span>
                          </button>

                          {isSuperAdmin && !isSelf && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={actionLoadingId === u.id}
                              className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-95"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB: APPLICATIONS                                                    */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'applications' && isSuperAdmin && (
          <div className="space-y-4">
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0A2540]">Reporter Requests</h3>
                <p className="text-xs text-[#6B7A90] mt-0.5">Review and approve or reject new reporter registrations</p>
              </div>
              <button
                onClick={() => fetchApplications()}
                disabled={applicationsLoading}
                className="px-3 py-2 rounded-xl bg-[#015BB3] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${applicationsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {applicationsLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#015BB3] border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#6B7A90] font-bold">Loading applications…</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-white border border-[#D0E2F7] rounded-2xl p-10 text-center shadow-sm">
                <FileText className="w-12 h-12 text-[#8FA3B8] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-[#0A2540]">No Applications Found</p>
                <p className="text-xs text-[#6B7A90] mt-1">There are currently no reporter applications to review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {applications.map((app) => (
                  <div key={app.id} className="bg-white border border-[#D0E2F7] rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      {/* Header Badge & Title */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EBF3FB] text-[#0B4EA2] text-[10px] font-black tracking-wider uppercase">
                          SUPER ADMIN / APPLICATIONS
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          app.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {app.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-[#0A2540]">Review reporter</h4>
                        <p className="text-xs text-[#6B7A90] mt-0.5">Check the reporter's details before approving access to payment.</p>
                      </div>

                      {/* Card 1: Reporter Application Details */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A90]">Reporter application</span>
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            EMAIL VERIFIED
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-[#0A2540]">{app.name}</p>
                          <p className="text-xs text-[#0B4EA2] font-semibold">{app.email}</p>
                          <p className="text-xs text-[#6B7A90] mt-0.5">
                            Mobile: <span className="font-semibold text-[#0A2540]">{app.phone}</span> • from application
                          </p>
                          <p className="text-xs text-[#6B7A90]">
                            {app.district || 'Reporting Centre'}{app.state ? `, ${app.state}` : ''}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/60 text-[11px] text-[#6B7A90]">
                          <div><span className="font-medium text-slate-400">Aadhar:</span> {app.aadhar_card}</div>
                          <div><span className="font-medium text-slate-400">Press ID:</span> {app.press_id}</div>
                        </div>
                      </div>

                      {/* Card 2: What approval does */}
                      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5 space-y-1">
                        <span className="text-xs font-bold text-[#0B4EA2] block">What approval does</span>
                        <p className="text-[11.5px] text-[#415A77] leading-relaxed">
                          The reporter can proceed to payment. Publishing and ID card access stay locked until payment is verified.
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {app.status === 'pending' ? (
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-[#E8F2FC]">
                        <button
                          onClick={() => handleApplicationStatus(app.id, app.email, 'approved')}
                          className="w-full sm:flex-1 py-2.5 px-3 bg-[#0B4EA2] hover:bg-[#093F84] active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" /> Approve email & enable payment
                        </button>
                        <button
                          onClick={() => handleApplicationStatus(app.id, app.email, 'rejected')}
                          className="w-full sm:w-auto py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#64748B] hover:bg-slate-50 active:scale-[0.99] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-4 h-4" /> Request corrections
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-[#E8F2FC] flex items-center justify-between text-xs text-[#6B7A90]">
                        <span>Updated: {formatDate(app.updated_at || app.created_at)}</span>
                        {app.status === 'approved' && (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            Payment Enabled
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: PUBLICATION LOGOS (Superadmin Only)                           */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logos' && isSuperAdmin && (
          <div className="space-y-4">
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0A2540]">Brand Publication Logos</h3>
                <p className="text-xs text-[#6B7A90] mt-0.5">Manage masthead logos available to reporters during news generation</p>
              </div>
              <button
                onClick={() => { resetLogoForm(); setShowLogoForm(true); }}
                className="px-4 py-2 rounded-xl bg-[#015BB3] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Logo</span>
              </button>
            </div>

            {/* Logo Form (when visible) */}
            {showLogoForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#0A2540]">
                    {editingLogoId ? 'Edit Publication Logo' : 'New Publication Logo'}
                  </h4>
                  <button onClick={resetLogoForm} className="text-[#6B7A90] hover:text-[#0A2540]">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {logoFormError && (
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{logoFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Publication Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Spot News 24x7"
                      value={logoName}
                      onChange={(e) => setLogoName(e.target.value)}
                      className="w-full bg-white border border-[#D0E2F7] rounded-xl px-3 py-2 text-xs text-[#0A2540] focus:outline-none focus:border-[#015BB3]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Publication Code (Key)</label>
                    <input
                      type="text"
                      placeholder="e.g. spot_news"
                      value={logoCode}
                      onChange={(e) => setLogoCode(e.target.value)}
                      className="w-full bg-white border border-[#D0E2F7] rounded-xl px-3 py-2 text-xs text-[#0A2540] focus:outline-none focus:border-[#015BB3]"
                    />
                  </div>
                </div>

                {/* Upload or URL */}
                <div>
                  <label className="block text-xs font-bold text-[#0A2540] mb-1">Logo Artwork</label>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setShowManualUrl(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${!showManualUrl ? 'bg-[#015BB3] text-white' : 'bg-white text-[#6B7A90]'}`}
                    >
                      File Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualUrl(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${showManualUrl ? 'bg-[#015BB3] text-white' : 'bg-white text-[#6B7A90]'}`}
                    >
                      Image URL
                    </button>
                  </div>

                  {!showManualUrl ? (
                    <div
                      onClick={() => logoFileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#D0E2F7] rounded-xl p-4 text-center cursor-pointer bg-white hover:border-[#015BB3] transition-all"
                    >
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleLogoFileSelect(e.target.files[0])}
                      />
                      <UploadCloud className="w-6 h-6 text-[#015BB3] mx-auto mb-1" />
                      <p className="text-xs font-bold text-[#0A2540]">
                        {logoFile ? logoFile.name : 'Click to select logo image'}
                      </p>
                      <p className="text-[10px] text-[#8FA3B8]">PNG, JPG or SVG up to 5MB</p>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => { setLogoUrl(e.target.value); setLogoPreview(e.target.value); }}
                      className="w-full bg-white border border-[#D0E2F7] rounded-xl px-3 py-2 text-xs text-[#0A2540] focus:outline-none focus:border-[#015BB3]"
                    />
                  )}

                  {logoPreview && (
                    <div className="mt-2 p-2 bg-white rounded-xl border border-[#D0E2F7] inline-block">
                      <img src={logoPreview} alt="Preview" className="h-12 w-auto object-contain max-w-[140px]" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={resetLogoForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-[#6B7A90] border border-[#D0E2F7]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveLogo}
                    disabled={logoFormLoading}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#015BB3] text-white shadow-sm flex items-center gap-1.5"
                  >
                    {logoFormLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Logo</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Logos Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {logos.map((logo) => (
                <div
                  key={logo.id}
                  className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-xl bg-[#E8F2FC] border border-[#D0E2F7] p-1 flex items-center justify-center shrink-0">
                      <img src={logo.logo_url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0A2540]">{logo.name}</h4>
                      <p className="text-xs text-[#6B7A90]">Code: <code>{logo.publication_code}</code></p>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${logo.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        {logo.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleLogo(logo.id, logo.is_active)}
                      className="p-1.5 rounded-lg bg-[#E8F2FC] text-[#0A2540] hover:bg-[#D6E9FF]"
                      title={logo.is_active ? 'Disable' : 'Enable'}
                    >
                      {logo.is_active ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button
                      onClick={() => handleDeleteLogo(logo.id, logo.name)}
                      className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB: DAILY NEWSPAPER EDITIONS                                         */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'daily_editions' && isSuperAdmin && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#0A2540] to-[#0F3459] text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-amber-400" />
                  Daily Newspaper Editions
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Generated A3 BroadSheet Daily Newspaper PDF History & Snapshots
                </p>
              </div>
              <button
                onClick={() => setIsPdfGeneratorOpen(true)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Generate New Edition
              </button>
            </div>

            {dailyEditionsLoading ? (
              <div className="p-8 text-center text-xs font-bold text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0A2540]" />
                Loading daily editions history...
              </div>
            ) : dailyEditions.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white space-y-3">
                <Newspaper className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No Daily Editions Generated Yet</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click "Generate New Edition" to select published reporter clippings, configure logo branding, and create pixel-perfect A3 broadsheet PDFs.
                </p>
                <button
                  onClick={() => setIsPdfGeneratorOpen(true)}
                  className="px-4 py-2 bg-[#0A2540] text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Generate First Daily Edition
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyEditions.map((ed) => (
                  <div
                    key={ed.id}
                    className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={ed.logo_url}
                            alt=""
                            className="h-7 max-w-[100px] object-contain"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <span className="text-xs font-black text-[#0A2540]">{ed.publication_name}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          v{ed.version} • {ed.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-500 font-bold block">EDITION DATE</span>
                          <span className="font-extrabold text-[#0A2540]">{ed.edition_date}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-500 font-bold block">PAGES & ARTICLES</span>
                          <span className="font-extrabold text-[#0A2540]">
                            {ed.page_count} Pages ({ed.article_count} Articles)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        {ed.created_at ? new Date(ed.created_at).toLocaleDateString() : ''}
                      </span>
                      {ed.pdf_url && (
                        <a
                          href={ed.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-[#0A2540] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-[#0A2540]/90"
                        >
                          <Download className="w-3.5 h-3.5" /> Download A3 PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB: PUSH NOTIFICATIONS                                              */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'notifications' && isSuperAdmin && (
          <div className="space-y-6">
            {/* Header & Stats Card */}
            <div className="bg-white border border-[#D0E2F7] rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                      <Bell className="w-5 h-5" />
                    </span>
                    <h3 className="text-lg font-bold text-[#0A2540]">Push Notifications Broadcast</h3>
                  </div>
                  <p className="text-xs text-[#6B7A90]">
                    Send real-time alerts directly to reader devices via Firebase Cloud Messaging (FCM).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchNotificationStats()}
                  disabled={notifStatsLoading}
                  className="px-3.5 py-2 rounded-xl bg-[#015BB3] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#015BB3]/90 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${notifStatsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Stats</span>
                </button>
              </div>

              {/* Stats badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-[#E8F2FC]">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#015BB3] flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#6B7A90] uppercase tracking-wider">Active Device Tokens</p>
                    <p className="text-lg font-black text-[#0A2540]">
                      {notifStatsLoading ? '...' : notifStats?.total_device_tokens ?? 0}
                    </p>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#6B7A90] uppercase tracking-wider">Registered Users</p>
                    <p className="text-lg font-black text-[#0A2540]">
                      {notifStatsLoading ? '...' : notifStats?.unique_registered_users ?? 0}
                    </p>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#6B7A90] uppercase tracking-wider">Districts Reached</p>
                    <p className="text-lg font-black text-[#0A2540]">
                      {notifStatsLoading ? '...' : Object.keys(notifStats?.tokens_by_district || {}).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Compose Card */}
            <div className="bg-white border border-[#D0E2F7] rounded-3xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-[#0A2540] mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-[#015BB3]" />
                <span>Compose New Alert</span>
              </h4>

              {/* Quick Preset Buttons */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-[#6B7A90] uppercase tracking-wider mb-2">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifTitle('🚨 బ్రేకింగ్ న్యూస్ | Spot News 24x7');
                      setNotifChannel('news');
                      setNotifUrl('/feed');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition"
                  >
                    🚨 బ్రేకింగ్ న్యూస్ (Breaking)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifTitle('🌦️ వాతావరణ హెచ్చరిక | Spot News 24x7');
                      setNotifChannel('weather');
                      setNotifUrl('/feed');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition"
                  >
                    🌦️ వాతావరణ హెచ్చరిక (Weather)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifTitle('📰 నేటి వార్తాపత్రిక సిద్ధంగా ఉంది!');
                      setNotifBody('ఈరోజు తాజా వార్తలతో కూడిన Spot News 24x7 ఈ-పేపర్‌ను ఇప్పుడు డౌన్‌లోడ్ చేసుకోండి.');
                      setNotifChannel('news');
                      setNotifUrl('/admin');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-bold transition"
                  >
                    📰 నేటి వార్తాపత్రిక (Daily Paper)
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendNotification} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-[#0A2540] mb-1">
                    Notification Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="e.g. బ్రేకింగ్: భారీ వర్ష సూచన / Breaking News"
                    required
                    className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-xs font-bold text-[#0A2540] mb-1">
                    Message Body <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    placeholder="Enter the alert text to display on the lock screen / notification drawer..."
                    rows={3}
                    required
                    className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                  />
                </div>

                {/* Target Audience & Channel Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Target Audience */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Target Audience</label>
                    <select
                      value={notifTargetType}
                      onChange={(e) => setNotifTargetType(e.target.value as any)}
                      className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                    >
                      <option value="all">📢 All Users (Topic: all)</option>
                      <option value="district">📍 Specific District (Topic: district_X)</option>
                      <option value="token">📱 Single Device Token (Direct)</option>
                    </select>
                  </div>

                  {/* Channel ID */}
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Notification Channel</label>
                    <select
                      value={notifChannel}
                      onChange={(e) => setNotifChannel(e.target.value as any)}
                      className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                    >
                      <option value="news">📰 బ్రేకింగ్ వార్తలు (News)</option>
                      <option value="weather">🌦️ వాతావరణ హెచ్చరికలు (Weather)</option>
                      <option value="reporter">🧑‍💼 రిపోర్టర్ అప్‌డేట్స్ (Reporter)</option>
                      <option value="general">📢 సాధారణ సమాచారం (General)</option>
                    </select>
                  </div>
                </div>

                {/* District Selector (conditional) */}
                {notifTargetType === 'district' && (
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Select Target District</label>
                    <select
                      value={notifDistrictId}
                      onChange={(e) => setNotifDistrictId(Number(e.target.value))}
                      className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                    >
                      {TELANGANA_DISTRICTS.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} (District ID: {d.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom Token (conditional) */}
                {notifTargetType === 'token' && (
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Target FCM Device Token</label>
                    <input
                      type="text"
                      value={notifCustomToken}
                      onChange={(e) => setNotifCustomToken(e.target.value)}
                      placeholder="Paste FCM registration token..."
                      className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                    />
                  </div>
                )}

                {/* Optional Image URL & Deep-link */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Target Screen URL / Deep Link</label>
                    <input
                      type="text"
                      value={notifUrl}
                      onChange={(e) => setNotifUrl(e.target.value)}
                      placeholder="e.g. /feed, /news, /admin"
                      className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0A2540] mb-1">Image URL (Optional)</label>
                    <input
                      type="url"
                      value={notifImageUrl}
                      onChange={(e) => setNotifImageUrl(e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full bg-[#F8FAFC] border border-[#D0E2F7] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0A2540] focus:outline-none focus:border-[#015BB3] transition"
                    />
                  </div>
                </div>

                {/* Send Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={notifSending}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#015BB3] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#015BB3]/90 disabled:opacity-50 transition"
                  >
                    <Send className={`w-4 h-4 ${notifSending ? 'animate-bounce' : ''}`} />
                    <span>{notifSending ? 'Dispatching Push Alert via Firebase...' : 'Send Broadcast Push Notification'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB: LOCAL ADS                                                       */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'local_ads' && (
          <LocalAdsAdminSection />
        )}

      </main>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT USER ROLE / PLAN                                         */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editingUserId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0A2540]/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#D0E2F7] rounded-3xl p-5 w-full max-w-sm shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0A2540]">Modify User Permissions</h3>
                <button onClick={cancelEdit} className="text-[#8FA3B8] hover:text-[#0A2540]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(() => {
                const targetUser = users.find((u) => u.id === editingUserId);
                if (!targetUser) return null;
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-[#6B7A90]">Target Account</p>
                      <p className="text-sm font-bold text-[#0A2540]">{targetUser.email}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0A2540] mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="e.g. +919876543210"
                        className="w-full bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl px-3 py-2 text-xs font-bold text-[#0A2540] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0A2540] mb-1">Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl px-3 py-2 text-xs font-bold text-[#0A2540] focus:outline-none"
                      >
                        <option value="user">User</option>
                        <option value="reporter">Reporter</option>
                        {isSuperAdmin && <option value="admin">Administrator</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0A2540] mb-1">Subscription Plan</label>
                      <select
                        value={editPlan}
                        onChange={(e) => setEditPlan(e.target.value)}
                        className="w-full bg-[#E8F2FC] border border-[#D0E2F7] rounded-xl px-3 py-2 text-xs font-bold text-[#0A2540] focus:outline-none"
                      >
                        <option value="free">Free</option>
                        <option value="reporter">Reporter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="admin">Admin Plan</option>
                      </select>
                    </div>

                    {isSuperAdmin && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-[#0A2540]">
                            Assigned District {editRole === 'admin' ? <span className="text-red-500">* (1 Admin per District)</span> : '(Optional)'}
                          </label>
                        </div>
                        <select
                          value={editDistrict}
                          onChange={(e) => setEditDistrict(e.target.value)}
                          className={`w-full bg-[#E8F2FC] border rounded-xl px-3 py-2 text-xs font-bold text-[#0A2540] focus:outline-none ${
                            editRole === 'admin' && !editDistrict ? 'border-amber-400 ring-1 ring-amber-400' : 'border-[#D0E2F7]'
                          }`}
                        >
                          <option value="">-- Select Assigned District --</option>
                          <optgroup label="Telangana Districts">
                            {TELANGANA_DISTRICTS_LIST.map((name) => {
                              const assigned = districtAdminMap[name.toLowerCase()];
                              const isTaken = assigned && assigned.id !== targetUser.id;
                              return (
                                <option
                                  key={name}
                                  value={name}
                                  disabled={Boolean(editRole === 'admin' && isTaken)}
                                  className={isTaken ? 'text-slate-400 bg-slate-50' : 'text-[#0A2540]'}
                                >
                                  {name} {isTaken ? `(🔒 Assigned: ${assigned.email || assigned.full_name})` : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                          <optgroup label="Andhra Pradesh Districts">
                            {ANDHRA_DISTRICTS_LIST.map((name) => {
                              const assigned = districtAdminMap[name.toLowerCase()];
                              const isTaken = assigned && assigned.id !== targetUser.id;
                              return (
                                <option
                                  key={name}
                                  value={name}
                                  disabled={Boolean(editRole === 'admin' && isTaken)}
                                  className={isTaken ? 'text-slate-400 bg-slate-50' : 'text-[#0A2540]'}
                                >
                                  {name} {isTaken ? `(🔒 Assigned: ${assigned.email || assigned.full_name})` : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        </select>
                        {editRole === 'admin' && editDistrict && districtAdminMap[editDistrict.trim().toLowerCase()] && districtAdminMap[editDistrict.trim().toLowerCase()].id !== targetUser.id && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1">
                            ⚠️ This district is already assigned to {districtAdminMap[editDistrict.trim().toLowerCase()].email || districtAdminMap[editDistrict.trim().toLowerCase()].full_name}. Every district will get one admin only.
                          </p>
                        )}
                        {editRole === 'admin' && !editDistrict && (
                          <p className="text-[11px] text-amber-600 font-medium mt-1">
                            ⚠️ Every district will get one admin only. Please select the district this admin will manage.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E8F2FC] text-[#6B7A90]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(targetUser)}
                        disabled={editSaving}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-[#015BB3] text-white flex items-center gap-1.5 shadow-sm"
                      >
                        {editSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CLIPPING DETAIL PREVIEW                                       */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedClippingModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#D0E2F7] rounded-3xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#D0E2F7] pb-3">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] uppercase">
                    {selectedClippingModal.publication_name || 'Spot News'}
                  </span>
                  <h3 className="text-base font-bold text-[#0A2540] mt-1 leading-snug">
                    {selectedClippingModal.headline}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedClippingModal(null)}
                  className="p-1 rounded-lg text-[#8FA3B8] hover:text-[#0A2540]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image preview */}
              {selectedClippingModal.png_url ? (
                <div className="rounded-2xl overflow-hidden border border-[#D0E2F7] bg-[#E8F2FC] max-h-72 flex items-center justify-center">
                  <img
                    src={selectedClippingModal.png_url}
                    alt="Clipping"
                    className="w-full h-auto max-h-72 object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-[#E8F2FC] text-center text-xs text-[#6B7A90]">
                  No thumbnail image URL recorded for this generation.
                </div>
              )}

              {/* Metadata chips */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#E8F2FC]">
                  <p className="text-[10px] text-[#8FA3B8] uppercase font-bold">Author</p>
                  <p className="font-bold text-[#0A2540] truncate">{selectedClippingModal.user_name} ({selectedClippingModal.user_email})</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#E8F2FC]">
                  <p className="text-[10px] text-[#8FA3B8] uppercase font-bold">District</p>
                  <p className="font-bold text-[#0A2540]">{selectedClippingModal.district || 'All Districts'}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#E8F2FC]">
                  <p className="text-[10px] text-[#8FA3B8] uppercase font-bold">Generated At</p>
                  <p className="font-bold text-[#0A2540]">{formatDateTime(selectedClippingModal.created_at)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#E8F2FC]">
                  <p className="text-[10px] text-[#8FA3B8] uppercase font-bold">Approval Status</p>
                  <p className="font-bold text-[#0A2540] capitalize">
                    {selectedClippingModal.is_posted
                      ? 'Live on Feed'
                      : selectedClippingModal.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending District Admin'}
                  </p>
                </div>
              </div>

              {/* Approval Actions inside Modal */}
              {(!selectedClippingModal.is_posted || selectedClippingModal.status === 'pending_approval') && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#D0E2F7]">
                  <button
                    onClick={() => handleApproveClipping(selectedClippingModal)}
                    disabled={actionLoadingId === selectedClippingModal.id}
                    className="flex-1 py-2.5 px-3 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {actionLoadingId === selectedClippingModal.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Approve & Post to Feed</span>
                  </button>
                  <button
                    onClick={() => handleRejectClipping(selectedClippingModal)}
                    disabled={actionLoadingId === selectedClippingModal.id}
                    className="py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#DC2626] hover:bg-red-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D0E2F7]">
                {selectedClippingModal.png_url && (
                  <a
                    href={selectedClippingModal.png_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E8F2FC] text-[#015BB3] border border-[#D0E2F7] flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Full PNG</span>
                  </a>
                )}
                {selectedClippingModal.pdf_url && (
                  <a
                    href={selectedClippingModal.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#015BB3] text-white flex items-center gap-1.5 shadow-xs"
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
    </div>
  );
};
