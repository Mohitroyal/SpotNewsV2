import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Download,
  Share2,
  CheckCircle,
  Newspaper,
  Loader2,
  Clock,
  Printer,
  ShieldCheck,
  ArrowLeft,
  FileImage,
  RotateCw,
  Camera,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import { FigmaScreenHeader } from '@/components/FigmaScreenHeader';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { useAuthStore, getReporterName, getEffectiveReporterPhoto, saveReporterPhoto } from '@/store';
import { supabase } from '@/lib/supabase';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';
import { RtiIdCard, type RtiCardData } from '@/components/RtiIdCard';
import { exportIdCardPdf, exportIdCardPng, printIdCard, shareIdCard } from '@/utils/idCardExport';

export const ReporterIdCardScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [appData, setAppData] = useState<ReporterApplicationDetails>(() => {
    return (
      location.state?.appData || {
        refNo: '',
        name: user?.full_name || getReporterName(user?.email) || 'Reporter Member',
        email: user?.email || 'reporter@example.com',
        phone: user?.phone_number || '',
        state: 'Telangana',
        district: 'Hyderabad',
        pressId: 'PRESS-OFFICIAL',
        reporterId: '',
        submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        validUntil: '',
        status: 'ACTIVE',
      }
    );
  });

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState('');
  const [activeSide, setActiveSide] = useState<'front' | 'back' | 'both'>('front');

  // Official ID Card Photo
  const email = (appData.email || user?.email || '').toLowerCase().trim();
  const initialSavedPhoto =
    (email ? localStorage.getItem(`spotnews_id_card_photo_${email}`) : null) ||
    appData.avatarUrl ||
    getEffectiveReporterPhoto(email, [appData.avatarUrl, user?.avatarUrl]) ||
    '/dummy.jpg';

  const [idPhoto, setIdPhoto] = useState<string>(initialSavedPhoto);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPhotoConfirmed, setIsPhotoConfirmed] = useState<boolean>(() => {
    return email ? localStorage.getItem(`spotnews_id_photo_confirmed_${email}`) === 'true' : false;
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync photo if local storage has updated photo
  useEffect(() => {
    if (initialSavedPhoto && initialSavedPhoto !== '/dummy.jpg' && !photoPreview) {
      setIdPhoto(initialSavedPhoto);
    }
  }, [initialSavedPhoto, photoPreview]);

  // Handle image selection with square crop
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        const targetSize = 400;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, targetSize, targetSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setPhotoPreview(dataUrl);
          setActiveSide('front'); // Flip to front so user can review photo on card
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Confirm photo: save to card and permanently lock in settings
  const handleConfirmPhoto = () => {
    if (!photoPreview) return;
    const finalPhoto = photoPreview;

    if (email) {
      try {
        localStorage.setItem(`spotnews_id_card_photo_${email}`, finalPhoto);
        localStorage.setItem(`spotnews_id_photo_confirmed_${email}`, 'true');
        localStorage.setItem('spotnews_active_reporter_photo', finalPhoto);
        saveReporterPhoto(email, finalPhoto);
      } catch {}
    }

    if (user?.id) {
      try {
        supabase.auth.updateUser({
          data: { avatar_url: finalPhoto, picture: finalPhoto }
        }).catch(() => {});
      } catch {}
    }

    setAppData((prev) => ({
      ...prev,
      avatarUrl: finalPhoto,
    }));
    setIdPhoto(finalPhoto);
    setPhotoPreview(null);
    setIsPhotoConfirmed(true);
    setDownloadSuccessMsg('Official ID Photo confirmed and saved to your ID Card! (Locked from Settings screen)');
    setTimeout(() => setDownloadSuccessMsg(''), 5000);
  };

  const handleCancelPhoto = () => {
    setPhotoPreview(null);
  };

  const frontCardRef = useRef<HTMLDivElement | null>(null);
  const backCardRef = useRef<HTMLDivElement | null>(null);

  // Fetch verified application details if reporterId is missing
  useEffect(() => {
    const fetchIdCard = async () => {
      if (appData.reporterId) return;
      setLoading(true);
      try {
        const identifier = appData.email || user?.email || appData.refNo;
        if (identifier) {
          const fetched = await reporterApprovalService.checkStatus(identifier, appData.refNo);
          if (fetched) {
            setAppData((prev) => ({
              ...prev,
              ...fetched,
              reporterId: fetched.reporterId || prev.reporterId,
              validUntil: fetched.validUntil || prev.validUntil,
            }));
          }
        }
      } catch (e) {
        console.error('Failed to load reporter ID card details:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchIdCard();
  }, [appData.email, appData.refNo, appData.reporterId, user?.email]);

  // Prepare card data object
  const effectiveCardName =
    appData.name ||
    getReporterName(user?.email) ||
    localStorage.getItem('spotnews_active_reporter_name') ||
    'POKKALA MOHITH ROYAL';

  const cardData: RtiCardData = {
    cardNo: appData.reporterId || (appData.refNo ? `RTI ${appData.refNo.replace(/\D/g, '').slice(-4) || '1147'}` : 'SNP-TE-2026-16EDF5'),
    name: effectiveCardName,
    designation: `${appData.district ? appData.district.toUpperCase() + ' REPORTER' : 'PRESS REPORTER'}`,
    center: (appData.district || appData.state || 'HYDERABAD').toUpperCase(),
    validUpto: appData.validUntil || '16 OCT 2027',
    photoUrl: photoPreview || idPhoto || initialSavedPhoto || '/dummy.jpg',
    address: `${appData.district || 'Hyderabad'}, ${appData.state || 'Telangana'}, Andhra Pradesh & Telangana`,
    pin: '515001',
    phone: appData.phone || user?.phone_number || '7668886666',
    relation: 'S/O',
    guardian: '',
    mediaType: 'PRINT MEDIA',
    actLine: 'RTI ACT-2005',
    logoUrl: '/logo_spotnews.png',
  };

  // Download PDF (front & back CR80 format)
  const handleDownloadPdf = async () => {
    setDownloading(true);
    setDownloadSuccessMsg('');
    try {
      const frontEl = document.getElementById('rti-card-front');
      const backEl = document.getElementById('rti-card-back');

      if (!frontEl) {
        throw new Error('ID Card elements could not be located.');
      }

      const res = await exportIdCardPdf(cardData.cardNo, frontEl, backEl);
      if (res.message) {
        setDownloadSuccessMsg(res.message);
      }
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setDownloadSuccessMsg(err.message || 'Failed to generate PDF');
    } finally {
      setDownloading(false);
      setTimeout(() => setDownloadSuccessMsg(''), 5000);
    }
  };

  // Download high-resolution PNGs
  const handleDownloadPng = async (targetSide: 'front' | 'back') => {
    setDownloading(true);
    setDownloadSuccessMsg('');
    try {
      setActiveSide(targetSide);
      const elId = targetSide === 'front' ? 'rti-card-front' : 'rti-card-back';
      const el = document.getElementById(elId);
      if (!el) throw new Error(`${targetSide} card element not found`);

      const res = await exportIdCardPng(cardData.cardNo, el, targetSide === 'front' ? 'FRONT' : 'BACK', false);
      if (res.message) {
        setDownloadSuccessMsg(res.message);
      }
    } catch (err: any) {
      console.error('PNG download error:', err);
      setDownloadSuccessMsg(err.message || 'Failed to download card image');
    } finally {
      setDownloading(false);
      setTimeout(() => setDownloadSuccessMsg(''), 5000);
    }
  };

  // Share ID Card details & image
  const handleShareIdCard = async () => {
    const shareText = `Official RTI EXPRESS Spot News 24x7 Press ID Card\n` +
      `Reporter: ${cardData.name}\n` +
      `Designation: ${cardData.designation}\n` +
      `Card No: ${cardData.cardNo}\n` +
      `Valid Upto: ${cardData.validUpto}\n` +
      `Verification Helpline: 7668886666`;

    try {
      const frontEl = document.getElementById('rti-card-front');
      const res = await shareIdCard(cardData.cardNo, shareText, frontEl);
      if (res.message) {
        setDownloadSuccessMsg(res.message);
        setTimeout(() => setDownloadSuccessMsg(''), 4000);
      }
    } catch (e: any) {
      console.error('Share error:', e);
    }
  };

  // Native Print
  const handlePrint = async () => {
    setDownloading(true);
    try {
      const frontEl = document.getElementById('rti-card-front');
      const backEl = document.getElementById('rti-card-back');
      if (!frontEl) throw new Error('ID Card element not found');

      const res = await printIdCard(cardData.cardNo, frontEl, backEl);
      if (res.message) {
        setDownloadSuccessMsg(res.message);
        setTimeout(() => setDownloadSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Print error:', err);
      setDownloadSuccessMsg(err.message || 'Print error');
      setTimeout(() => setDownloadSuccessMsg(''), 4000);
    } finally {
      setDownloading(false);
    }
  };

  const isPreparing = !appData.reporterId && !appData.refNo;

  return (
    <div className="flex flex-col min-h-screen bg-[#F1F5F9] text-[#0F172A] font-sans">
      <FigmaScreenHeader />


      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-5 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Top Navigation & Status Badge */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black tracking-wider uppercase border border-emerald-200 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>OFFICIAL PRESS CREDENTIAL</span>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
              Official Reporter ID Card
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
              RTI EXPRESS Spot News 24×7 • Verified press identity & accreditation credential.
            </p>
          </div>

          {/* Feedback message */}
          {downloadSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{downloadSuccessMsg}</span>
            </div>
          )}

          {/* ══ IF ID CARD PREPARING ══ */}
          {isPreparing ? (
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">Preparing your ID card</h3>
              <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
                Your payment is verified. Your unique press credential number is being synchronized with the registry.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  reporterApprovalService
                    .checkStatus(appData.email || user?.email || '', appData.refNo)
                    .then((d) => d && setAppData((p) => ({ ...p, ...d })))
                    .finally(() => setLoading(false));
                }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B4EA2] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Refresh Card</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Card Side Switcher Tabs */}
              <div className="flex items-center justify-center p-1 bg-[#E2E8F0] rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveSide('front')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeSide === 'front'
                      ? 'bg-white text-[#0B4EA2] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Front Side
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSide('back')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeSide === 'back'
                      ? 'bg-white text-[#0B4EA2] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Back Side
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSide('both')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeSide === 'both'
                      ? 'bg-white text-[#0B4EA2] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Both Sides
                </button>
              </div>

              {/* Card Container with Realistic Drop Shadow */}
              <div className="flex flex-col items-center justify-center py-2 bg-gradient-to-b from-slate-200/50 to-slate-200/20 rounded-3xl border border-slate-300/60 p-4 overflow-x-auto shadow-inner">
                <RtiIdCard
                  data={cardData}
                  side={activeSide}
                  frontRef={frontCardRef}
                  backRef={backCardRef}
                  onCardFlip={() => setActiveSide((prev) => (prev === 'front' ? 'back' : 'front'))}
                />
              </div>

              {/* Hidden file input for changing official ID photo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {/* Photo Review & Confirmation Card */}
              {photoPreview ? (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-950">Review New ID Photograph</p>
                      <p className="text-[11px] text-amber-800 leading-snug">
                        Check your photo preview on the ID card above. Once you confirm, this will be your official accreditation photo and cannot be changed from the Settings screen.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmPhoto}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm & Save Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPhoto}
                      className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-98 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Official Photo Verification Badge with Change Photo Option */
                <div className="flex items-center justify-between p-3.5 bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">Official ID Photograph</p>
                      <p className="text-[11px] text-[#64748B]">
                        {isPhotoConfirmed ? 'Official photo confirmed & locked from Settings' : 'Change & confirm your accreditation photo'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#0B4EA2] hover:bg-[#093D80] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Change Photo</span>
                  </button>
                </div>
              )}

              {/* Verification Info Box */}
              <div className="bg-[#EEF4FB] border border-[#C6DCF4] rounded-2xl p-3.5 space-y-1.5 text-xs text-[#0F172A]">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-[#0B4EA2]">Assigned Card No:</span>
                  <span className="font-mono text-sm font-black text-[#0A2540] bg-white px-2 py-0.5 rounded border border-[#C6DCF4]">
                    {cardData.cardNo}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#64748B] text-[11px]">
                  <span>Valid Through:</span>
                  <span className="font-semibold text-emerald-700">{cardData.validUpto}</span>
                </div>
                <div className="flex items-center justify-between text-[#64748B] text-[11px]">
                  <span>Issuing Organization:</span>
                  <span className="font-semibold text-[#0F172A]">Fouziya Publications (Reg. 43 of 2018)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ ACTION BUTTONS ══ */}
        <div className="mt-6 space-y-2.5">
          {!isPreparing && (
            <>
              {/* Primary: Download PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="w-full py-3.5 px-4 bg-[#0B4EA2] hover:bg-[#093F84] active:scale-[0.99] text-white font-bold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download Print-Ready ID Card (PDF)</span>
              </button>

              {/* Dedicated 3D Card Flip Controls */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveSide('front')}
                  className={`py-3 px-3 border rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    activeSide === 'front'
                      ? 'bg-[#0B4EA2] text-white border-[#0B4EA2]'
                      : 'bg-white hover:bg-slate-50 border-[#CBD5E1] text-[#0F172A]'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Flip to Front</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSide('back')}
                  className={`py-3 px-3 border rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    activeSide === 'back'
                      ? 'bg-[#0B4EA2] text-white border-[#0B4EA2]'
                      : 'bg-white hover:bg-slate-50 border-[#CBD5E1] text-[#0F172A]'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Flip to Back</span>
                </button>
              </div>

              {/* Gallery Save Options (Saves directly without sharing) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadPng('front')}
                  disabled={downloading}
                  className="py-3 px-3 bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileImage className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  <span>Save Front PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPng('back')}
                  disabled={downloading}
                  className="py-3 px-3 bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileImage className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  <span>Save Back PNG</span>
                </button>
              </div>

              {/* Share & Print Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleShareIdCard}
                  className="py-3 px-3 bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  <span>Share ID Card</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-3 px-3 bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  <span>Print Card</span>
                </button>
              </div>
            </>
          )}

          {/* Tertiary: Create Clipping */}
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="w-full py-3 px-4 bg-[#E2E8F0] hover:bg-slate-300/80 active:scale-[0.99] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Newspaper className="w-4 h-4 text-[#0B4EA2]" />
            <span>Create Newspaper Clipping</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-2 text-center text-xs font-bold text-[#64748B] hover:text-[#0F172A]"
          >
            Go to Home Feed
          </button>
        </div>
      </main>
    </div>
  );
};
