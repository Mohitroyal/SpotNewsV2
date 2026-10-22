import React, { useState, useEffect } from 'react';
import {
  Megaphone, Plus, CheckCircle2,
  Clock, Phone, MessageSquare, Globe, Trash2,
  Check, X, RefreshCw, Loader2, Pause, Play, DollarSign
} from 'lucide-react';
import { localAdsService } from '@/services/localAds.service';
import type { LocalAd, LocalAdMediaType, LocalAdCtaType } from '@/types/localAds';

const TELANGANA_DISTRICTS = [
  "All / మొత్తం తెలంగాణ",
  "Hyderabad / హైదరాబాద్",
  "Rangareddy / రంగారెడ్డి",
  "Medchal-Malkajgiri / మేడ్చల్",
  "Warangal / వరంగల్",
  "Karimnagar / కరీంనగర్",
  "Nizamabad / నిజామాబాద్",
  "Khammam / ఖమ్మం",
  "Nalgonda / నల్గొండ",
  "Mahabubnagar / మహబూబ్‌నగర్",
  "Sangareddy / సంగారెడ్డి",
  "Siddipet / సిద్దిపేట",
  "Adilabad / ఆదిలాబాద్",
  "Suryapet / సూర్యాపేట",
];

export const LocalAdsAdminSection: React.FC = () => {
  const [ads, setAds] = useState<LocalAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted_payment_pending' | 'active' | 'rejected'>('all');

  // Accept Dialog state
  const [acceptingAd, setAcceptingAd] = useState<LocalAd | null>(null);
  const [priceAmount, setPriceAmount] = useState('500');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Dialog state
  const [rejectingAd, setRejectingAd] = useState<LocalAd | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Does not comply with community advertising standards.');

  // Direct Ad Modal state
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directTitle, setDirectTitle] = useState('');
  const [directDesc, setDirectDesc] = useState('');
  const [directMediaType, setDirectMediaType] = useState<LocalAdMediaType>('image');
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [directPreview, setDirectPreview] = useState('');
  const [directDistrict, setDirectDistrict] = useState(TELANGANA_DISTRICTS[0]);
  const [directCtaType, setDirectCtaType] = useState<LocalAdCtaType>('call');
  const [directCtaValue, setDirectCtaValue] = useState('');
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const [directError, setDirectError] = useState('');

  const loadAds = async () => {
    setLoading(true);
    const data = await localAdsService.fetchAllAdRequestsForAdmin();
    setAds(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAds();
  }, []);

  const handleAcceptConfirm = async () => {
    if (!acceptingAd) return;
    const parsed = parseFloat(priceAmount);
    const numPrice = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setActionLoading(true);
    const res = await localAdsService.acceptAdRequest(acceptingAd.id, numPrice);
    setActionLoading(false);

    if (res.success) {
      setAcceptingAd(null);
      loadAds();
    } else {
      alert(res.error || 'Failed to accept request.');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingAd) return;
    setActionLoading(true);
    const res = await localAdsService.rejectAdRequest(rejectingAd.id, rejectionReason.trim());
    setActionLoading(false);

    if (res.success) {
      setRejectingAd(null);
      loadAds();
    } else {
      alert(res.error || 'Failed to reject request.');
    }
  };

  const handleToggleStatus = async (ad: LocalAd) => {
    const res = await localAdsService.toggleAdStatus(ad.id, ad.status);
    if (res.success) loadAds();
  };

  const handleDelete = async (adId: string) => {
    if (!window.confirm('Delete this advertisement?')) return;
    const res = await localAdsService.deleteLocalAd(adId);
    if (res.success) loadAds();
  };

  const handleDirectAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTitle.trim() || !directFile || !directCtaValue.trim()) {
      setDirectError('Please fill in title, upload a media file, and provide a CTA value.');
      return;
    }

    setDirectSubmitting(true);
    setDirectError('');

    const res = await localAdsService.createSuperadminDirectAd({
      reporter_name: 'SpotNews Superadmin',
      title: directTitle.trim(),
      description: directDesc.trim(),
      media_type: directMediaType,
      media_file: directFile,
      target_district: directDistrict.split(' / ')[0],
      cta_type: directCtaType,
      cta_value: directCtaValue.trim(),
    });

    setDirectSubmitting(false);

    if (res.success) {
      setIsDirectModalOpen(false);
      setDirectTitle('');
      setDirectDesc('');
      setDirectFile(null);
      setDirectPreview('');
      setDirectCtaValue('');
      loadAds();
    } else {
      setDirectError(res.error || 'Failed to create direct ad.');
    }
  };

  // Counts
  const pendingCount = ads.filter((a) => a.status === 'pending').length;
  const acceptedCount = ads.filter((a) => a.status === 'accepted_payment_pending').length;
  const activeCount = ads.filter((a) => a.status === 'active').length;
  const rejectedCount = ads.filter((a) => a.status === 'rejected').length;

  const filteredAds = ads.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  return (
    <div className="bg-white rounded-3xl border border-[#D0E2F7] p-5 shadow-sm space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#015BB3] text-white flex items-center justify-center shadow-xs">
              <Megaphone className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-[#0A2540] tracking-tight">
              Local In-Feed Advertisements
            </h2>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                {pendingCount} PENDING
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7A90] mt-0.5">
            Review reporter ad submissions, set placement pricing, and manage ads shown every 15 clippings.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadAds}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
            title="Refresh Ads"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsDirectModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-[#015BB3] hover:bg-[#0B4EA2] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Post Direct Ad</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          onClick={() => setFilter('pending')}
          className={`cursor-pointer rounded-2xl p-3 border transition-all ${
            filter === 'pending' ? 'border-amber-400 bg-amber-50/70 shadow-xs' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-[#0A2540] mt-1">{pendingCount}</p>
        </div>

        <div
          onClick={() => setFilter('accepted_payment_pending')}
          className={`cursor-pointer rounded-2xl p-3 border transition-all ${
            filter === 'accepted_payment_pending' ? 'border-emerald-400 bg-emerald-50/70 shadow-xs' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Payment</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-[#0A2540] mt-1">{acceptedCount}</p>
        </div>

        <div
          onClick={() => setFilter('active')}
          className={`cursor-pointer rounded-2xl p-3 border transition-all ${
            filter === 'active' ? 'border-blue-400 bg-blue-50/70 shadow-xs' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active in Feed</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-[#0A2540] mt-1">{activeCount}</p>
        </div>

        <div
          onClick={() => setFilter('all')}
          className={`cursor-pointer rounded-2xl p-3 border transition-all ${
            filter === 'all' ? 'border-[#015BB3] bg-[#EAF2FB] shadow-xs' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between text-[#015BB3]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Ads</span>
            <Megaphone className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-[#0A2540] mt-1">{ads.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
        {(['all', 'pending', 'accepted_payment_pending', 'active', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              filter === tab
                ? 'bg-[#015BB3] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab === 'all' && `All (${ads.length})`}
            {tab === 'pending' && `Pending (${pendingCount})`}
            {tab === 'accepted_payment_pending' && `Awaiting Payment (${acceptedCount})`}
            {tab === 'active' && `Active (${activeCount})`}
            {tab === 'rejected' && `Rejected (${rejectedCount})`}
          </button>
        ))}
      </div>

      {/* Ads List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-[#015BB3] mb-2" />
          <span className="text-xs">Loading local ads...</span>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          No advertisements found for this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAds.map((ad) => (
            <div
              key={ad.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 hover:border-gray-300 transition-all shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex gap-3">
                  {/* Media Thumbnail */}
                  <div className="w-20 h-20 rounded-xl bg-black overflow-hidden shrink-0 border border-gray-200 relative">
                    {ad.media_type === 'video' ? (
                      <video src={ad.media_url} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={ad.media_url} alt={ad.title} className="w-full h-full object-cover" />
                    )}
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                      {ad.media_type === 'video' ? 'VID' : 'IMG'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-[#0A2540] text-sm">{ad.title}</h4>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {ad.target_district || 'All Districts'}
                      </span>
                    </div>

                    <p className="text-gray-500 text-[11px] leading-snug">
                      Reporter: <span className="font-bold text-gray-800">{ad.reporter_name || 'Admin'}</span>
                      {ad.reporter_phone && ` (${ad.reporter_phone})`}
                    </p>

                    {ad.description && (
                      <p className="text-gray-600 line-clamp-2 text-[11px]">{ad.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-gray-500 text-[11px] pt-1">
                      <span className="flex items-center gap-1 text-[#015BB3] font-medium">
                        {ad.cta_type === 'call' && <Phone className="w-3 h-3" />}
                        {ad.cta_type === 'whatsapp' && <MessageSquare className="w-3 h-3 text-emerald-600" />}
                        {ad.cta_type === 'link' && <Globe className="w-3 h-3 text-purple-600" />}
                        <span>{ad.cta_value || 'None'}</span>
                      </span>
                      <span>•</span>
                      <span>Submitted: {new Date(ad.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Pricing */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                  {ad.status === 'pending' && (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      Pending Review
                    </span>
                  )}
                  {ad.status === 'accepted_payment_pending' && (
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full block">
                        {(ad.amount_inr ?? 0) === 0 ? 'Accepted / Free (₹0)' : `Accepted / Awaiting ₹${ad.amount_inr}`}
                      </span>
                    </div>
                  )}
                  {ad.status === 'active' && (
                    <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                      Active (Live)
                    </span>
                  )}
                  {ad.status === 'rejected' && (
                    <span className="text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                      Rejected
                    </span>
                  )}

                  {typeof ad.amount_inr === 'number' && (
                    <span className="text-xs font-black text-gray-700">
                      Fee: {(ad.amount_inr ?? 0) === 0 ? 'Free (₹0)' : `₹${ad.amount_inr}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons for Superadmin */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {ad.status === 'pending' && (
                    <>
                      <button
                        onClick={() => { setAcceptingAd(ad); setPriceAmount('0'); }}
                        className="px-3.5 py-1.5 bg-[#128842] hover:bg-[#0e6f36] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Accept & Set Price</span>
                      </button>

                      <button
                        onClick={() => setRejectingAd(ad)}
                        className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {ad.status === 'active' && (
                    <button
                      onClick={() => handleToggleStatus(ad)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Ad</span>
                    </button>
                  )}

                  {ad.status === 'expired' && (
                    <button
                      onClick={() => handleToggleStatus(ad)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#015BB3] rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Re-activate</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={ad.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#015BB3] hover:underline font-bold"
                  >
                    View Original
                  </a>

                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete Ad"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Accept & Set Price Modal ────────────────────────────────────── */}
      {acceptingAd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-[#0A2540]">Accept Ad Request & Set Fee</h3>
              <button onClick={() => setAcceptingAd(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Set the placement fee for <strong className="text-gray-800">{acceptingAd.title}</strong> by reporter <strong className="text-gray-800">{acceptingAd.reporter_name}</strong>.
              Set <strong>₹0</strong> for free placement, or any fixed fee for paid placement.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Placement Fee (INR ₹) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gray-500 font-bold">₹</span>
                <input
                  type="number"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-bold focus:border-[#015BB3] focus:outline-none"
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptingAd(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#128842] hover:bg-[#0e6f36] text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm & Send to Reporter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────── */}
      {rejectingAd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-red-600">Reject Ad Request</h3>
              <button onClick={() => setRejectingAd(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Reason for Rejection *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingAd(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Reject Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Superadmin Direct Ad Modal ─────────────────────────────────── */}
      {isDirectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#015BB3] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Post Direct Advertisement (Superadmin)</h3>
                <p className="text-[11px] text-white/80">Directly publish an ad into the feed without payment</p>
              </div>
              <button onClick={() => setIsDirectModalOpen(false)} className="p-1 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDirectAdSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {directError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
                  {directError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Ad Title *</label>
                <input
                  type="text"
                  placeholder="e.g., RTI Express 24x7 Official Sponsorship"
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:border-[#015BB3] focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Description</label>
                <textarea
                  value={directDesc}
                  onChange={(e) => setDirectDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:border-[#015BB3] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setDirectMediaType('image'); setDirectFile(null); setDirectPreview(''); }}
                  className={`py-2 px-3 rounded-xl border font-bold ${
                    directMediaType === 'image' ? 'border-[#015BB3] bg-blue-50 text-[#015BB3]' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Poster (Image)
                </button>
                <button
                  type="button"
                  onClick={() => { setDirectMediaType('video'); setDirectFile(null); setDirectPreview(''); }}
                  className={`py-2 px-3 rounded-xl border font-bold ${
                    directMediaType === 'video' ? 'border-[#015BB3] bg-blue-50 text-[#015BB3]' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Video (MP4)
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Upload Media File *</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-4 cursor-pointer bg-gray-50">
                  {directPreview ? (
                    directMediaType === 'video' ? (
                      <video src={directPreview} className="max-h-36 rounded-lg object-contain" controls />
                    ) : (
                      <img src={directPreview} alt="Preview" className="max-h-36 rounded-lg object-contain" />
                    )
                  ) : (
                    <div className="text-center text-gray-500">
                      <p className="font-bold text-xs text-[#015BB3]">Select {directMediaType === 'video' ? 'video' : 'image'}</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept={directMediaType === 'video' ? 'video/mp4' : 'image/*'}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setDirectFile(f);
                        setDirectPreview(URL.createObjectURL(f));
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Target Region</label>
                <select
                  value={directDistrict}
                  onChange={(e) => setDirectDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs bg-white"
                >
                  {TELANGANA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">CTA Type</label>
                  <select
                    value={directCtaType}
                    onChange={(e) => setDirectCtaType(e.target.value as LocalAdCtaType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs bg-white"
                  >
                    <option value="call">📞 Phone Call</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="link">🌐 Website</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700">CTA Target *</label>
                  <input
                    type="text"
                    placeholder={directCtaType === 'link' ? 'https://...' : '9876543210'}
                    value={directCtaValue}
                    onChange={(e) => setDirectCtaValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDirectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={directSubmitting}
                  className="px-5 py-2.5 bg-[#015BB3] text-white rounded-xl font-bold flex items-center gap-2"
                >
                  {directSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Publish Ad Directly</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
