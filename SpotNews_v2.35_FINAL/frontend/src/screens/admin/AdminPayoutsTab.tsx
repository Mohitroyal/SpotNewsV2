import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  Check,
  X,
  RefreshCw,
  Clock,
  Smartphone,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { redeemService, type RedeemRequest } from '@/services/redeem.service';

interface AdminPayoutsTabProps {
  isSuperAdmin?: boolean;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export const AdminPayoutsTab: React.FC<AdminPayoutsTabProps> = ({
  onShowToast,
}) => {
  const [requests, setRequests] = useState<RedeemRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await redeemService.fetchAllRedeemRequests();
      setRequests(data);
    } catch {
      onShowToast('Failed to load payout redemption requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (
    requestId: string,
    status: 'completed' | 'rejected'
  ) => {
    setActionLoadingId(requestId);
    try {
      const note = status === 'completed' ? 'Approved and paid by superadmin' : 'Rejected by superadmin';
      const res = await redeemService.updateRedeemStatus(requestId, status, note);
      if (res.success) {
        onShowToast(
          status === 'completed'
            ? 'Payout marked as paid and completed successfully!'
            : 'Payout request marked as rejected.',
          'success'
        );
        await fetchRequests();
      } else {
        onShowToast(res.error || 'Failed to update payout status', 'error');
      }
    } catch {
      onShowToast('Error updating payout request status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Filter tab
      if (filter !== 'all' && r.status !== filter) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          (r.user_name || '').toLowerCase().includes(q) ||
          (r.user_email || '').toLowerCase().includes(q) ||
          (r.user_phone || '').toLowerCase().includes(q) ||
          (r.target_account || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [requests, filter, searchQuery]);

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const completed = requests.filter((r) => r.status === 'completed');
    const totalPaid = completed.reduce((sum, r) => sum + (Number(r.amount_inr) || 0), 0);
    return { total, pending, totalPaid };
  }, [requests]);

  return (
    <div className="space-y-4">
      {/* ── Header & Summary Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="adm-card p-4.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--adm-text-muted)] uppercase tracking-wider">
              Total Redemptions
            </p>
            <h3 className="text-2xl font-black text-[var(--adm-text-primary)] mt-1">
              {stats.total}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[var(--adm-blue)] flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="adm-card p-4.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--adm-text-muted)] uppercase tracking-wider">
              Pending Payouts
            </p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">
              {stats.pending}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="adm-card p-4.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--adm-text-muted)] uppercase tracking-wider">
              Total Paid Out
            </p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              ₹{stats.totalPaid.toLocaleString('en-IN')}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="adm-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--adm-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by reporter name, phone, email, or UPI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--adm-text-primary)] placeholder-[var(--adm-text-muted)] focus:outline-none focus:border-[var(--adm-blue)]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
              filter === 'all'
                ? 'bg-[var(--adm-blue)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
            }`}
          >
            All ({requests.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
              filter === 'pending'
                ? 'bg-[var(--adm-orange)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-orange)] hover:bg-[#d5e4f5]'
            }`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
              filter === 'completed'
                ? 'bg-[var(--adm-green)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-green)] hover:bg-[#d5e4f5]'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
              filter === 'rejected'
                ? 'bg-[var(--adm-red)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-red)] hover:bg-[#d5e4f5]'
            }`}
          >
            Rejected
          </button>

          <button
            onClick={fetchRequests}
            disabled={loading}
            className="p-2 rounded-xl bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] text-[var(--adm-text-primary)] hover:bg-[#d5e4f5] transition cursor-pointer shrink-0"
            title="Refresh payout requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Requests List ── */}
      {loading && requests.length === 0 ? (
        <div className="adm-card p-12 text-center text-xs text-[var(--adm-text-muted)] animate-pulse">
          Loading redemption requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="adm-card p-12 text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-[var(--adm-text-muted)] mx-auto opacity-40" />
          <h4 className="text-sm font-bold text-[var(--adm-text-primary)]">No redemption requests found</h4>
          <p className="text-xs text-[var(--adm-text-muted)]">
            When reporters submit coin cashouts or recharge requests, they appear here for verification and payment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === 'pending';
            const isCompleted = req.status === 'completed';

            const borderClass = isCompleted
              ? 'adm-border-left-green'
              : isPending
              ? 'adm-border-left-orange'
              : 'adm-border-left-red';

            const isLoading = actionLoadingId === req.id;

            return (
              <div
                key={req.id}
                className={`adm-card ${borderClass} p-4.5 flex flex-col justify-between space-y-3.5`}
              >
                <div>
                  {/* Top row: Type & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#dee9f5] text-[var(--adm-blue)] uppercase tracking-wider flex items-center gap-1">
                      {req.redeem_type === 'upi' ? (
                        <>
                          <DollarSign className="w-3 h-3" />
                          <span>UPI CASH TRANSFER</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-3 h-3" />
                          <span>MOBILE RECHARGE</span>
                        </>
                      )}
                    </span>

                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPending
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {/* Amount & Coins */}
                  <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-[var(--adm-card-border)]/60">
                    <div>
                      <p className="text-2xl font-black text-[var(--adm-text-primary)]">
                        ₹{Number(req.amount_inr || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs font-semibold text-[var(--adm-text-muted)] mt-0.5">
                        {req.coins_redeemed} coins redeemed
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-[var(--adm-text-muted)]">Target Account</p>
                      <p className="text-xs font-mono font-bold text-[var(--adm-blue)]">
                        {req.target_account}
                      </p>
                    </div>
                  </div>

                  {/* Reporter Details Box */}
                  <div className="mt-3 bg-[var(--adm-chip-bg)]/60 border border-[var(--adm-card-border)] rounded-xl p-2.5 text-xs space-y-1">
                    <p className="font-bold text-[var(--adm-text-primary)]">
                      {req.user_name || 'Reporter'}
                    </p>
                    <p className="text-[11px] text-[var(--adm-text-muted)] truncate">
                      {req.user_email || '—'} {req.user_phone ? `· 📞 ${req.user_phone}` : ''}
                    </p>
                    <p className="text-[10px] text-[var(--adm-text-muted)]">
                      Requested: {new Date(req.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Actions row */}
                <div className="pt-2 border-t border-[var(--adm-card-border)] flex items-center justify-end gap-2">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'completed')}
                        disabled={isLoading}
                        className="flex-1 py-2 px-3 bg-[var(--adm-green)] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Mark Paid & Approve</span>
                      </button>

                      <button
                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                        disabled={isLoading}
                        className="py-2 px-3 bg-white dark:bg-[#132742] border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  ) : isCompleted ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Paid & Completed
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                      <X className="w-4 h-4" /> Rejected & Coins Refunded
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
