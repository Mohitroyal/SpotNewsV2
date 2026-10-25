import React, { useState, useEffect } from 'react';
import {
  DollarSign, CheckCircle2, XCircle, Clock,
  Smartphone, CreditCard, RefreshCw, AlertCircle,
  Search, Check, X
} from 'lucide-react';
import { redeemService, type RedeemRequest } from '@/services/redeem.service';

interface AdminRedemptionsTabProps {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const AdminRedemptionsTab: React.FC<AdminRedemptionsTabProps> = ({ showToast }) => {
  const [requests, setRequests] = useState<RedeemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Reject dialog state
  const [rejectingItem, setRejectingItem] = useState<RedeemRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('Invalid account or details provided.');

  const loadRequests = async () => {
    setLoading(true);
    const data = await redeemService.fetchAllRedeemRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleMarkCompleted = async (req: RedeemRequest) => {
    if (!window.confirm(`Confirm payment of ₹${req.amount_inr} to ${req.target_account} (${req.redeem_type === 'recharge' ? 'Recharge' : 'UPI'})?`)) {
      return;
    }
    setActionLoadingId(req.id);
    const res = await redeemService.updateRedeemStatus(req.id, 'completed');
    setActionLoadingId(null);

    if (res.success) {
      showToast(`Payout of ₹${req.amount_inr} marked as completed!`, 'success');
      loadRequests();
    } else {
      showToast(res.error || 'Failed to update status', 'error');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingItem) return;
    setActionLoadingId(rejectingItem.id);
    const res = await redeemService.updateRedeemStatus(rejectingItem.id, 'rejected', rejectReason.trim());
    setActionLoadingId(null);
    setRejectingItem(null);

    if (res.success) {
      showToast(`Request rejected. ${rejectingItem.coins_redeemed} coins refunded to user.`, 'success');
      loadRequests();
    } else {
      showToast(res.error || 'Failed to reject request', 'error');
    }
  };

  // KPIs
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const pendingAmount = requests
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount_inr || 0), 0);
  const completedAmount = requests
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + Number(r.amount_inr || 0), 0);

  // Filtered
  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (r.user_name || '').toLowerCase().includes(q);
      const matchEmail = (r.user_email || '').toLowerCase().includes(q);
      const matchTarget = (r.target_account || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchTarget;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--adm-text-primary)] m-0 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>Coin Redemptions & Payouts</span>
          </h2>
          <p className="text-xs text-[var(--adm-text-muted)] mt-0.5">
            Process reporter coin redemptions via UPI transfers or Mobile Recharges (10 Coins = ₹1)
          </p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-xl bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] hover:bg-[#d5e4f5] text-[var(--adm-text-primary)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="adm-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[var(--adm-text-muted)] uppercase">Pending Payouts</span>
            <div className="text-lg font-extrabold text-[var(--adm-text-primary)]">
              ₹{pendingAmount.toLocaleString('en-IN')}{' '}
              <span className="text-xs font-semibold text-amber-600">({pendingCount} req)</span>
            </div>
          </div>
        </div>

        <div className="adm-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[var(--adm-text-muted)] uppercase">Total Paid Out</span>
            <div className="text-lg font-extrabold text-[var(--adm-text-primary)]">
              ₹{completedAmount.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="adm-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[var(--adm-blue)] flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[var(--adm-text-muted)] uppercase">Total Requests</span>
            <div className="text-lg font-extrabold text-[var(--adm-text-primary)]">
              {requests.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['pending', 'all', 'completed', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition capitalize cursor-pointer shrink-0 ${
                filter === tab
                  ? 'bg-[var(--adm-blue)] text-white shadow-xs'
                  : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
              }`}
            >
              {tab === 'pending' ? `Pending (${pendingCount})` : tab}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reporter, phone or UPI..."
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--adm-card-bg)] border border-[var(--adm-card-border)] rounded-xl text-xs font-medium text-[var(--adm-text-primary)] outline-none focus:border-[var(--adm-blue)]"
          />
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="adm-card p-12 text-center text-xs text-[var(--adm-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--adm-blue)]" />
          Loading redemption requests...
        </div>
      ) : filtered.length === 0 ? (
        <div className="adm-card p-8 text-center text-xs text-[var(--adm-text-muted)]">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No {filter !== 'all' ? filter : ''} redemption requests found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((req) => {
            const isPending = req.status === 'pending';
            const isCompleted = req.status === 'completed';
            const isRejected = req.status === 'rejected';
            const isActionLoading = actionLoadingId === req.id;

            return (
              <div
                key={req.id}
                className="adm-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition hover:border-[var(--adm-blue)]/50"
              >
                {/* Left: User & Payout Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      req.redeem_type === 'upi'
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                    }`}
                  >
                    {req.redeem_type === 'upi' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-[var(--adm-text-primary)] m-0 truncate">
                        {req.user_name || 'Reporter'}
                      </h4>
                      <span className="text-[11px] text-[var(--adm-text-muted)] truncate">
                        {req.user_email || req.user_phone || ''}
                      </span>
                    </div>

                    {/* Target account info */}
                    <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs">
                      <span className="font-semibold text-[var(--adm-text-secondary)]">
                        {req.redeem_type === 'recharge' ? 'Mobile Number:' : 'UPI ID:'}
                      </span>
                      <span className="font-mono font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md text-[11px] select-all">
                        {req.target_account}
                      </span>
                      <span className="text-[10.5px] text-[var(--adm-text-muted)]">
                        {new Date(req.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Admin notes if rejected */}
                    {isRejected && req.admin_notes && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 m-0">
                        <strong>Rejection Reason:</strong> {req.admin_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-[var(--adm-card-border)] shrink-0">
                  <div className="text-left md:text-right">
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      ₹{req.amount_inr}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--adm-text-muted)]">
                      {req.coins_redeemed} Coins
                    </div>
                  </div>

                  {/* Status or Actions */}
                  {isPending ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMarkCompleted(req)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer disabled:opacity-50"
                        title="Mark as paid and notify user"
                      >
                        {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Mark Paid</span>
                      </button>

                      <button
                        onClick={() => {
                          setRejectingItem(req);
                          setRejectReason('Invalid account or details provided.');
                        }}
                        disabled={isActionLoading}
                        className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer border border-red-200 dark:border-red-800 disabled:opacity-50"
                        title="Reject and refund coins"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : isCompleted ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Rejected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Dialog */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 m-0">
              Reject Redemption Request
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              User will be refunded <strong>{rejectingItem.coins_redeemed} coins</strong>. Please provide a reason:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
