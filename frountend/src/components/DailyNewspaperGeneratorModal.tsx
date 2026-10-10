import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Check, X, AlertTriangle, ArrowUp, ArrowDown,
  Download, Image as ImageIcon, CheckCircle2, Layout, Newspaper, Loader2
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import {
  dailyNewspaperService,
  type EligibleArticle,
  type DailyNewspaperConfig
} from '@/services/daily-newspaper.service';
import { getPublicationLogos, type PublicationLogo } from '@/services/admin.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DailyNewspaperGeneratorModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  // Step navigation: 1: Setup & Logo, 2: Articles & Order, 3: Preview & Overflows, 4: Complete
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [editionDate, setEditionDate] = useState<string>(() => {
    // Default to today in Asia/Kolkata
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
  });

  const [availableLogos, setAvailableLogos] = useState<PublicationLogo[]>([]);
  const [selectedLogo, setSelectedLogo] = useState<PublicationLogo | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Articles & Selection
  const [loadingClippings, setLoadingClippings] = useState(false);
  const [allClippings, setAllClippings] = useState<EligibleArticle[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [orderedArticles, setOrderedArticles] = useState<EligibleArticle[]>([]);
  const [leadStoryId, setLeadStoryId] = useState<string | null>(null);

  // Preview & Generation
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);

  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<{
    pdf_url: string;
    pdf_base64?: string | null;
    total_pages: number;
    total_articles: number;
    edition_id: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Logos on Mount
  useEffect(() => {
    if (isOpen) {
      getPublicationLogos().then((logos) => {
        const activeLogos = logos.filter((l) => l.is_active !== false);
        setAvailableLogos(activeLogos);
        if (activeLogos.length > 0 && !selectedLogo) {
          setSelectedLogo(activeLogos[0]);
        }
      });
    }
  }, [isOpen]);

  // Fetch eligible clippings whenever editionDate changes
  useEffect(() => {
    if (isOpen && editionDate) {
      fetchClippingsForDate(editionDate);
    }
  }, [isOpen, editionDate]);

  const fetchClippingsForDate = async (dateStr: string) => {
    setLoadingClippings(true);
    setErrorMsg(null);
    try {
      const res = await dailyNewspaperService.getEligibleClippings(dateStr);
      setAllClippings(res.articles);
      
      // Auto-select all fetched articles initially
      const initialIds = new Set(res.articles.map((a) => a.id));
      setSelectedArticleIds(initialIds);
      setOrderedArticles(res.articles);
      
      if (res.articles.length > 0) {
        // Set lead story to article at index 3 or index 0
        const leadCandidate = res.articles[3] || res.articles[0];
        setLeadStoryId(leadCandidate.id);
      } else {
        setLeadStoryId(null);
      }
    } catch (err: any) {
      setErrorMsg('Failed to load eligible clippings for selected date.');
    } finally {
      setLoadingClippings(false);
    }
  };

  // Toggle selection of an article
  const toggleArticleSelection = (id: string) => {
    const next = new Set(selectedArticleIds);
    if (next.has(id)) {
      next.delete(id);
      if (leadStoryId === id) {
        const remaining = orderedArticles.filter((a) => next.has(a.id) && a.id !== id);
        setLeadStoryId(remaining[0]?.id || null);
      }
    } else {
      next.add(id);
      if (!leadStoryId) setLeadStoryId(id);
    }
    setSelectedArticleIds(next);
  };

  // Move article up/down in list order
  const moveArticle = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= orderedArticles.length) return;
    
    const next = [...orderedArticles];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setOrderedArticles(next);
  };

  // Filter selected articles for generation
  const activeSelectedArticles = orderedArticles.filter((a) => selectedArticleIds.has(a.id));

  // Compute total pages: 10 articles per page
  const totalArticlesCount = activeSelectedArticles.length;
  const computedPageCount = Math.max(1, Math.ceil(totalArticlesCount / 10));

  // Handle live HTML preview fetch
  const handleFetchPreview = async () => {
    if (!selectedLogo) {
      setLogoError('Selection required! Please select a publication logo before generating preview.');
      setStep(1);
      return;
    }
    setLogoError(null);

    if (activeSelectedArticles.length === 0) {
      setErrorMsg('No articles selected. Please select at least 1 article.');
      return;
    }

    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const config: DailyNewspaperConfig = {
        publication_code: selectedLogo.publication_code,
        publication_name: selectedLogo.name,
        logo_url: selectedLogo.logo_url,
        edition_date: editionDate,
        articles: activeSelectedArticles.map((a) => ({
          ...a,
          content: a.custom_excerpt || a.content || a.summary || '',
        })),
        lead_story_id: leadStoryId || undefined,
      };

      const res = await dailyNewspaperService.preview(config);
      setPreviewHtml(res.html);
      setPreviewTotalPages(res.total_pages);
      setPreviewCurrentPage(1);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to render preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Trigger Backend PDF Generation
  const handleGeneratePDF = async () => {
    if (!selectedLogo) {
      setLogoError('Selection required! Please select a publication logo.');
      return;
    }

    if (activeSelectedArticles.length === 0) {
      setErrorMsg('Cannot generate PDF: 0 articles selected.');
      return;
    }

    setGenerating(true);
    setGenerationProgress(15);
    setErrorMsg(null);

    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => (prev < 85 ? prev + 10 : prev));
    }, 1500);

    try {
      const config: DailyNewspaperConfig = {
        publication_code: selectedLogo.publication_code,
        publication_name: selectedLogo.name,
        logo_url: selectedLogo.logo_url,
        edition_date: editionDate,
        articles: activeSelectedArticles.map((a) => ({
          ...a,
          content: a.custom_excerpt || a.content || a.summary || '',
        })),
        lead_story_id: leadStoryId || undefined,
        overwrite_existing: true,
      };

      const res = await dailyNewspaperService.generate(config);
      clearInterval(progressInterval);
      setGenerationProgress(100);

      setGeneratedResult({
        pdf_url: res.pdf_url,
        pdf_base64: res.pdf_base64 || null,
        total_pages: res.total_pages,
        total_articles: res.total_articles,
        edition_id: res.edition_id,
      });

      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      clearInterval(progressInterval);
      setGenerating(false);
      setGenerationProgress(0);
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to generate Daily Newspaper PDF.');
    }
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadA3PDF = async () => {
    if (!generatedResult?.pdf_url) {
      // Re-generate if needed
      await handleGeneratePDF();
      return;
    }

    setDownloading(true);
    try {
      const targetUrl = generatedResult.pdf_url;
      // Use the base64 PDF from the server response directly to avoid
      // ephemeral filesystem / 404 issues when fetching from URL
      const b64 = generatedResult.pdf_base64;
      const fileName = `DailyNewspaper-${editionDate}-${Date.now()}.pdf`;

      if (Capacitor.isNativePlatform()) {
        // Android: write base64 PDF directly to Documents and share
        let base64data: string;
        if (b64) {
          base64data = b64;
        } else {
          // Fallback: fetch from URL
          const res = await fetch(targetUrl);
          const blob = await res.blob();
          base64data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              let d = reader.result as string;
              if (d.includes(',')) d = d.split(',')[1];
              resolve(d);
            };
          });
        }
        try {
          if (Capacitor.getPlatform() === 'android') await Filesystem.requestPermissions();
          const writeRes = await Filesystem.writeFile({
            path: fileName,
            data: base64data,
            directory: Directory.Documents,
            recursive: true,
          });
          try {
            await Share.share({
              title: fileName,
              text: `Daily Newspaper A3 Edition - ${editionDate}`,
              url: writeRes.uri || targetUrl,
              dialogTitle: 'Open/Save Daily Newspaper Edition',
            });
          } catch {
            await Browser.open({ url: targetUrl });
          }
          alert(`Saved to Documents as ${fileName}.`);
        } catch (e: any) {
          console.error('Filesystem write error', e);
          try { await Browser.open({ url: targetUrl }); } catch {}
        } finally {
          setDownloading(false);
        }
      } else {
        // Web: create blob URL from base64 or fallback to direct URL
        if (b64) {
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } else {
          const a = document.createElement('a');
          a.href = targetUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setDownloading(false);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || 'Failed to open newspaper'}`);
      setDownloading(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-[#D0E2F7]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0A2540] via-[#0F3459] to-[#0A2540] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Daily Newspaper PDF Generator
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-black uppercase tracking-wider">
                  Super Admin
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Telugu BroadSheet Dense Grid Layout • A3 Portrait Print Ready
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-4 overflow-x-auto no-scrollbar text-xs font-bold shrink-0 whitespace-nowrap">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#0A2540]' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-[#0A2540] text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
            <span>Date & Branding</span>
          </div>
          <div className="h-0.5 w-8 shrink-0 bg-slate-300" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#0A2540]' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? 'bg-[#0A2540] text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
            <span>Articles & Grid Order ({totalArticlesCount})</span>
          </div>
          <div className="h-0.5 w-8 shrink-0 bg-slate-300" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#0A2540]' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? 'bg-[#0A2540] text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
            <span>Live A3 Preview & Fit</span>
          </div>
          <div className="h-0.5 w-8 shrink-0 bg-slate-300" />
          <div className={`flex items-center gap-2 ${step >= 4 ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>4</span>
            <span>Final PDF</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* STEP 1: Date & Publication Logo Selection */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Date Selection Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-extrabold uppercase text-slate-600 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0A2540]" />
                  Edition Date (Default: Today in Asia/Kolkata)
                </label>
                <input
                  type="date"
                  value={editionDate}
                  onChange={(e) => setEditionDate(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-[#0A2540] focus:ring-2 focus:ring-[#0A2540] outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  Clippings published to feed on or before this date will be collected.
                </p>
              </div>

              {/* Requirement 3: Selected Publication Logo Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-extrabold uppercase text-slate-600 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0A2540]" />
                    Selected Publication Logo <span className="text-red-600 font-bold">*REQUIRED</span>
                  </span>
                  {selectedLogo && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Selected: {selectedLogo.name}
                    </span>
                  )}
                </label>

                {logoError && (
                  <p className="text-xs font-bold text-red-600 mb-3 bg-red-50 p-2 rounded-lg border border-red-200">
                    {logoError}
                  </p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availableLogos.map((logo) => {
                    const isSel = selectedLogo?.id === logo.id;
                    return (
                      <div
                        key={logo.id}
                        onClick={() => {
                          setSelectedLogo(logo);
                          setLogoError(null);
                        }}
                        className={`cursor-pointer rounded-2xl p-3 border-2 transition-all flex flex-col items-center justify-between text-center bg-white ${
                          isSel
                            ? 'border-[#0A2540] ring-4 ring-[#0A2540]/10 shadow-md scale-[1.02]'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="w-full h-16 flex items-center justify-center p-1 border border-slate-100 rounded-xl bg-slate-50 mb-2">
                          <img
                            src={logo.logo_url}
                            alt={logo.name}
                            className="max-h-14 max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = logo.logo_url;
                            }}
                          />
                        </div>
                        <span className="text-xs font-extrabold text-[#0A2540] line-clamp-1">{logo.name}</span>
                        {isSel && (
                          <span className="mt-1 text-[10px] font-extrabold bg-[#0A2540] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active Brand
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Eligible Clippings Summary */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-[#0A2540]">
                    Published Clippings for {editionDate}: {allClippings.length} Found
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Drafts and unpublished clippings are automatically excluded.
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={allClippings.length === 0 || !selectedLogo}
                  className="px-5 py-2.5 bg-[#0A2540] text-white rounded-xl text-xs font-bold hover:bg-[#0A2540]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
                >
                  Configure Articles & Grid →
                </button>
              </div>

              {allClippings.length === 0 && !loadingClippings && (
                <div className="p-8 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No published clippings found for this date.</p>
                  <p className="text-xs text-slate-500 mt-1">Please select another date or publish reporter clippings first.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Article Selection, Lead Story & Order */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Page count summary pill */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                  <Layout className="w-5 h-5 text-amber-700 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black text-amber-900">
                      Total Selected Articles: {totalArticlesCount} &nbsp;→&nbsp; {computedPageCount} Page(s) Output
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      10 articles per page (Page 1 = 10, Page 2 = {totalArticlesCount > 10 ? Math.min(10, totalArticlesCount - 10) : 0}...)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleFetchPreview}
                    disabled={totalArticlesCount === 0 || previewLoading}
                    className="px-5 py-2 bg-[#0A2540] text-white rounded-xl text-xs font-bold hover:bg-[#0A2540]/90 disabled:opacity-40 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    {previewLoading ? 'Building A3 Preview...' : 'View Live A3 Preview →'}
                  </button>
                </div>
              </div>

              {/* Articles Grid / Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto min-w-full">
                  <div className="min-w-[600px]">
                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-extrabold text-slate-700 uppercase">
                      <span>Articles List & Grid Order ({orderedArticles.length})</span>
                      <span>Lead Story & Controls</span>
                    </div>

                <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
                  {orderedArticles.map((art, idx) => {
                    const isSelected = selectedArticleIds.has(art.id);
                    const isLead = leadStoryId === art.id;

                    return (
                      <div
                        key={art.id}
                        className={`p-3.5 flex items-center justify-between transition-colors ${
                          isLead
                            ? 'bg-amber-50/70 border-l-4 border-amber-500'
                            : isSelected
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleArticleSelection(art.id)}
                            className="w-4 h-4 rounded text-[#0A2540] focus:ring-[#0A2540] cursor-pointer shrink-0"
                          />

                          <div className="w-7 h-7 rounded-lg bg-slate-200 font-black text-slate-700 text-xs flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </div>

                          {art.image_url && (
                            <img
                              src={art.image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-[#0A2540] truncate">{art.headline}</h4>
                              {isLead && (
                                <span className="text-[10px] font-black bg-amber-500 text-black px-2 py-0.5 rounded-full uppercase shrink-0">
                                  ★ Lead Story
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {art.location || 'హైదరాబాద్'} • {art.reporter_name || 'Reporter'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Lead Story Selector Radio */}
                          <label className="flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700">
                            <input
                              type="radio"
                              name="lead_story"
                              checked={isLead}
                              onChange={() => {
                                setLeadStoryId(art.id);
                                if (!selectedArticleIds.has(art.id)) toggleArticleSelection(art.id);
                              }}
                              className="text-amber-500 focus:ring-amber-400"
                            />
                            <span>Lead</span>
                          </label>

                          {/* Reorder up/down buttons */}
                          <button
                            onClick={() => moveArticle(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded-lg hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveArticle(idx, 'down')}
                            disabled={idx === orderedArticles.length - 1}
                            className="p-1 rounded-lg hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Live A3 HTML Preview & Fit Warnings */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-100 p-3 rounded-2xl border border-slate-200 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">
                    Showing A3 Preview — Page {previewCurrentPage} of {previewTotalPages}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPreviewCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={previewCurrentPage <= 1}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPreviewCurrentPage((p) => Math.min(previewTotalPages, p + 1))}
                    disabled={previewCurrentPage >= previewTotalPages}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 disabled:opacity-40"
                  >
                    Next →
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleGeneratePDF}
                    disabled={generating}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2"
                  >
                    {generating ? `Generating PDF (${generationProgress}%)...` : '✓ Generate Final A3 PDF'}
                  </button>
                </div>
              </div>

              {/* HTML iframe live preview */}
              <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-slate-800 shadow-inner h-[62vh]">
                <iframe
                  title="Daily Newspaper A3 Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Success & Download */}
          {step === 4 && generatedResult && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-black text-[#0A2540]">
                  Daily Newspaper PDF Generated Successfully!
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Edition Date: {editionDate} • {generatedResult.total_pages} Page(s) • {generatedResult.total_articles} Articles
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleDownloadA3PDF}
                  disabled={downloading}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving to Device...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Download A3 PDF
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-200"
                >
                  Close & View History
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
