import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Image as ImageIcon, Video, CheckCircle2,
  Clock, AlertCircle, Phone, MessageSquare, Globe,
  Loader2, X, RefreshCw, Sparkles, CreditCard, SlidersHorizontal
} from 'lucide-react';
import { useAuthStore } from '@/store';
import { localAdsService } from '@/services/localAds.service';
import type { LocalAd, LocalAdMediaType, LocalAdCtaType } from '@/types/localAds';
import { UpiPaymentModal } from '@/components/UpiPaymentModal';

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
  const [targetDistrict, setTargetDistrict] = useState(TELANGANA_DISTRICTS[0]);
  const [ctaType, setCtaType] = useState<LocalAdCtaType>('call');
  const [ctaValue, setCtaValue] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAds = async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await localAdsService.fetchReporterAdRequests(user.id);
    setAds(data);
    setLoading(false);
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
    setFormError('');

    const res = await localAdsService.createAdRequest({
      reporter_id: user?.id || '',
      reporter_name: user?.full_name || 'Reporter',
      reporter_phone: (user as any)?.phone_number || '',
      reporter_email: user?.email || '',
      title: title.trim(),
      description: description.trim(),
      media_type: mediaType,
      media_file: selectedFile,
      target_district: targetDistrict.split(' / ')[0],
      cta_type: ctaType,
      cta_value: ctaValue.trim(),
    });

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      resetForm();
      fetchAds();
    } else {
      setFormError(res.error || 'Failed to submit ad request. Please try again.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setPreviewUrl('');
    setTargetDistrict(TELANGANA_DISTRICTS[0]);
    setCtaValue('');
    setFormError('');
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
    const res = await localAdsService.confirmPaymentAndActivate(ad.id, 'free_ad');
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
            <h1 className="text-base font-bold tracking-tight">Local Ads & Sponsorships</h1>
            <p className="text-[11px] text-white/80">స్థానిక ప్రకటనల అభ్యర్థనలు</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-1.5 bg-[#FFCC00] hover:bg-[#E6B800] text-[#015BB3] px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Request Ad</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-4">
        {/* Banner Info */}
        <div className="bg-gradient-to-r from-[#015BB3] to-[#0284c7] rounded-2xl p-4 text-white shadow-sm flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-[#FFCC00] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">Grow Local Business with In-Feed Ads</p>
            <p className="text-white/85 leading-relaxed">
              Submit your local business poster or video ad here. Once reviewed and accepted by the Superadmin, you can complete payment to have it broadcast across the feed every 15 clippings.
            </p>
          </div>
        </div>

        {/* Requests List */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-black text-[#0A2540] uppercase tracking-wider">
            Your Ad Requests ({ads.length})
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
        ) : ads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-[#EEF4FB] text-[#015BB3] rounded-full flex items-center justify-center mx-auto">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0A2540]">No Ad Requests Yet</p>
              <p className="text-xs text-[#6B7A90] mt-1 max-w-sm mx-auto">
                Promote shops, services, and local events. Upload your ad poster or video and request the Superadmin to feature it in the feed.
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="inline-flex items-center gap-2 bg-[#015BB3] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-[#0B4EA2] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Submit First Ad Request</span>
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
                      <span className="text-[10px] font-bold text-[#015BB3] uppercase tracking-wider bg-[#EAF2FB] px-2 py-0.5 rounded-full">
                        {ad.media_type === 'video' ? '🎬 Promo Video' : '🖼️ Poster Ad'} • {ad.target_district || 'All Districts'}
                      </span>
                      <h3 className="text-sm font-bold text-[#0A2540] pt-1">{ad.title}</h3>
                    </div>

                    {/* Status Pill */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Pending Review</span>
                      </span>
                    )}

                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Accepted! Free to Post</span>
                      </span>
                    )}

                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shrink-0">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span>Live in Feed</span>
                      </span>
                    )}

                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full shrink-0">
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
                      <div className="flex items-center gap-3 text-gray-500 text-[11px] pt-0.5">
                        <span className="flex items-center gap-1">
                          {ad.cta_type === 'call' && <Phone className="w-3 h-3 text-blue-600" />}
                          {ad.cta_type === 'whatsapp' && <MessageSquare className="w-3 h-3 text-emerald-600" />}
                          {ad.cta_type === 'link' && <Globe className="w-3 h-3 text-purple-600" />}
                          <span className="font-medium text-gray-700">{ad.cta_value || 'None'}</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">
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
                        <p className="text-[11px] text-[#2D7A4D]">
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
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl px-3 py-2 text-[11px] text-blue-800 flex items-center justify-between">
                      <span className="font-semibold">Status: Actively rotating in the district feed</span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
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

      {/* ── Create Ad Request Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#015BB3] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Request Superadmin to Post Ad</h3>
                <p className="text-[11px] text-white/80">స్థానిక ప్రకటన అభ్యర్థన ఫారమ్</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    showAdvanced
                      ? 'bg-amber-400 text-gray-900 shadow-md ring-2 ring-white/50'
                      : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
                  }`}
                  title="Advanced Features / అధునాతన ఫీచర్లు"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Advanced</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleCreateRequest} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700">Ad Title / Business Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Sri Laxmi Silks & Sarees Festival Sale"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#015BB3] text-xs"
                  required
                />
              </div>

              {/* Media Type Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Ad Media Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setMediaType('image'); setSelectedFile(null); setPreviewUrl(''); }}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                      mediaType === 'image'
                        ? 'border-[#015BB3] bg-[#EAF2FB] text-[#015BB3]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Poster (Image)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMediaType('video'); setSelectedFile(null); setPreviewUrl(''); }}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                      mediaType === 'video'
                        ? 'border-[#015BB3] bg-[#EAF2FB] text-[#015BB3]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Promo Video</span>
                  </button>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700">
                  Upload {mediaType === 'video' ? 'Video File (MP4, max 25MB)' : 'Poster Image (JPG/PNG)'} *
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-[#015BB3] rounded-2xl p-4 cursor-pointer bg-gray-50 hover:bg-blue-50/40 transition-colors">
                  {previewUrl ? (
                    mediaType === 'video' ? (
                      <video src={previewUrl} className="max-h-36 rounded-lg object-contain" controls />
                    ) : (
                      <img src={previewUrl} alt="Preview" className="max-h-36 rounded-lg object-contain" />
                    )
                  ) : (
                    <div className="text-center space-y-1 text-gray-500">
                      {mediaType === 'video' ? <Video className="w-8 h-8 mx-auto text-[#015BB3]" /> : <ImageIcon className="w-8 h-8 mx-auto text-[#015BB3]" />}
                      <p className="font-bold text-xs text-[#015BB3]">Click to select {mediaType === 'video' ? 'video' : 'poster'}</p>
                      <p className="text-[10px] text-gray-400">High-resolution files look best in feed</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept={mediaType === 'video' ? 'video/mp4,video/quicktime' : 'image/*'}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Contact Information */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700">
                  {ctaType === 'call' ? 'Phone Number *' : ctaType === 'whatsapp' ? 'WhatsApp Number *' : 'URL Link *'}
                </label>
                <input
                  type={ctaType === 'link' ? 'url' : 'tel'}
                  placeholder={ctaType === 'link' ? 'https://example.com' : '9876543210'}
                  value={ctaValue}
                  onChange={(e) => setCtaValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#015BB3] text-xs"
                  required
                />
              </div>

              {/* Advanced Features (Revealed when Advanced logo clicked beside top X) */}
              {showAdvanced ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 via-blue-50/40 to-indigo-50/50 border border-amber-200/80 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                    <div className="flex items-center gap-1.5 text-[#015BB3] font-bold text-xs">
                      <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                      <span>Advanced Ad Features (అధునాతన ఫీచర్లు)</span>
                    </div>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
                      Custom Options
                    </span>
                  </div>

                  {/* Offer / Description */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">Offer / Description (Optional)</label>
                    <textarea
                      placeholder="Special 50% discount on all silk sarees this festive week..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-[#015BB3] text-xs bg-white"
                    />
                  </div>

                  {/* Target Region / District */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">Target Region / District *</label>
                    <select
                      value={targetDistrict}
                      onChange={(e) => setTargetDistrict(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#015BB3] text-xs bg-white"
                    >
                      {TELANGANA_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Call to Action Type */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">Call-to-Action Type</label>
                    <select
                      value={ctaType}
                      onChange={(e) => setCtaType(e.target.value as LocalAdCtaType)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#015BB3] text-xs bg-white"
                    >
                      <option value="call">📞 Phone Call</option>
                      <option value="whatsapp">💬 WhatsApp Message</option>
                      <option value="link">🌐 Website / Maps Link</option>
                    </select>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-[#015BB3] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                  <span>Need Offer Description, District or Action Link? Open Advanced</span>
                </button>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#015BB3] hover:bg-[#0B4EA2] text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-2 active:scale-95 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading & Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit for Approval</span>
                    </>
                  )}
                </button>
              </div>
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
                    className="text-[10px] font-bold text-[#015BB3] bg-blue-50 hover:bg-blue-100 active:scale-95 px-2 py-0.5 rounded border border-blue-200 transition-all cursor-pointer"
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
