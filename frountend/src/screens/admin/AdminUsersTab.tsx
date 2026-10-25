import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Shield,
  Crown,
  Edit2,
  Ban,
  Newspaper,
  Mail,
  Smartphone,
  X,
  RefreshCw,
} from 'lucide-react';
import type { AdminUserProfile } from '@/services/admin.service';
import { AdminStatusBar } from './AdminStatusBar';

interface AdminUsersTabProps {
  users: AdminUserProfile[];
  loading: boolean;
  currentUserEmail?: string;
  isSuperAdmin?: boolean;
  onRefresh: () => void;
  onSaveUserEdit: (user: AdminUserProfile, newRole: string, newPlan: string, newPhone: string, newDistrict: string) => Promise<boolean>;
  onToggleBan: (user: AdminUserProfile) => Promise<boolean>;
  onViewUserClippings: (userIdentifier: string) => void;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Avatar initials generator
function getAvatarLetters(u: AdminUserProfile) {
  if (u.full_name && !u.full_name.startsWith('User ')) {
    const parts = u.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (u.phone_number) {
    const digits = u.phone_number.replace(/\D/g, '');
    return digits.slice(-2);
  }
  if (u.email) {
    return u.email.substring(0, 2).toUpperCase();
  }
  return 'US';
}

function getLoginMethod(u: AdminUserProfile) {
  if (u.email && u.email.endsWith('@phone.user')) {
    return { label: 'Mobile OTP', icon: Smartphone, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  if (u.email && u.email.includes('gmail')) {
    return { label: 'Google', icon: Mail, color: 'text-blue-700 bg-blue-50 border-blue-200' };
  }
  return { label: 'Email', icon: Mail, color: 'text-slate-700 bg-slate-50 border-slate-200' };
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  loading,
  currentUserEmail,
  isSuperAdmin,
  onRefresh,
  onSaveUserEdit,
  onToggleBan,
  onViewUserClippings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'last_sign_in_at' | 'full_name' | 'total_generations'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active_today' | 'reporter' | 'admin' | 'pro' | 'blocked'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<AdminUserProfile | null>(null);
  const [editRole, setEditRole] = useState('user');
  const [editPlan, setEditPlan] = useState('free');
  const [editPhone, setEditPhone] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filter counts
  const counts = useMemo(() => {
    return {
      all: users.length,
      activeToday: users.filter((u) => u.is_active_today).length,
      reporters: users.filter((u) => u.role === 'reporter').length,
      admins: users.filter((u) => u.role === 'admin' || u.role === 'superadmin').length,
      pro: users.filter((u) => (u.plan || '').toLowerCase() === 'pro').length,
      blocked: users.filter((u) => u.is_banned).length,
    };
  }, [users]);

  // Filtered & Sorted users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const qDigits = q.replace(/\D/g, '');
        const uPhoneDigits = (u.phone_number || '').replace(/\D/g, '');
        const uEmailDigits = (u.email || '').replace(/\D/g, '');
        const phoneMatch = qDigits.length >= 3 && (uPhoneDigits.includes(qDigits) || uEmailDigits.includes(qDigits));

        const matches =
          phoneMatch ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.phone_number || '').toLowerCase().includes(q) ||
          (u.district || '').toLowerCase().includes(q) ||
          (u.role || '').toLowerCase().includes(q) ||
          (u.plan || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filter chips
      if (activeFilter === 'active_today') return Boolean(u.is_active_today);
      if (activeFilter === 'reporter') return u.role === 'reporter';
      if (activeFilter === 'admin') return u.role === 'admin' || u.role === 'superadmin';
      if (activeFilter === 'pro') return (u.plan || '').toLowerCase() === 'pro';
      if (activeFilter === 'blocked') return Boolean(u.is_banned);
      return true;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'full_name') {
        aVal = a.full_name || a.email || '';
        bVal = b.full_name || b.email || '';
      }
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [users, searchQuery, activeFilter, sortField, sortAsc]);

  const visibleUsers = filteredUsers.slice(0, page * pageSize);

  const startEdit = (u: AdminUserProfile) => {
    setEditingUser(u);
    setEditRole(u.role || 'user');
    setEditPlan(u.plan || 'free');
    setEditPhone(u.phone_number || '');
    setEditDistrict(u.district || '');
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    const success = await onSaveUserEdit(editingUser, editRole, editPlan, editPhone, editDistrict);
    setEditSaving(false);
    if (success) {
      setEditingUser(null);
    }
  };

  const handleBan = async (u: AdminUserProfile) => {
    setActionLoadingId(u.id);
    await onToggleBan(u);
    setActionLoadingId(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Search and Sort Bar ── */}
      <div className="adm-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--adm-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by mobile number, email, name, role or plan..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--adm-text-primary)] placeholder-[var(--adm-text-muted)] focus:outline-none focus:border-[var(--adm-blue)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--adm-text-primary)] focus:outline-none cursor-pointer flex-1 sm:flex-none"
          >
            <option value="created_at">Joined date</option>
            <option value="last_sign_in_at">Last active</option>
            <option value="full_name">Name</option>
            <option value="total_generations">Clippings</option>
          </select>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="p-2.5 rounded-xl bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] text-[var(--adm-text-primary)] hover:bg-[#d5e4f5] transition cursor-pointer"
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] text-[var(--adm-text-primary)] hover:bg-[#d5e4f5] transition cursor-pointer"
            title="Refresh users list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filter Chips Bar with Counts ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => { setActiveFilter('all'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl shrink-0 cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-[var(--adm-blue)] text-white adm-glow-blue'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          All Users ({counts.all})
        </button>

        <button
          onClick={() => { setActiveFilter('active_today'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'active_today'
              ? 'bg-[var(--adm-green)] text-white adm-glow-green'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-green)] hover:bg-[#d5e4f5]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[var(--adm-green)] adm-live-dot" />
          <span>Active Today ({counts.activeToday})</span>
        </button>

        <button
          onClick={() => { setActiveFilter('reporter'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl shrink-0 cursor-pointer ${
            activeFilter === 'reporter'
              ? 'bg-[var(--adm-blue)] text-white adm-glow-blue'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          Reporters ({counts.reporters})
        </button>

        <button
          onClick={() => { setActiveFilter('admin'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl shrink-0 cursor-pointer ${
            activeFilter === 'admin'
              ? 'bg-[var(--adm-blue)] text-white adm-glow-blue'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          Admins ({counts.admins})
        </button>

        <button
          onClick={() => { setActiveFilter('pro'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl shrink-0 cursor-pointer ${
            activeFilter === 'pro'
              ? 'bg-[var(--adm-blue)] text-white adm-glow-blue'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          Pro ({counts.pro})
        </button>

        <button
          onClick={() => { setActiveFilter('blocked'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl shrink-0 cursor-pointer ${
            activeFilter === 'blocked'
              ? 'bg-[var(--adm-red)] text-white shadow-md'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-red)] hover:bg-[#d5e4f5]'
          }`}
        >
          Blocked ({counts.blocked})
        </button>
      </div>

      {/* ── User Cards Grid (2 Columns on Desktop) ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="adm-card p-5 animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-[var(--adm-card-border)] rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-[var(--adm-card-border)] rounded" />
                  <div className="h-3 w-48 bg-[var(--adm-card-border)] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className="adm-card p-12 text-center space-y-3">
          <Shield className="w-12 h-12 text-[var(--adm-text-muted)] mx-auto opacity-40" />
          <h3 className="text-base font-bold text-[var(--adm-text-primary)]">No users found</h3>
          <p className="text-xs text-[var(--adm-text-muted)] max-w-sm mx-auto">
            Try adjusting your search criteria or switching to a different filter chip.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleUsers.map((u) => {
            const isSuper = u.role === 'superadmin';
            const isAdmin = u.role === 'admin' || isSuper;
            const isReporter = u.role === 'reporter';
            const isBlocked = Boolean(u.is_banned);
            const isSelf = Boolean(
              currentUserEmail && u.email && currentUserEmail.toLowerCase() === u.email.toLowerCase()
            );

            // Left colored border
            const borderClass = isBlocked
              ? 'adm-border-left-red'
              : isAdmin
              ? 'adm-border-left-yellow'
              : isReporter
              ? 'adm-border-left-blue'
              : 'adm-border-left-blue';

            const initials = getAvatarLetters(u);
            const loginMethod = getLoginMethod(u);
            const LoginIcon = loginMethod.icon;

            return (
              <div
                key={u.id}
                className={`adm-card ${borderClass} p-5 flex flex-col justify-between space-y-4 ${
                  isBlocked ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200' : ''
                }`}
              >
                <div>
                  {/* Top Header Row with Avatar & Status Badges */}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#dee9f5] border-2 border-[var(--adm-blue)]/30 text-[var(--adm-blue)] font-black text-sm flex items-center justify-center">
                        {initials}
                      </div>
                      {u.is_active_today && (
                        <span
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--adm-green)] border-2 border-white dark:border-[#132742] rounded-full adm-live-dot"
                          title="Active Today"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-extrabold text-[var(--adm-text-primary)] truncate">
                          {u.full_name || (u.phone_number ? `User (${u.phone_number})` : 'Reporter')}
                        </h3>

                        {/* Role Badge */}
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                            isSuper
                              ? 'bg-[#ffb900] text-[#0a2540] shadow-xs'
                              : isAdmin
                              ? 'bg-[var(--adm-yellow)] text-[#0a2540]'
                              : isReporter
                              ? 'bg-[#dbeafe] text-[var(--adm-blue)]'
                              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)]'
                          }`}
                        >
                          {isSuper ? <Crown className="w-2.5 h-2.5" /> : isAdmin ? <Shield className="w-2.5 h-2.5" /> : null}
                          {isSuper ? 'SUPERADMIN' : isAdmin ? 'ADMIN' : (u.role || 'USER').toUpperCase()}
                        </span>

                        {/* Plan Badge */}
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] border border-[var(--adm-card-border)] uppercase">
                          {(u.plan || 'FREE').toUpperCase()}
                        </span>

                        {/* Active Today Tag */}
                        {u.is_active_today && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[var(--adm-green)] border border-[#a7f3d0]">
                            Active Today
                          </span>
                        )}

                        {/* Blocked Tag */}
                        {isBlocked && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-[var(--adm-red)] border border-red-300">
                            BLOCKED
                          </span>
                        )}
                      </div>

                      {/* Email, Login Method & Phone */}
                      <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
                        {u.email && !u.email.endsWith('@phone.user') && (
                          <p className="text-[var(--adm-text-muted)] truncate max-w-[200px]">{u.email}</p>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${loginMethod.color}`}>
                          <LoginIcon className="w-3 h-3" />
                          <span>{loginMethod.label}</span>
                        </span>
                        {u.phone_number && (
                          <span className="text-[10px] font-semibold text-[var(--adm-text-muted)]">
                            📞 {u.phone_number}
                          </span>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-2 text-[11px] text-[var(--adm-text-muted)] mt-1.5 flex-wrap">
                        {Boolean((u.generations_today ?? 0) > 0) && (
                          <span className="text-[10px] font-bold text-[var(--adm-blue)] bg-[#e0f2fe] px-1.5 py-0.2 rounded">
                            {u.generations_today} clipping today
                          </span>
                        )}
                        <span>Joined {formatDate(u.created_at)}</span>
                        {u.last_sign_in_at && (
                          <span>· Last active: {u.is_active_today ? 'Today' : formatDate(u.last_sign_in_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Clippings Box with Link ── */}
                  <div className="mt-3.5 p-3 rounded-xl bg-gradient-to-r from-[#f0f7ff] to-[#e8f2fc] dark:from-[#162e4f] dark:to-[#1a3559] border border-[var(--adm-card-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[var(--adm-blue)] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Newspaper className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[var(--adm-text-primary)]">
                            {u.total_generations ?? 0}
                          </span>
                          <span className="text-xs font-bold text-[var(--adm-text-secondary)]">
                            Clippings
                          </span>
                          {(u.generations_today ?? 0) > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[var(--adm-green)] text-white">
                              +{u.generations_today} today
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => onViewUserClippings(u.email || u.phone_number || u.id)}
                          className="text-[10px] font-bold text-[var(--adm-blue)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          View clippings →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Actions Row ── */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--adm-card-border)]/60">
                  {/* Edit button */}
                  <button
                    onClick={() => startEdit(u)}
                    disabled={isSelf}
                    className="px-3 py-1.5 rounded-xl border border-[var(--adm-card-border)] bg-white dark:bg-[#132742] text-[var(--adm-blue)] text-xs font-bold flex items-center gap-1.5 hover:bg-[var(--adm-chip-bg)] active:scale-95 transition cursor-pointer disabled:opacity-40"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  {/* Block / Unblock button (Admins cannot be blocked) */}
                  {!isAdmin && (
                    <button
                      onClick={() => handleBan(u)}
                      disabled={actionLoadingId === u.id}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border active:scale-95 transition cursor-pointer ${
                        isBlocked
                          ? 'bg-[#ecfdf5] text-[var(--adm-green)] border-[#a7f3d0] hover:bg-[#d1fae5]'
                          : 'bg-red-50 text-[var(--adm-red)] border-red-200 hover:bg-red-100'
                      }`}
                    >
                      {actionLoadingId === u.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                      <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination / Load More ── */}
      {visibleUsers.length < filteredUsers.length && (
        <div className="text-center pt-4 pb-2 space-y-2">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-2.5 rounded-xl border border-[var(--adm-blue)] text-[var(--adm-blue)] bg-white dark:bg-[#132742] text-xs font-bold hover:bg-[#e0f2fe] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            Load more users
          </button>
          <p className="text-[11px] text-[var(--adm-text-muted)] font-medium">
            Showing {visibleUsers.length} of {filteredUsers.length} users
          </p>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      <AnimatePresence>
        {editingUser && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--adm-card-bg)] border border-[var(--adm-card-border)] rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--adm-card-border)] pb-3">
                <h3 className="text-base font-bold text-[var(--adm-text-primary)]">Edit User Details</h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text-primary)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[var(--adm-text-muted)]">User Email:</p>
                  <p className="text-xs font-bold text-[var(--adm-text-primary)]">{editingUser.email}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--adm-text-primary)] focus:outline-none focus:border-[var(--adm-blue)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--adm-text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="user">User</option>
                    <option value="reporter">Reporter</option>
                    {isSuperAdmin && <option value="admin">Administrator</option>}
                    {isSuperAdmin && <option value="superadmin">Super Administrator</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">
                    Subscription Plan
                  </label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--adm-text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="free">Free</option>
                    <option value="reporter">Reporter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">
                    Assigned District
                  </label>
                  <input
                    type="text"
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    placeholder="e.g. Hyderabad, Warangal..."
                    className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--adm-text-primary)] focus:outline-none focus:border-[var(--adm-blue)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--adm-card-border)]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--adm-blue)] text-white flex items-center gap-1.5 shadow-sm hover:brightness-110 cursor-pointer"
                >
                  {editSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Status Bar ── */}
      <AdminStatusBar />
    </div>
  );
};
