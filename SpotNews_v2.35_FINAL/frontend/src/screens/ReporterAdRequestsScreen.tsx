import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DISTRICTS, findDistrict } from '@/features/daily/dailyContentEngine';
import {
  ArrowLeft, Plus, Image as ImageIcon, Video, CheckCircle2,
  Clock, AlertCircle, Phone, MessageSquare, Globe,
  Loader2, X, RefreshCw, Sparkles, CreditCard
} from 'lucide-react';
import { useAuthStore } from '@/store';
import { localAdsService, adOwnerId } from '@/services/localAds.service';
import type { LocalAd, LocalAdMediaType, LocalAdCtaType } from '@/types/localAds';
import { UpiPaymentModal } from '@/components/UpiPaymentModal';

// Ads can target any district in Andhra Pradesh or Telangana (Nov 2026: AP was missing)
const AD_DISTRICTS = [
  'All / అన్ని జిల్లాలు',
  ...DISTRICTS.map((d) => `${d.en} / ${d.te}`),
];
const districtOption = (name?: string) => {
  const d = findDistrict(name);
  return d ? `${d.en} / ${d.te}` : AD_DISTRICTS[0];
};

export const ReporterAdRequestsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [ads, setAds] = useState<LocalAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdForPayment, setSelectedAdForPayment] = useState<LocalAd | null>(null);
  const [isUpiSubmitting, setIsUpiSubmitting] = useState(false);
  const [pendingPaymentAd, setPendingPaymentAd] = useState<LocalAd | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // New Request Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<LocalAdMediaType>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const routeState = (useLocation().state || {}) as { category?: { key: string; te: string; en: string } | null; openForm?: boolean };
  const myDistrict = useAuthStore((st) => st.district);
  const [targetDistrict, setTargetDistrict] = useState(() => districtOption(myDistrict));
  const [ctaType, setCtaType] = useState<LocalAdCtaType>('call');
  const [ctaValue, setCtaValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState('');
  const [formError, setFormError] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Coming from "Post Advertisement": open the form with the chosen category
  useEffect(() => {
    if (!routeState.openForm) return;
    setIsModalOpen(true);
    if (routeState.category) setDescription(`${routeState.category.te} · ${routeState.category.en}\n`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const ownerId = adOwnerId(user?.id);
      const data = await localAdsService.fetchReporterAdRequests(ownerId);
      setAds(data || []);
    } catch (err: any) {
      console.error('[ReporterAdRequestsScreen] fetchAds error:', err);
      setFetchError('Failed to load ad requests. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaType === 'video' && file.size > 25 * 1024 * 1024) {
      setFormError('Video size must be less than 25MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFormError('');
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter an ad title or business name.');
      return;
    }
    if (!selectedFile) {
      setFormError('Please upload a poster image or video.');
      return;
    }
    if (!ctaValue.trim()) {
      setFormError('Please provide a contact phone number or website link.');
      return;
    }

    setSubmitting(true);
    setSubmittingStep('ప్రారంభమవుతోంది… · Starting…');
    setFormError('');

    // Generous 45-second safety timer protects slow mobile connections while preventing infinite hang
    const safetyTimer = setTimeout(() => {
      setSubmitting(false);
      setSubmittingStep('');
      setFormError('Request timed out. Please check your connection and try again.');
    }, 45000);

    try {
      const ownerId = adOwnerId(user?.id);
      const res = await localAdsService.createAdRequest(
        {
          reporter_id: ownerId,
          reporter_name: String(user?.id || '').startsWith('guest_') ? (title.trim() || 'Reader') : (user?.full_name || 'Reporter'),
          reporter_phone: (user as any)?.phone_number || '',
          reporter_email: user?.email || '',
          title: title.trim(),
          description: description.trim(),
          media_type: mediaType,
          media_file: selectedFile,
          target_district: targetDistrict.split(' / ')[0],
          target_state: findDistrict(targetDistrict.split(' / ')[0])?.state || 'All',
          cta_type: ctaType,
          cta_value: ctaValue.trim(),
        },
        (step) => setSubmittingStep(step)
      );

      clearTimeout(safetyTimer);

      if (res.success && res.data) {
        setIsModalOpen(false);
        resetForm();
        setAds((prev) => [res.data!, ...prev.filter((a) => a.id !== res.data!.id)]);
        alert('🎉 మీ ప్రకటన సమర్పించబడింది! వార్తల్లో కనిపిస్తుంది. / Your ad has been submitted successfully.');
        fetchAds().catch(() => {});
      } else {
        setFormError(res.error || 'Failed to submit ad request. Please try again.');
      }
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error('[ReporterAdRequestsScreen] Submission exception:', err);
      setFormError(err.message || 'An error occurred while submitting your ad. Please try again.');
    } finally {
      clearTimeout(safetyTimer);
      setSubmitting(false);
      setSubmittingStep('');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setPreviewUrl('');
    setTargetDistrict(districtOption(myDistrict));
    setCtaValue('');
    setFormError('');
    setSubmittingStep('');
  };

  const handlePayNow = async (ad: LocalAd) => {
    if ((ad.amount_inr ?? 0) <= 0) {
      await handlePublishFree(ad);
      return;
    }

    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TpNZ0nDgvTDXOU';

    // Ensure Razorpay script is loaded
    if (typeof window !== 'undefined' && !(window as any).Razorpay) {
      await new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.body.appendChild(script);
      });
    }

    if (!(window as any).Razorpay) {
      alert('Unable to load Razorpay payment gateway. Please check your internet connection.');
      return;
    }

    try {
      const amountPaise = Math.round(Number(ad.amount_inr) * 100);
      const options: any = {
        key: keyId,
        amount: amountPaise > 0 ? amountPaise : 100, // in paise
        currency: 'INR',
        name: 'Spot News 24x7',
        description: `Local Ad Placement: ${ad.title}`,
        image: '/logo.png',
        prefill: {
          name: ad.reporter_name || user?.full_name || '',
          email: ad.reporter_email || user?.email || '',
          contact: ad.reporter_phone || (user as any)?.phone_number || '',
        },
        theme: {
          color: '#0B4EA2',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay using UPI (Google Pay, PhonePe, Paytm)',
                instruments: [{ method: 'upi' }],
              },
              other: {
                name: 'Cards & Other Payment Options',
                instruments: [{ method: 'card' }, { method: 'netbanking' }, { method: 'wallet' }],
              },
            },
            sequence: ['block.upi', 'block.other'],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        handler: async (response: any) => {
          setLoading(true);
          const payId = response.razorpay_payment_id || `rzp_${Date.now()}`;
          const res = await localAdsService.confirmPaymentAndActivate(ad.id, payId);
          setLoading(false);

          if (res.success) {
            alert(`🎉 Payment successful! Your ad "${ad.title}" is now active in the news feed.`);
            fetchAds();
          } else {
            alert(res.error || 'Payment succeeded but activating ad failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            console.log('Razorpay modal closed');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (failRes: any) => {
        alert(`Payment failed: ${failRes.error?.description || 'Transaction declined'}`);
      });
      rzp.open();
    } catch (err: any) {
      console.error('Error opening Razorpay:', err);
      alert('Failed to initiate Razorpay checkout.');
    }
  };

  const handlePublishFree = async (ad: LocalAd) => {
    setLoading(true);
    const res = await localAdsService.publishAdToFeed(ad.id);
    setLoading(false);
    if (res.success) {
      alert(`🎉 Free ad "${ad.title}" has been published to the live news feed!`);
      fetchAds();
    } else {
      alert(res.error || 'Failed to publish ad. Please try again.');
    }
  };

  const handleConfirmUpiDone = async () => {
    if (!pendingPaymentAd) return;
    setIsConfirmingPayment(true);
    const res = await localAdsService.confirmPaymentAndActivate(pendingPaymentAd.id);
    setIsConfirmingPayment(false);

    if (res.success) {
      const paidTitle = pendingPaymentAd.title;
      setPendingPaymentAd(null);
      alert(`🎉 Payment verified! Your local ad "${paidTitle}" is now active and will appear in the news feed.`);
      fetchAds();
    } else {
      alert(res.error || 'Failed to activate ad. Please try again or contact support.');
    }
  };

  const handleUpiPayForAd = async (utrNumber: string) => {
    if (!selectedAdForPayment) return;
    setIsUpiSubmitting(true);
    const res = await localAdsService.submitUpiPaymentForAd(selectedAdForPayment.id, utrNumber);
    setIsUpiSubmitting(false);

    if (res.success) {
      alert('🎉 Payment verified! Your local ad is now active and will appear in the news feed.');
      setSelectedAdForPayment(null);
      fetchAds();
    } else {
      alert(res.error || 'Failed to submit payment. Please verify your UTR number.');
    }
  };

  const handleRazorpayForAd = async () => {
    if (!selectedAdForPayment) return;
    const adToPay = selectedAdForPayment;
    setSelectedAdForPayment(null);
    await handlePayNow(adToPay);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F7FB] text-[#0A2540]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#015BB3] text-white px-4 py-3.5 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-[19px] font-extrabold tracking-tight">నా ప్రకటనలు</h1>
            <p className="text-[14px] text-white/80">My ads</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-1.5 bg-[#FFCC00] hover:bg-[#E6B800] text-[#015BB3] px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span className="text-[15px]">కొత్త ప్రకటన · New</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-4">
        {/* Banner Info */}
        <div className="bg-gradient-to-r from-[#015BB3] to-[#0284c7] rounded-2xl p-4 text-white shadow-sm flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-[#FFCC00] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-[17px]">మీ ప్రకటన వెంటనే వార్తల్లో · Your ad goes live at once</p>
            <p className="text-white/85 leading-relaxed">
              పోస్టర్ ఫోటో, మీ ఫోన్ నంబర్ ఇస్తే చాలు - మీ జిల్లా పాఠకులకు వెంటనే కనిపిస్తుంది. Just add a poster photo and your phone number - readers in your district see it right away.
            </p>
          </div>
        </div>

        {/* Requests List */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-black text-[#0A2540] uppercase tracking-wider">
            నా ప్రకటనలు · My ads ({ads.length}) <span className="text-[11px] font-bold text-gray-400">· v2.43</span>
          </h2>
          <button
            onClick={fetchAds}
            className="text-xs font-bold text-[#015BB3] flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#6B7A90]">
            <Loader2 className="w-7 h-7 animate-spin text-[#015BB3] mb-2" />
            <p className="text-xs font-medium">Loading your ad requests...</p>
          </div>
        ) : fetchError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-bold text-red-800">{fetchError}</p>
            <button
              onClick={fetchAds}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#015BB3] hover:bg-[#0B4EA2] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry · మళ్ళీ ప్రయత్నించండి</span>
            </button>
          </div>
        ) : ads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-[#EEF4FB] text-[#015BB3] rounded-full flex items-center justify-center mx-auto">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-[#0A2540]">ఇంకా ప్రకటనలు లేవు · No ads yet</p>
              <p className="text-xs text-[#6B7A90] mt-1 max-w-sm mx-auto">
                మీ షాప్, సేవ, కార్యక్రమాన్ని ప్రచారం చేయండి. · Promote your shop, service or event.
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="inline-flex items-center gap-2 bg-[#015BB3] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-[#0B4EA2] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[16px]">మొదటి ప్రకటన ఇవ్వండి · Post your first ad</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {ads.map((ad) => {
              const isPending = ad.status === 'pending';
              const isAccepted = ad.status === 'accepted_payment_pending';
              const isActive = ad.status === 'active';
              const isRejected = ad.status === 'rejected';

              return (
                <div
                  key={ad.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3 transition-all hover:border-[#015BB3]/40"
                >
                  {/* Top Bar: Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-bold text-[#015BB3] uppercase tracking-wider bg-[#EAF2FB] px-2 py-0.5 rounded-full">
                        {ad.media_type === 'video' ? '🎬 Promo Video' : '🖼️ Poster Ad'} • {ad.target_district || 'All Districts'}
                      </span>
                      <h3 className="text-sm font-bold text-[#0A2540] pt-1">{ad.title}</h3>
                    </div>

                    {/* Status Pill */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[14px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Pending Review</span>
                      </span>
                    )}

                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 text-[14px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Accepted! Free to Post</span>
                      </span>
                    )}

                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[14px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shrink-0">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span>Live in Feed</span>
                      </span>
                    )}

                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[14px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full shrink-0">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>

                  {/* Media Preview & Details Grid */}
                  <div className="flex gap-3 items-center">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center relative">
                      {ad.media_type === 'video' ? (
                        <video src={ad.media_url} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        <img src={ad.media_url} alt={ad.title} className="w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="flex-1 text-xs space-y-1">
                      {ad.description && (
                        <p className="text-gray-600 line-clamp-2">{ad.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-gray-500 text-[14px] pt-0.5">
                        <span className="flex items-center gap-1">
                          {ad.cta_type === 'call' && <Phone className="w-3 h-3 text-blue-600" />}
                          {ad.cta_type === 'whatsapp' && <MessageSquare className="w-3 h-3 text-emerald-600" />}
                          {ad.cta_type === 'link' && <Globe className="w-3 h-3 text-purple-600" />}
                          <span className="font-medium text-gray-700">{ad.cta_value || 'None'}</span>
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-400">
                        Submitted: {new Date(ad.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Action or Rejection Notice */}
                  {isAccepted && (
                    <div className="bg-[#EBF7F0] border border-[#BDE8CB] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#0D6832]">
                          Approved by Superadmin! Placement Fee: <span className="text-sm font-extrabold text-[#0D6832]">Free (₹0)</span>
                        </p>
                        <p className="text-[14px] text-[#2D7A4D]">
                          Approved for 100% free placement. Tap below to publish this ad to the live news feed.
                        </p>
                      </div>

                      <button
                        onClick={() => handlePublishFree(ad)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-[#128842] to-[#0e6f36] hover:from-[#0e6f36] hover:to-[#094c25] text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Publish Free to Feed (₹0)</span>
                      </button>
                    </div>
                  )}

                  {isRejected && ad.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-700">
                      <span className="font-bold">Superadmin Note: </span>
                      {ad.rejection_reason}
                    </div>
                  )}

                  {isActive && (
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl px-3 py-2 text-[14px] text-blue-800 flex items-center justify-between">
                      <span className="font-semibold">Status: Actively rotating in the district feed</span>
                      <span className="text-[13px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Paid on {new Date(ad.paid_at || ad.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Post an ad: simple form, goes live at once ─────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between text-white" style={{ background: 'linear-gradient(135deg,#062F6E,#0B4EA2 55%,#1E6FD9)' }}>
              <div>
                <h3 className="font-extrabold text-[20px] m-0">ప్రకటన ఇవ్వండి · Post Ad</h3>
                <p className="text-[14px] text-white/85 m-0">వెంటనే లైవ్ · Goes live immediately</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full bg-white/15 border-0 text-white flex items-center justify-center cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-5 overflow-y-auto space-y-5 flex-1">
              {routeState.category && (
                <span className="inline-block rounded-full bg-[#FFF1F1] border border-[#FCA5A5] text-[#B3121F] text-[14px] font-extrabold px-3 py-1">
                  {routeState.category.te} · {routeState.category.en}
                </span>
              )}
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-[15px] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Name */}
              <div className="space-y-1.5">
                <label className="block text-[17px] font-extrabold text-[#0F172A]">1. వ్యాపారం / ప్రకటన పేరు <span className="text-[14px] font-semibold text-[#64748B]">· Business name</span></label>
                <input type="text" placeholder="ఉదా: శ్రీ లక్ష్మి సిల్క్స్ · e.g. Sri Laxmi Silks" value={title}
                  onChange={(e) => setTitle(e.target.value)} required
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-[#D9E5F2] focus:outline-none focus:border-[#0B4EA2] text-[17px]" />
              </div>

              {/* 2. Poster photo (video optional) */}
              <div className="space-y-1.5">
                <label className="block text-[17px] font-extrabold text-[#0F172A]">2. పోస్టర్ ఫోటో <span className="text-[14px] font-semibold text-[#64748B]">· Poster photo</span></label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#9CC3F5] rounded-2xl p-4 cursor-pointer bg-[#F6FAFF] min-h-[150px]">
                  {previewUrl ? (
                    mediaType === 'video'
                      ? <video src={previewUrl} className="max-h-44 rounded-xl object-contain" controls />
                      : <img src={previewUrl} alt="Poster" className="max-h-44 rounded-xl object-contain" />
                  ) : (
                    <span className="text-center space-y-1">
                      {mediaType === 'video' ? <Video className="w-10 h-10 mx-auto text-[#0B4EA2]" /> : <ImageIcon className="w-10 h-10 mx-auto text-[#0B4EA2]" />}
                      <span className="block text-[17px] font-extrabold text-[#0B4EA2]">{mediaType === 'video' ? 'వీడియో ఎంచుకోండి · Choose video' : 'ఫోటో ఎంచుకోండి · Choose photo'}</span>
                      <span className="block text-[13px] text-[#64748B]">{mediaType === 'video' ? 'MP4, 25 MB వరకు' : 'గ్యాలరీ లేదా కెమెరా · Gallery or camera'}</span>
                    </span>
                  )}
                  <input type="file" accept={mediaType === 'video' ? 'video/mp4,video/quicktime' : 'image/*'} onChange={handleFileChange} className="hidden" />
                </label>
                <button type="button"
                  onClick={() => { setMediaType(mediaType === 'video' ? 'image' : 'video'); setSelectedFile(null); setPreviewUrl(''); }}
                  className="text-[14px] font-bold text-[#0B4EA2] bg-transparent border-0 p-0 cursor-pointer">
                  {mediaType === 'video' ? '← ఫోటో వాడండి · Use a photo instead' : 'వీడియో ఉందా? · Have a video instead?'}
                </button>
              </div>

              {/* 3. Contact */}
              <div className="space-y-1.5">
                <label className="block text-[17px] font-extrabold text-[#0F172A]">3. పాఠకులు ఎలా సంప్రదించాలి? <span className="text-[14px] font-semibold text-[#64748B]">· Contact</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {(['call', 'whatsapp'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setCtaType(k)}
                      className={`py-3 rounded-2xl border-2 text-[16px] font-extrabold cursor-pointer ${ctaType === k ? 'border-[#0B4EA2] bg-[#EAF2FB] text-[#0B4EA2]' : 'border-[#E2E8F0] bg-white text-[#475569]'}`}>
                      {k === 'call' ? '📞 కాల్ · Call' : '💬 WhatsApp'}
                    </button>
                  ))}
                </div>
                <input type="tel" inputMode="numeric" placeholder="మొబైల్ నంబర్ · Mobile number" value={ctaValue}
                  onChange={(e) => setCtaValue(e.target.value)} required
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-[#D9E5F2] focus:outline-none focus:border-[#0B4EA2] text-[17px]" />
              </div>

              {/* 4. District */}
              <div className="space-y-1.5">
                <label className="block text-[17px] font-extrabold text-[#0F172A]">4. ఏ జిల్లాలో చూపించాలి? <span className="text-[14px] font-semibold text-[#64748B]">· District</span></label>
                <select value={targetDistrict} onChange={(e) => setTargetDistrict(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-[#D9E5F2] focus:outline-none focus:border-[#0B4EA2] text-[17px] bg-white">
                  {AD_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* 5. Offer (optional) */}
              <div className="space-y-1.5">
                <label className="block text-[17px] font-extrabold text-[#0F172A]">5. ఆఫర్ / వివరాలు <span className="text-[14px] font-semibold text-[#64748B]">· Offer (optional)</span></label>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="ఉదా: ఈ వారం 50% తగ్గింపు · e.g. 50% off this week"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-[#D9E5F2] focus:outline-none focus:border-[#0B4EA2] text-[16px]" />
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-[15px] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="w-full rounded-2xl py-4 text-[19px] font-extrabold text-white border-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_10px_22px_rgba(225,29,46,0.3)]"
                style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)' }}>
                {submitting
                  ? <><Loader2 className="w-6 h-6 animate-spin" /> {submittingStep || 'పోస్ట్ అవుతోంది… · Posting…'}</>
                  : <><CheckCircle2 className="w-6 h-6" /> ప్రకటన పోస్ట్ చేయండి · Post Ad</>}
              </button>
              <p className="text-center text-[13.5px] text-[#64748B] m-0">v2.47 · ఉచితం · వెంటనే లైవ్ · Free · Live at once</p>
            </form>
          </div>
        </div>
      )}

      {/* SBI UPI Scan & Pay Modal for Ads */}
      <UpiPaymentModal
        isOpen={!!selectedAdForPayment}
        onClose={() => setSelectedAdForPayment(null)}
        title="Local Ad Placement Fee"
        purposeTitle={`SpotNews Ad: ${selectedAdForPayment?.title || ''}`}
        amount={selectedAdForPayment?.amount_inr ?? 0}
        applicantEmail={user?.email || ''}
        applicantPhone={(user as any)?.phone_number || ''}
        onUpiPaid={handleUpiPayForAd}
        onRazorpayPay={handleRazorpayForAd}
        isSubmitting={isUpiSubmitting}
      />

      {/* UPI Intent Payment Completion Prompt */}
      {pendingPaymentAd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
              <CreditCard className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-black text-base text-[#0A2540]">Complete UPI Payment</h3>
              <p className="text-xs text-gray-500 mt-1">
                Please complete payment of <strong className="text-emerald-700 font-extrabold text-sm">₹{pendingPaymentAd.amount_inr}</strong> in your UPI app (PhonePe / GPay / Paytm).
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Payee:</span>
                <span className="font-bold text-gray-800">FOUZIYA PUBLICATIONS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">UPI ID:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-gray-800">baba.journlist@sbi</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('baba.journlist@sbi');
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    className="text-[13px] font-bold text-[#015BB3] bg-blue-50 hover:bg-blue-100 active:scale-95 px-2 py-0.5 rounded border border-blue-200 transition-all cursor-pointer"
                  >
                    {copiedUpi ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-extrabold text-[#128842]">₹{pendingPaymentAd.amount_inr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ad Title:</span>
                <span className="font-medium text-gray-700 truncate max-w-[170px]">{pendingPaymentAd.title}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmUpiDone}
                disabled={isConfirmingPayment}
                className="w-full py-3 bg-gradient-to-r from-[#128842] to-[#0e6f36] hover:from-[#0e6f36] hover:to-[#094c25] text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                {isConfirmingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>I Have Completed Payment</span>
              </button>

              <button
                type="button"
                onClick={() => localAdsService.launchUpiPaymentIntent(pendingPaymentAd)}
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-[#015BB3] rounded-xl text-xs font-bold transition-colors"
              >
                Re-open UPI App (PhonePe / GPay)
              </button>

              <button
                type="button"
                onClick={() => setPendingPaymentAd(null)}
                disabled={isConfirmingPayment}
                className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel / Pay Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
