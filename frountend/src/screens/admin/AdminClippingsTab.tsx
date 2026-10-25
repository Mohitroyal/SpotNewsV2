import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Clock,
  CheckCircle2,
  X,
  Search,
  RefreshCw,
  Check,
  AlertTriangle,
  RotateCcw,
  Newspaper,
} from 'lucide-react';
import type { AdminClippingLog } from '@/services/admin.service';
import { AdminStatusBar } from './AdminStatusBar';

interface AdminClippingsTabProps {
  clippings: AdminClippingLog[];
  loading: boolean;
  totalCount: number;
  currentAdminDistrict?: string;
  isSuperAdmin?: boolean;
  onRefresh: () => void;
  onApprove: (clip: AdminClippingLog) => Promise<boolean>;
  onReject: (clip: AdminClippingLog, reason: string, note?: string) => Promise<boolean>;
  onUndoApprove?: (clipId: string) => Promise<void>;
  onRemoveFromFeed?: (clip: AdminClippingLog) => Promise<void>;
  onRestore?: (clip: AdminClippingLog) => Promise<void>;
  onSelectClippingModal: (clip: AdminClippingLog) => void;
}

const REJECTION_REASONS = [
  'Duplicate story',
  'Unverified or misleading',
  'Low quality',
  'Policy violation',
] as const;

function timeAgo(dateStr?: string) {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Pseudo-categories to match mockup if not present in payload
const CATEGORIES = ['RTI EXPRESS', 'CITY LIVE', 'DISTRICT DESK', 'AGRI WATCH', 'LOCAL BEAT'];

function getCategoryForClip(clip: AdminClippingLog, index: number) {
  if (clip.publication_name && clip.publication_name.length > 2) {
    return clip.publication_name.toUpperCase();
  }
  return CATEGORIES[index % CATEGORIES.length];
}

export const AdminClippingsTab: React.FC<AdminClippingsTabProps> = ({
  clippings,
  loading,
  totalCount,
  currentAdminDistrict,
  isSuperAdmin,
  onRefresh,
  onApprove,
  onReject,
  onUndoApprove,
  onRemoveFromFeed,
  onRestore,
  onSelectClippingModal,
}) => {
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Reject Bottom Sheet Modal state
  const [rejectingClip, setRejectingClip] = useState<AdminClippingLog | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(REJECTION_REASONS[0]);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Bulk Approve Confirmation state
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Undo Toast state (lasts 4.5s)
  const [undoToast, setUndoToast] = useState<{
    clipId: string;
    headline: string;
    timerId: any;
  } | null>(null);

  // Filtered clippings
  const filteredList = useMemo(() => {
    return clippings.filter((c) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          (c.headline || '').toLowerCase().includes(q) ||
          (c.user_email || '').toLowerCase().includes(q) ||
          (c.user_name || '').toLowerCase().includes(q) ||
          (c.district || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // District scope if not superadmin
      if (currentAdminDistrict && !isSuperAdmin) {
        if ((c.district || '').toLowerCase() !== currentAdminDistrict.toLowerCase()) {
          return false;
        }
      }

      // Status
      const isApproved = c.is_posted === true || c.status === 'approved';
      const isPending = c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected');
      const isRejected = c.status === 'rejected';

      if (approvalFilter === 'pending') return isPending;
      if (approvalFilter === 'approved') return isApproved;
      if (approvalFilter === 'rejected') return isRejected;
      return true;
    });
  }, [clippings, searchQuery, currentAdminDistrict, isSuperAdmin, approvalFilter]);

  // Counts for filter chips
  const pendingCount = useMemo(() => {
    return clippings.filter((c) => {
      if (currentAdminDistrict && !isSuperAdmin) {
        if ((c.district || '').toLowerCase() !== currentAdminDistrict.toLowerCase()) return false;
      }
      return c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected');
    }).length;
  }, [clippings, currentAdminDistrict, isSuperAdmin]);

  const visibleList = filteredList.slice(0, page * pageSize);
  const visiblePendingItems = visibleList.filter(
    (c) => c.status === 'pending_approval' || (!c.is_posted && c.status !== 'rejected')
  );

  // Approve single handler with Undo toast trigger
  const handleApproveWithUndo = async (clip: AdminClippingLog) => {
    setActionLoadingId(clip.id);
    const success = await onApprove(clip);
    setActionLoadingId(null);

    if (success) {
      if (undoToast?.timerId) clearTimeout(undoToast.timerId);
      const timer = setTimeout(() => {
        setUndoToast(null);
      }, 4500);

      setUndoToast({
        clipId: clip.id,
        headline: clip.headline || 'Clipping',
        timerId: timer,
      });
    }
  };

  const handleUndo = async () => {
    if (!undoToast) return;
    if (undoToast.timerId) clearTimeout(undoToast.timerId);
    const id = undoToast.clipId;
    setUndoToast(null);
    if (onUndoApprove) {
      await onUndoApprove(id);
    }
  };

  // Open Reject Modal
  const openRejectModal = (clip: AdminClippingLog) => {
    setRejectingClip(clip);
    setSelectedReason(REJECTION_REASONS[0]);
    setRejectNote('');
  };

  const submitReject = async () => {
    if (!rejectingClip) return;
    setRejectSubmitting(true);
    await onReject(rejectingClip, selectedReason, rejectNote.trim() || undefined);
    setRejectSubmitting(false);
    setRejectingClip(null);
  };

  // Bulk Approve handler
  const handleBulkApprove = async () => {
    if (!confirmApproveAll) {
      setConfirmApproveAll(true);
      setTimeout(() => setConfirmApproveAll(false), 5000);
      return;
    }

    setBulkApproving(true);
    for (const clip of visiblePendingItems) {
      await onApprove(clip);
    }
    setBulkApproving(false);
    setConfirmApproveAll(false);
  };

  return (
    <div className="space-y-4">
      {/* ── Header Card with Pin Icon & District Admin Badge ── */}
      <div className="adm-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--adm-blue)] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[var(--adm-text-primary)]">
                District Clippings Review & Approvals
              </h2>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#dbeafe] text-[var(--adm-blue)] uppercase tracking-wider">
                DISTRICT ADMIN
              </span>
            </div>
            <p className="text-xs text-[var(--adm-text-muted)] mt-1 max-w-2xl leading-relaxed">
              Review and approve clippings submitted by reporters across districts before they go live on the public feed.
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Chips Bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setApprovalFilter('pending'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl flex items-center gap-2 cursor-pointer ${
            approvalFilter === 'pending'
              ? 'bg-[var(--adm-orange)] text-white adm-glow-orange'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Approval ({pendingCount})</span>
        </button>

        <button
          onClick={() => { setApprovalFilter('approved'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl flex items-center gap-2 cursor-pointer ${
            approvalFilter === 'approved'
              ? 'bg-[var(--adm-green)] text-white adm-glow-green'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Live on Feed</span>
        </button>

        <button
          onClick={() => { setApprovalFilter('rejected'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl flex items-center gap-2 cursor-pointer ${
            approvalFilter === 'rejected'
              ? 'bg-[var(--adm-red)] text-white shadow-md'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          <X className="w-3.5 h-3.5" />
          <span>Rejected</span>
        </button>

        <button
          onClick={() => { setApprovalFilter('all'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl flex items-center gap-2 cursor-pointer ${
            approvalFilter === 'all'
              ? 'bg-[var(--adm-blue)] text-white adm-glow-blue'
              : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
          }`}
        >
          All Clippings
        </button>
      </div>

      {/* ── Search & Refresh Bar ── */}
      <div className="adm-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--adm-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search headline, reporter, district..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--adm-text-primary)] placeholder-[var(--adm-text-muted)] focus:outline-none focus:border-[var(--adm-blue)]"
          />
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[var(--adm-blue)] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh ( {totalCount || clippings.length} )</span>
        </button>
      </div>

      {/* ── Approve All Visible (Only in Pending view) ── */}
      {approvalFilter === 'pending' && visiblePendingItems.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproving}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer ${
              confirmApproveAll
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-[var(--adm-green)] hover:bg-[#047857] text-white'
            }`}
          >
            {bulkApproving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>
              {confirmApproveAll
                ? `Click again to confirm (${visiblePendingItems.length})`
                : `Approve all visible (${visiblePendingItems.length})`}
            </span>
          </button>
        </div>
      )}

      {/* ── Clippings Grid (2 Columns on Desktop) ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="adm-card p-5 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-[var(--adm-card-border)] rounded" />
                <div className="h-4 w-28 bg-[var(--adm-card-border)] rounded" />
              </div>
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-[var(--adm-card-border)] rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-full bg-[var(--adm-card-border)] rounded" />
                  <div className="h-4 w-3/4 bg-[var(--adm-card-border)] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visibleList.length === 0 ? (
        <div className="adm-card p-12 text-center space-y-3">
          <Newspaper className="w-12 h-12 text-[var(--adm-text-muted)] mx-auto opacity-40" />
          <h3 className="text-base font-bold text-[var(--adm-text-primary)]">
            {approvalFilter === 'pending'
              ? 'All caught up. Nothing is waiting for approval.'
              : 'No clippings found matching criteria'}
          </h3>
          <p className="text-xs text-[var(--adm-text-muted)] max-w-md mx-auto">
            {approvalFilter === 'pending'
              ? 'When district reporters submit news clippings, they will appear in this approval queue in real-time.'
              : 'Try clearing the search query or selecting a different status filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleList.map((clip, idx) => {
            const isApproved = clip.is_posted === true || clip.status === 'approved';
            const isPending = clip.status === 'pending_approval' || (!clip.is_posted && clip.status !== 'rejected');
            const isRejected = clip.status === 'rejected';

            const borderClass = isApproved
              ? 'adm-border-left-green'
              : isPending
              ? 'adm-border-left-orange'
              : 'adm-border-left-red';

            const category = getCategoryForClip(clip, idx);
            const reporterInitial = (clip.user_name || clip.user_email || 'U').charAt(0).toUpperCase();
            const planBadge = (clip.user_plan || 'free').toUpperCase();

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClippingModal(clip)}
                className={`adm-card ${borderClass} p-4.5 flex flex-col justify-between space-y-3 cursor-pointer hover:border-[var(--adm-blue)] transition-all`}
              >
                <div>
                  {/* Top Badges Row */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#dee9f5] text-[var(--adm-blue)] tracking-wider">
                      {category}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                        isApproved
                          ? 'bg-[#ecfdf5] text-[var(--adm-green)]'
                          : isPending
                          ? 'bg-[#fffbeb] text-[var(--adm-orange)]'
                          : 'bg-red-50 text-[var(--adm-red)]'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>LIVE ON FEED</span>
                        </>
                      ) : isPending ? (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>PENDING APPROVAL</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          <span>REJECTED</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Thumbnail & Telugu Headline */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-16 h-16 rounded-xl bg-[var(--adm-navy)] text-white flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {clip.png_url ? (
                        <img src={clip.png_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Newspaper className="w-7 h-7 text-white/80" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="adm-telugu text-sm font-bold text-[var(--adm-text-primary)] line-clamp-3 leading-snug">
                        {clip.headline || 'Untitled Story Headline'}
                      </h3>
                      <p className="text-[11px] text-[var(--adm-text-muted)] mt-1 font-medium">
                        {clip.district || 'Telangana'} · Submitted {timeAgo(clip.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Reporter Row */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--adm-chip-bg)]/50 border border-[var(--adm-card-border)] mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[var(--adm-blue)] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {reporterInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--adm-text-primary)] truncate">
                          {clip.user_name || 'Reporter'}
                        </p>
                        <p className="text-[10px] text-[var(--adm-text-muted)] truncate">
                          {clip.user_email || 'mobile account'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white dark:bg-[#14253d] text-[var(--adm-text-secondary)] border border-[var(--adm-card-border)] uppercase shrink-0">
                      {planBadge}
                    </span>
                  </div>

                  {/* Rejection Note Display if Rejected */}
                  {isRejected && (
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-xs text-[var(--adm-red)] font-medium">
                      ⚠️ Status: Rejected by District Admin
                    </div>
                  )}
                </div>

                {/* ── Actions on Card ── */}
                <div
                  className="pt-2 border-t border-[var(--adm-card-border)]/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveWithUndo(clip)}
                        disabled={actionLoadingId === clip.id}
                        className="flex-1 py-2 px-3 bg-[var(--adm-green)] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                      >
                        {actionLoadingId === clip.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Approve & Post to Feed</span>
                      </button>

                      <button
                        onClick={() => openRejectModal(clip)}
                        disabled={actionLoadingId === clip.id}
                        className="py-2 px-3.5 bg-white dark:bg-[#132742] border border-[var(--adm-card-border)] text-[var(--adm-red)] hover:bg-red-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : isApproved ? (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-[var(--adm-green)] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Published on Live Feed</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onUndoApprove && onUndoApprove(clip.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:text-[var(--adm-blue)] text-xs font-bold active:scale-95 transition cursor-pointer"
                          title="Undo approval and return clipping to pending review"
                        >
                          Undo Approval
                        </button>
                        <button
                          onClick={() => onRemoveFromFeed && onRemoveFromFeed(clip)}
                          className="px-2.5 py-1.5 rounded-xl border border-[var(--adm-card-border)] text-[var(--adm-red)] hover:bg-red-50 text-xs font-bold active:scale-95 transition cursor-pointer"
                          title="Remove from feed and mark as rejected"
                        >
                          Remove from feed
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-[var(--adm-red)] font-bold flex items-center gap-1">
                        <X className="w-3.5 h-3.5" />
                        <span>Rejected Submission</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => (onRestore ? onRestore(clip) : onUndoApprove && onUndoApprove(clip.id))}
                          className="px-3 py-1.5 rounded-xl bg-[var(--adm-chip-bg)] text-[var(--adm-blue)] text-xs font-bold hover:bg-[#d5e4f5] transition active:scale-95 cursor-pointer"
                          title="Restore to pending review queue"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handleApproveWithUndo(clip)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--adm-green)] text-white text-xs font-bold hover:bg-[#047857] transition active:scale-95 cursor-pointer"
                          title="Approve & Post to Live Feed"
                        >
                          Approve & Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination / Load More ── */}
      {visibleList.length < filteredList.length && (
        <div className="text-center pt-4 pb-2 space-y-2">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-2.5 rounded-xl border border-[var(--adm-blue)] text-[var(--adm-blue)] bg-white dark:bg-[#132742] text-xs font-bold hover:bg-[#e0f2fe] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            Load more clippings
          </button>
          <p className="text-[11px] text-[var(--adm-text-muted)] font-medium">
            Showing {visibleList.length} of {filteredList.length} clippings
          </p>
        </div>
      )}

      {/* ── Reject Bottom Sheet Modal ── */}
      <AnimatePresence>
        {rejectingClip && (
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setRejectingClip(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--adm-card-bg)] border border-[var(--adm-card-border)] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--adm-card-border)] pb-3">
                <div className="flex items-center gap-2 text-[var(--adm-red)]">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="text-base font-bold text-[var(--adm-text-primary)]">Reject Submission</h3>
                </div>
                <button
                  onClick={() => setRejectingClip(null)}
                  className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text-primary)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <p className="text-xs text-[var(--adm-text-muted)]">Clipping headline:</p>
                <p className="adm-telugu text-xs font-bold text-[var(--adm-text-primary)] mt-0.5 line-clamp-2">
                  {rejectingClip.headline}
                </p>
              </div>

              {/* Reason Chips */}
              <div>
                <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-2">
                  Select Rejection Reason:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {REJECTION_REASONS.map((reason) => {
                    const isSelected = selectedReason === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setSelectedReason(reason)}
                        className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-red-50 border-[var(--adm-red)] text-[var(--adm-red)] shadow-2xs'
                            : 'bg-[var(--adm-chip-bg)] border-transparent text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                        }`}
                      >
                        {reason}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-bold text-[var(--adm-text-primary)] mb-1">
                  Optional Note to Reporter:
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Provide additional details or guidance for the reporter..."
                  rows={3}
                  className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl p-3 text-xs text-[var(--adm-text-primary)] placeholder-[var(--adm-text-muted)] focus:outline-none focus:border-[var(--adm-blue)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--adm-card-border)]">
                <button
                  type="button"
                  onClick={() => setRejectingClip(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitReject}
                  disabled={rejectSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--adm-red)] hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {rejectSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Undo Toast (~4.5s) ── */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[250] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl bg-[var(--adm-navy)] text-white text-xs font-bold border border-white/20"
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--adm-green)] shrink-0" />
            <span className="truncate max-w-xs">Approved and posted to live feed</span>
            <button
              onClick={handleUndo}
              className="px-3 py-1 rounded-lg bg-[var(--adm-orange)] text-white text-xs font-extrabold flex items-center gap-1 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status Bar ── */}
      <AdminStatusBar />
    </div>
  );
};
