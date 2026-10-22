import { useParams, useNavigate } from 'react-router-dom';
import { useGenerationStore, useAuthStore } from '@/store';
import { ArrowLeft, Download, FileDown, Share2, FileText, Send, CheckCircle2, Clock } from 'lucide-react';
import { generationService } from '@/services/generation.service';
import { supabase } from '@/lib/supabase';
import api from '@/lib/axios';
import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { stampClipping } from '@/features/share/stampClipping';
import { ShareAfterClipping } from '@/features/share/ShareAfterClipping';
import { newsLink } from '@/features/share/links';

// ─── Stage → Progress mapping ───────────────────────────────────────────────
const STAGE_PROGRESS: Record<string, number> = {
  'initialization':           5,
  'Image Processing':         15,
  'Content Generation':       30,
  'Translation':              35,
  'Database Save (rendering)':40,
  'Template Selection':       45,
  'HTML Generation':          55,
  'Screenshot Generation':    70,
  'Font Loading':             72,
  'Playwright Launch':        74,
  'PNG Screenshot Creation':  80,
  'Supabase Upload (PNG)':    85,
  'PDF Generation':           88,
  'PDF Creation':             90,
  'Supabase Upload (PDF)':    93,
  'Database Save (completed)':97,
  'Email Notification':       99,
  'Final Response':           100,
};

const MAX_POLL_MS     = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL   = 3000;           // 3 seconds
const MAX_CONSEC_FAIL = 150;            // 150 consecutive polls (~7.5 min) to tolerate server wake-up/deploys

function getProgress(stage?: string): number {
  if (!stage) return 10;
  return STAGE_PROGRESS[stage] ?? 10;
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export const PreviewScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const generations = useGenerationStore((state) => state.generations);
  const generation = generations.find(g => g.id === id);
  const updateGeneration = useGenerationStore((state) => state.updateGeneration);

  const [downloading, setDownloading] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isPosted, setIsPosted] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  
  const user = useAuthStore((state) => state.user);
  const userState = useAuthStore((state) => state.userState) || '';
  const district = useAuthStore((state) => state.district) || '';

  // Check current clipping approval status from DB
  useEffect(() => {
    if (!generation?.id) return;
    const checkStatus = async () => {
      try {
        const { data } = await supabase
          .from('clippings')
          .select('status, is_posted')
          .eq('id', generation.id)
          .maybeSingle();

        if (data) {
          if (data.is_posted || data.status === 'approved') {
            setIsPosted(true);
            setApprovalStatus('approved');
          } else if (data.status === 'pending_approval') {
            setApprovalStatus('pending');
          } else if (data.status === 'rejected') {
            setApprovalStatus('rejected');
          }
        }
      } catch {
        /* silent */
      }
    };
    checkStatus();
  }, [generation?.id]);
  
  const [pollAttempt, setPollAttempt]   = useState(0);
  const [elapsedMs,  setElapsedMs]      = useState(0);
  const [liveStage, setLiveStage]       = useState<string>('');

  const startTimeRef    = useRef<number>(Date.now());
  const consecFailRef   = useRef<number>(0);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (
      !generation ||
      generation.status === 'completed' ||
      generation.status === 'failed' ||
      generation.png_url
    ) return;

    startTimeRef.current  = Date.now();
    consecFailRef.current = 0;
    setPollAttempt(0);
    setElapsedMs(0);

    // ── Elapsed-time ticker ──────────────────────────────────────────────────
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);

    // ── Main polling loop ────────────────────────────────────────────────────
    intervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTimeRef.current;

      // Hard 10-minute timeout
      if (elapsed >= MAX_POLL_MS) {
        console.warn(`[POLL] 10-minute timeout reached. Stopping.`);
        clearInterval(intervalRef.current!);
        clearInterval(elapsedTimerRef.current!);
        updateGeneration(generation.id, {
          status:  'failed',
          stage:   'Polling Timeout',
          message: `Generation did not complete within 10 minutes (${fmtElapsed(elapsed)}). The backend may still be running — check Render logs.`,
          error:   'Frontend polling timeout after 10 minutes.',
        } as any);
        return;
      }

      setPollAttempt(n => n + 1);
      const attempt = pollAttempt + 1;
      const ts = new Date().toISOString();
      console.log(`[POLL] #${attempt} | elapsed=${fmtElapsed(elapsed)} | ${ts}`);

      try {
        const pollRes = await generationService.getById(generation.id) as any;
        const generationData = pollRes?.data || pollRes;

        if (generationData && generationData.id) {
          // Successful response — reset consecutive-failure counter
          consecFailRef.current = 0;

          // Track live stage for progress bar
          const stage = generationData.stage || generationData.current_stage || liveStage;
          if (stage) setLiveStage(stage);

          // Compute progress from stage map
          const progress = generationData.progress ?? getProgress(stage);

          updateGeneration(generation.id, { ...generationData, progress });

          console.log(`[POLL] #${attempt} | status=${generationData.status} | stage=${stage} | progress=${progress}%`);

          if (generationData.status === 'completed' || generationData.status === 'failed') {
            clearInterval(intervalRef.current!);
            clearInterval(elapsedTimerRef.current!);
          }
        }
      } catch (e: any) {
        consecFailRef.current += 1;
        const cf = consecFailRef.current;

        console.warn(`[POLL] #${attempt} NETWORK ERROR (consecutive=${cf}):`, e?.message || e);

        // If server returns 503/502 → likely Render waking up
        const status = e?.response?.status;
        if (status === 503 || status === 502 || status === 0 || !status) {
          // setServerWaking(true);
        }

        if (cf >= MAX_CONSEC_FAIL) {
          console.warn(`[POLL] Too many consecutive network failures (${cf}). Stopping.`);
          clearInterval(intervalRef.current!);
          clearInterval(elapsedTimerRef.current!);
          updateGeneration(generation.id, {
            status:  'failed',
            stage:   'Polling Network Failures',
            message: `Polling stopped after ${cf} consecutive network errors. Please check your network connection.`,
            error:   'Too many consecutive polling network failures.',
          } as any);
        }
      }
    }, POLL_INTERVAL);

    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(elapsedTimerRef.current!);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation?.id, generation?.status]);

  if (!generation) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <p className="text-gray-500">Clipping not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 font-medium">Go Back</button>
      </div>
    );
  }

  const handleDownload = async (format: 'jpg' | 'pdf' | 'mp4') => {
    setDownloading(true);
    try {
      let blob;
      if (format === 'mp4') {
        const videoSrc = generation.mp4_url || (generation as any).mp4Url || generation.config?.videoUrl;
        if (!videoSrc) throw new Error("Video URL not available");
        const res = await fetch(videoSrc);
        blob = await res.blob();
      } else if (format === 'jpg') {
        if (!generation.png_url) throw new Error("JPG URL not available");
        let downloadSrc = generation.png_url;
        try {
          const reporterSlug = (generation.config?.reporterName || 'reporter').toLowerCase().replace(/\s+/g, '-');
          const link = newsLink(generation.id, reporterSlug);
          downloadSrc = await stampClipping(generation.png_url, link);
        } catch (stampErr) {
          console.warn("Could not stamp clipping, proceeding with raw image:", stampErr);
        }
        const res = await fetch(downloadSrc);
        blob = await res.blob();
      } else {
        if (generation.pdf_url) {
          const res = await fetch(generation.pdf_url);
          blob = await res.blob();
        } else {
          blob = await generationService.exportPdf(generation.id);
        }
      }

      const fileName = `newscraft-${generation.id}.${format}`;

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          let base64data = reader.result as string;
          if (base64data.includes(',')) base64data = base64data.split(',')[1];
          try {
            if (Capacitor.getPlatform() === 'android') {
              await Filesystem.requestPermissions();
            }
            await Filesystem.writeFile({ path: fileName, data: base64data, directory: Directory.Documents });
            alert(`${format.toUpperCase()} Downloaded successfully to your Documents!`);
          } catch (e) {
            console.error("Filesystem write error", e);
            alert(`Failed to save to device storage: ${e}`);
          } finally {
            setDownloading(false);
          }
        };
      } else {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        alert(`${format.toUpperCase()} Downloaded successfully to your device!`);
        setDownloading(false);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to download ${format.toUpperCase()}`);
      setDownloading(false);
    }
  };

  const handlePostToFeed = async () => {
    if (!generation?.id) return;
    if (!userState || !district) {
      alert('Please set your State and District in Settings before sending to the feed.');
      return;
    }
    
    setIsPosting(true);
    try {
      // 1. Submit clipping to DB with pending_approval status and is_posted = false
      const { error } = await supabase
        .from('clippings')
        .update({ 
          state: userState, 
          district: district, 
          is_posted: false, 
          status: 'pending_approval' 
        })
        .eq('id', generation.id);
        
      if (error) {
        console.error('Supabase error submitting clipping:', error);
        throw error;
      }
      setApprovalStatus('pending');

      // 2. Insert In-App Notifications for the specific District Admin and Superadmins
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, email, district, role')
          .in('role', ['admin', 'superadmin']);

        const targetAdmins = (admins || []).filter(
          (adm) =>
            adm.role === 'superadmin' ||
            (adm.role === 'admin' &&
              adm.district &&
              adm.district.trim().toLowerCase() === district.trim().toLowerCase())
        );

        if (targetAdmins.length > 0) {
          const headline = generation.config?.headline || generation.headline || 'New Newspaper Clipping';
          const notifs = targetAdmins.map((adm) => ({
            user_id: adm.id,
            user_email: adm.email,
            title: `📰 [${district}] New Clipping for Approval`,
            message: `A reporter submitted "${headline.substring(0, 50)}" for ${district} District Admin review before publishing to feed.`,
            notification_type: 'clipping_approval_request'
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch (notifErr) {
        console.warn('Failed to insert district admin notification:', notifErr);
      }

      // 3. Dispatch FCM Push Notification to topic for district admin alerts
      try {
        const headline = generation.config?.headline || generation.headline || 'New Newspaper Clipping';
        api.post('/api/v1/notifications/send', {
          topic: `district_${district}`,
          title: `📰 [${district}] New Clipping for Approval`,
          body: `A clipping was submitted for ${district} District Admin approval: ${headline.substring(0, 60)}`,
          url: `/admin`,
          channel_id: 'reporter'
        }).catch(() => {});
      } catch { /* non-critical */ }

      alert(`✅ Clipping submitted to ${district} District Admin for approval! Once approved by your District Admin, it will automatically appear in the public feed.`);
    } catch (err) {
      console.error('Error submitting clipping for approval:', err);
      alert('Failed to submit clipping for approval. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  // ── Derived state for the progress UI ────────────────────────────────────
  const progressPercent = generation.progress ?? getProgress(liveStage || generation.stage);
  const timeLeft        = Math.max(0, MAX_POLL_MS - elapsedMs);

  return (
    <div className="h-screen bg-[#dceef8] flex flex-col fixed inset-0 z-50 font-sans text-[#0a1a2e]">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="h-16 bg-[#015BB3] border-b-[3px] border-[#145AB1] flex items-center px-4 shrink-0 shadow-sm relative z-20">
        <button
          onClick={() => {
            if (generation.status === 'processing' || generation.status === 'pending') {
              if (window.confirm("Cancel generation?")) navigate(-1);
            } else {
              navigate(-1);
            }
          }}
          className="w-10 h-10 bg-[#cc2222] active:bg-[#a01b1b] rounded-full text-white transition-colors flex items-center justify-center shrink-0 mr-4 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 ml-[-2px]" />
        </button>
        <div className="flex flex-col flex-1 truncate">
          <span className="text-white font-bold text-[17px] tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>Preview</span>
          <span className="text-[10px] text-[#a0c4dc] tracking-wider truncate">
            clipping_{generation.id.slice(0, 8)}.jpg
          </span>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center relative z-10">

        {/* ── STATE 1: GENERATING ────────────────────────────────────────── */}
        {(!generation.png_url && generation.status !== 'failed') && (
          <div className="flex flex-col items-center w-full max-w-sm px-4">
            {/* SPINNER */}
            <div className="relative w-[120px] h-[120px] flex items-center justify-center mb-6">
              {/* Outer glowing ring */}
              <div className="absolute inset-0 rounded-full border-[2px] border-[#cc2222]/20 shadow-[0_0_15px_rgba(204,34,34,0.3)] animate-pulse" style={{ animationDuration: '3s' }} />
              {/* Inner ring */}
              <div className="absolute inset-0 rounded-full border-[4px] border-transparent border-t-[#cc2222] border-r-[#cc2222] animate-spin" style={{ animationDuration: '1.8s', animationTimingFunction: 'linear' }} />
              {/* Orbiting dot */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationTimingFunction: 'linear' }}>
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-[#cc2222] rounded-full shadow-[0_0_8px_#cc2222] transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              {/* Center Icon */}
              <div className="w-12 h-12 bg-white rounded-[10px] shadow-[0_0_12px_rgba(204,34,34,0.2)] flex items-center justify-center text-[#0a2540] animate-pulse" style={{ animationDuration: '2s' }}>
                <FileText className="w-6 h-6" />
              </div>
            </div>

            {/* STATUS TEXT */}
            <h2 className="text-[#0a1a2e] font-bold text-[16px] mb-1 text-center" style={{ fontFamily: 'Georgia, serif' }}>Generating Clipping</h2>
            <p className="text-[#a0c4dc] text-[10px] font-medium mb-3 text-center">Processing newspaper layout</p>
            <div className="text-[#cc2222] font-bold text-[28px] mb-6 tracking-tight drop-shadow-sm transition-all duration-300 transform scale-105">{progressPercent}%</div>

            {/* PROGRESS BAR */}
            <div className="w-full mb-6">
              <div className="flex justify-between text-[9px] uppercase font-bold text-[#a0c4dc] mb-1.5">
                <span>Progress</span>
                <span>{progressPercent}/100</span>
              </div>
              <div className="w-full h-[8px] bg-[#b8d4e8] rounded-[4px] overflow-hidden shadow-inner relative">
                {/* Liquid / Shimmer Progress Fill */}
                <div
                  className="absolute top-0 left-0 h-full rounded-[4px] transition-all duration-500 ease-out"
                  style={{ 
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #cc2222, #ff6666, #cc2222)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite linear'
                  }}
                />
              </div>
            </div>

            {/* INFO CARD */}
            <div className="w-full bg-white border border-[#b8d4e8] rounded-lg p-3.5 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-2.5 animate-in slide-in-from-right-4 duration-300 fade-in fill-mode-both" style={{ animationDelay: '0ms' }}>
                <span className="text-[#0a1a2e] text-[10px] font-semibold">Poll #</span>
                <span className="text-[#0a1a2e] text-[10px] font-mono font-medium">{pollAttempt}</span>
              </div>
              <div className="flex justify-between items-center mb-2.5 animate-in slide-in-from-right-4 duration-300 fade-in fill-mode-both" style={{ animationDelay: '100ms' }}>
                <span className="text-[#0a1a2e] text-[10px] font-semibold">Elapsed</span>
                <span className="text-[#0a1a2e] text-[10px] font-mono font-medium">{(elapsedMs / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between items-center mb-2.5 animate-in slide-in-from-right-4 duration-300 fade-in fill-mode-both" style={{ animationDelay: '200ms' }}>
                <span className="text-[#0a1a2e] text-[10px] font-semibold">Timeout in</span>
                <span className="text-[#0a1a2e] text-[10px] font-mono font-medium">{(timeLeft / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between items-center animate-in slide-in-from-right-4 duration-300 fade-in fill-mode-both" style={{ animationDelay: '300ms' }}>
                <span className="text-[#0a1a2e] text-[10px] font-semibold">Pattern</span>
                <span className="text-[#0a1a2e] text-[10px] font-mono font-medium">Pattern {generation.config?.layoutPattern || 'A'}</span>
              </div>
            </div>

            {/* HINT BAR */}
            <div className="w-full bg-[#015BB3] rounded-[6px] py-[10px] px-[14px] flex items-center justify-center gap-2 shadow-sm animate-in zoom-in-95 duration-500 fill-mode-both" style={{ animationDelay: '400ms' }}>
              <div className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-white text-[9px] font-bold font-serif italic">i</span>
              </div>
              <span className="text-white text-[10px] font-medium tracking-wide">Checking every 3 seconds &middot; Do not close this screen</span>
            </div>
          </div>
        )}

        {/* ── STATE 3: ERROR ─────────────────────────────────────────────── */}
        {(!generation.png_url && generation.status === 'failed') && (
           <div className="flex flex-col items-center w-full max-w-sm px-4">
              <div className="w-[120px] h-[120px] rounded-full bg-[#cc2222] flex items-center justify-center mb-6 shadow-lg animate-in fade-in zoom-in duration-300" style={{ animation: 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both' }}>
                <span className="text-white text-[60px] font-bold leading-none mt-[-4px]">!</span>
              </div>
              <h2 className="text-[#cc2222] font-bold text-[18px] mb-2 text-center" style={{ fontFamily: 'Georgia, serif' }}>Generation Failed</h2>
              <div className="bg-white border border-[#b8d4e8] p-4 rounded-lg w-full mb-8 shadow-sm">
                <p className="text-[#0a1a2e] text-[12px] text-center font-medium leading-relaxed">
                  {generation.message || generation.error || 'An unexpected error occurred during clipping generation.'}
                </p>
              </div>
              
              <div className="flex flex-col gap-2.5 w-full">
                <button 
                  onClick={() => {
                    updateGeneration(generation.id, {
                      status: 'pending',
                      error: undefined,
                      message: undefined,
                      stage: 'Resuming Polling',
                    } as any);
                    consecFailRef.current = 0;
                    startTimeRef.current = Date.now();
                  }}
                  className="w-full bg-[#cc2222] active:bg-[#a01b1b] text-white py-[14px] rounded-[8px] font-bold text-xs tracking-wider uppercase transition-colors shadow-sm flex justify-center items-center gap-2"
                >
                  <span>Resume / Check Result</span>
                </button>
                <button 
                  onClick={() => navigate('/generate')}
                  className="w-full bg-white border border-[#b8d4e8] text-[#0a2540] py-[12px] rounded-[8px] font-bold text-xs tracking-wider uppercase transition-colors shadow-sm flex justify-center items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Generator</span>
                </button>
              </div>
           </div>
        )}

        {/* ── STATE 2: COMPLETE ───────────────────────────────────────────── */}
        {(generation.png_url) && (
          <div className="flex flex-col items-center w-full h-full relative animate-in fade-in duration-500 pb-2">
             <div className="flex flex-col items-center mb-4 shrink-0 relative">
               <div className="absolute inset-0 bg-[#015BB3] rounded-full opacity-0 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
               <div className="w-12 h-12 rounded-full bg-[#015BB3] flex items-center justify-center mb-2 shadow-sm animate-in zoom-in duration-500" style={{ animationTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}>
                 <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: 'draw 0.4s ease-out 0.3s forwards' }} />
                 </svg>
               </div>
               <h2 className="text-[#0a1a2e] font-bold text-[18px] animate-in slide-in-from-bottom-2 duration-300" style={{ fontFamily: 'Georgia, serif' }}>Clipping Ready</h2>
             </div>

             <div className="flex-1 w-full min-h-0 flex justify-center mb-5 bg-white border-[2px] border-[#cc2222] p-1 shadow-sm relative overflow-hidden group animate-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
               {/* This box contains the actual clipping. No watermarks inside here! */}
               {generation.mp4_url || generation.config?.videoUrl ? (
                 <video
                    src={generation.mp4_url || generation.config?.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain bg-white transition-transform duration-700 ease-out hover:scale-[1.02]"
                 />
               ) : (
                 <img
                    src={generation.png_url}
                    alt="Newspaper Preview"
                    className="w-full h-full object-contain bg-white transition-transform duration-700 ease-out hover:scale-[1.02]"
                    style={{ imageRendering: 'crisp-edges' as any }}
                  />
               )}
             </div>

             <div className="w-full shrink-0 flex flex-col gap-2">
                <div className="flex w-full gap-2">
                  {(generation.mp4_url || (generation as any).mp4Url || generation.config?.videoUrl) ? (
                    <>
                      <button
                        onClick={() => handleDownload('mp4')}
                        disabled={downloading}
                        className="flex-1 py-[14px] bg-[#cc2222] hover:bg-[#ff3333] active:bg-[#a01b1b] text-white rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-[0_4px_12px_rgba(204,34,34,0.3)] animate-in slide-in-from-bottom-2 duration-300 delay-200 fill-mode-both relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-[shimmerSweep_1s_ease-out]" />
                        <Download className="w-4 h-4 shrink-0" />
                        <span>Save Video</span>
                      </button>

                      <button
                        onClick={() => handleDownload('jpg')}
                        disabled={downloading}
                        className="flex-1 py-[14px] bg-[#015BB3] hover:bg-[#145AB1] active:bg-[#015BB3] text-white rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-[0_4px_12px_rgba(1,91,179,0.3)] animate-in slide-in-from-bottom-2 duration-300 delay-300 fill-mode-both relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:animate-[shimmerSweep_1s_ease-out]" />
                        <Download className="w-4 h-4 shrink-0" />
                        <span>Save JPG</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDownload('jpg')}
                        disabled={downloading}
                        className="flex-1 py-[14px] bg-[#cc2222] hover:bg-[#ff3333] active:bg-[#a01b1b] text-white rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-[0_4px_12px_rgba(204,34,34,0.3)] animate-in slide-in-from-bottom-2 duration-300 delay-200 fill-mode-both relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-[shimmerSweep_1s_ease-out]" />
                        <Download className="w-4 h-4 shrink-0" />
                        <span>Save JPG</span>
                      </button>

                      <button
                        onClick={() => handleDownload('pdf')}
                        disabled={downloading}
                        className="flex-1 py-[14px] bg-[#015BB3] hover:bg-[#145AB1] active:bg-[#015BB3] text-white rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-[0_4px_12px_rgba(1,91,179,0.3)] animate-in slide-in-from-bottom-2 duration-300 delay-300 fill-mode-both relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:animate-[shimmerSweep_1s_ease-out]" />
                        <FileDown className="w-4 h-4 shrink-0" />
                        <span>Save PDF</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex w-full gap-2">
                  <button
                    onClick={() => setIsShareSheetOpen(true)}
                    disabled={downloading || isPosting}
                    className="flex-1 py-[14px] bg-[#dceef8] hover:bg-[#b8d4e8] active:bg-[#b8d4e8] text-[#0a2540] border-[1px] border-[#b8d4e8] rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md animate-in slide-in-from-bottom-2 duration-300 delay-400 fill-mode-both relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/40 translate-x-[-100%] group-hover:animate-[shimmerSweep_1s_ease-out]" />
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={handlePostToFeed}
                    disabled={downloading || isPosting || isPosted || approvalStatus === 'pending'}
                    className={`flex-1 py-[14px] rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm animate-in slide-in-from-bottom-2 duration-300 delay-400 fill-mode-both relative overflow-hidden group ${
                      isPosted || approvalStatus === 'approved'
                        ? 'bg-[#25D366] text-white border-[1px] border-[#25D366]' 
                        : approvalStatus === 'pending'
                        ? 'bg-[#F59E0B] text-white border-[1px] border-[#D97706]'
                        : approvalStatus === 'rejected'
                        ? 'bg-[#EF4444] text-white border-[1px] border-[#DC2626]'
                        : 'bg-[#fff] hover:bg-[#f0f0f0] active:bg-[#e0e0e0] text-[#015BB3] border-[1px] border-[#015BB3]'
                    }`}
                  >
                    {isPosted || approvalStatus === 'approved' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Live on Feed</span>
                      </>
                    ) : approvalStatus === 'pending' ? (
                      <>
                        <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                        <span>Pending District Admin</span>
                      </>
                    ) : approvalStatus === 'rejected' ? (
                      <>
                        <Send className="w-4 h-4 shrink-0" />
                        <span>Rejected (Resubmit)</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 shrink-0" />
                        <span>{isPosting ? 'Submitting...' : 'Send for Approval'}</span>
                      </>
                    )}
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* ── Share After Clipping Modal (Clipping, Reporter Card, Status) ─── */}
      {isShareSheetOpen && (generation?.png_url || generation?.mp4_url || (generation as any)?.mp4Url || generation?.config?.videoUrl) && (
        <ShareAfterClipping
          post={{
            id: generation.id,
            headline: generation.config?.headline || 'RTI Express Spot News',
            place: district || userState || 'హైదరాబాద్',
            date: new Date().toLocaleDateString('te-IN', { day: 'numeric', month: 'short' }),
            clippingUrl: generation.png_url || "",
            thumbUrl: generation.png_url || "",
            videoUrl: generation.mp4_url || (generation as any)?.mp4Url || generation.config?.videoUrl || undefined,
          }}
          reporter={{
            id: (generation as any)?.user_id || user?.id || 'reporter',
            name: generation.config?.reporterName || user?.full_name || 'Spot News Reporter',
            slug: (generation.config?.reporterName || user?.full_name || 'reporter')
              .toLowerCase()
              .replace(/\s+/g, '-'),
            verified: true,
            avgStars: 4.8,
            ratingsCount: 28,
            stories: 18,
            views: 320,
            experienceYears: 3,
            photoUrl: user?.avatarUrl,
          }}
          onClose={() => setIsShareSheetOpen(false)}
        />
      )}

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes draw {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes shimmerSweep {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

