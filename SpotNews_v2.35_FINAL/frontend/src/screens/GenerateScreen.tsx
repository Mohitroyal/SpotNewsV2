import { useState, useEffect, useRef } from 'react';
import { useGenerationStore, useUIStore, useAuthStore, getReporterPhoto, getReporterName } from '@/store';
import { useNavigate } from 'react-router-dom';
import { Loader2, Image as ImageIcon, X, ArrowLeft, Newspaper, CheckCircle2, Notebook, FileText, Pencil, SlidersHorizontal, UploadCloud, Video } from 'lucide-react';
import { generationService } from '@/services/generation.service';
import { prepareImage } from '@/utils/prepareImage';
import { TEMPLATES_LIST } from '@/lib/constants';
import { getActivePublicationLogos, type PublicationLogo } from '@/services/admin.service';
// import { supabase } from '@/lib/supabase';

import { ImageWarningModal } from '@/components/ImageWarningModal';
import type { Language } from '@/types';
import { LiveNewspaperPreview } from '@/components/LiveNewspaperPreview';
import { PatternSelectionModal } from '@/components/PatternSelectionModal';
import { ImageCropModal } from '@/components/ImageCropModal';
import { BORDER_COLOURS, HEADING_BG_COLOURS } from '@/constants/colours';
import { useTranslation } from '@/lib/i18n';
import { countWords, limitWords, MAX_ARTICLE_WORDS, MAX_HEADLINE_WORDS } from '@/utils/wordLimit';

// ─── Generation stage labels + progress ──────────────────────────────────────
const GEN_STAGES = [
  { label: 'Uploading Images…', pct: 10 },
  { label: 'Generating Article…', pct: 30 },
  { label: 'Creating Newspaper Layout…', pct: 55 },
  { label: 'Rendering Clipping…', pct: 75 },
  { label: 'Finalizing…', pct: 92 },
];



// ─── Shared card style ────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#F4F8FD',
  borderRadius: '14px',
  padding: '10px 14px',
  marginBottom: '7px',
  border: '1.5px solid #D6E4F5',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  textTransform: 'uppercase',
  fontSize: '14.5px',
  fontWeight: 700,
  color: '#0F487F',
  marginBottom: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  letterSpacing: '0.8px'
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Arial, sans-serif",
  fontStyle: 'normal',
  fontSize: '15px',
  fontWeight: 900,
  color: '#0F487F',
  marginBottom: '5px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#ffffff',
  border: '1px solid #D6E4F5',
  borderRadius: '10px',
  padding: '8px 12px',
  color: '#0F172A',
  fontSize: '17px',
  outline: 'none',
  boxSizing: 'border-box',
};

export const GenerateScreen = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const currentConfig = useGenerationStore((state) => state.currentConfig);
  const addGeneration = useGenerationStore((state) => state.addGeneration);
  const setConfig = useGenerationStore((state) => state.setConfig);
  const resetConfig = useGenerationStore((state) => state.resetConfig);
  const logoMode = useUIStore((state) => state.logoMode);
  const showInnerBorders = useUIStore((state) => state.showInnerBorders);
  const pendingCropImageSrc = useUIStore((state) => state.pendingCropImageSrc);
  const setPendingCropImageSrc = useUIStore((state) => state.setPendingCropImageSrc);
  const navigate = useNavigate();

  const [headline, setHeadline] = useState(limitWords(currentConfig.headline || '', MAX_HEADLINE_WORDS));
  const [headlineLimitNotice, setHeadlineLimitNotice] = useState(false);
  const headlineWords = countWords(headline);
  const handleHeadlineChange = (raw: string) => {
    // Allow the space after the 6th word while typing, but never a 7th word
    if (countWords(raw) > MAX_HEADLINE_WORDS) {
      setHeadline(limitWords(raw, MAX_HEADLINE_WORDS));
      setHeadlineLimitNotice(true);
      window.setTimeout(() => setHeadlineLimitNotice(false), 4000);
    } else {
      setHeadline(raw);
    }
  };
  const [content, setContent] = useState(limitWords(currentConfig.articleContent || ''));
  const [wordLimitNotice, setWordLimitNotice] = useState(false);
  const wordCount = countWords(content);

  // Every change (typing, paste, voice input, autofill) goes through here,
  // so the article can never exceed MAX_ARTICLE_WORDS words.
  const handleContentChange = (raw: string) => {
    if (countWords(raw) > MAX_ARTICLE_WORDS) {
      setContent(limitWords(raw, MAX_ARTICLE_WORDS));
      setWordLimitNotice(true);
      window.setTimeout(() => setWordLimitNotice(false), 4000);
    } else {
      setContent(raw);
    }
  };
  const [language, setLanguage] = useState<Language>((currentConfig.language as Language) || 'en');
  const [fontFamily, setFontFamily] = useState(currentConfig.fontFamily || 'playfair');
  const [layoutColumns, setLayoutColumns] = useState(currentConfig.layoutColumns || 3);
  const [imageUrls, setImageUrls] = useState<string[]>(currentConfig.imageUrls || []);
  const [videoUrl, setVideoUrl] = useState<string | null>(currentConfig.videoUrl || null);

  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [activeColourTab, setActiveColourTab] = useState<'border' | 'heading'>('border');
  const [showColPicker, setShowColPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(false);

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadStatus, setVideoUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Warning Popup Modal state
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [warningTitle, setWarningTitle] = useState('Image Limit Warning');
  const [canCompressWarning, setCanCompressWarning] = useState(false);
  const [pendingFileForCompression, setPendingFileForCompression] = useState<File | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const showImageWarning = (
    message: string,
    title = 'Image Limit Warning',
    canCompress = false,
    fileToCompress: File | null = null
  ) => {
    setWarningTitle(title);
    setWarningMessage(message);
    setCanCompressWarning(canCompress);
    setPendingFileForCompression(fileToCompress);
    setWarningModalOpen(true);
  };

  // Check for restored image on mount
  useEffect(() => {
    if (pendingCropImageSrc) {
      setPendingCropImageSrc(null);
      // Restored image: resize + upload directly (no crop sheet)
      fetch(pendingCropImageSrc)
        .then(res => res.blob())
        .then(blob => prepareImage(blob, { fileName: 'restored_image' }))
        .then(prepared => uploadPreparedImage(prepared))
        .catch(err => console.error('Failed to restore image:', err));
    }
  }, [pendingCropImageSrc, setPendingCropImageSrc]);

  const currentStage = stageIndex >= 0 ? GEN_STAGES[Math.min(stageIndex, GEN_STAGES.length - 1)] : null;

  const [activeLogos, setActiveLogos] = useState<PublicationLogo[]>([]);
  const [logosLoading, setLogosLoading] = useState(true);

  const selectedPattern = currentConfig.layoutPattern || 'A';
  const selectedBorderColour = currentConfig.borderColour || '#cc2222';
  const selectedHeadingBgColour = currentConfig.headingBgColour || '#fff3f3';
  const selectedTemplateId = currentConfig.templateId || 'rti_express';

  // Load active publication logos from backend / local storage
  const refreshActiveLogos = async () => {
    try {
      setLogosLoading(true);
      const logos = await getActivePublicationLogos();
      if (logos && logos.length > 0) {
        setActiveLogos(logos);
        const currentIsActive = logos.some(
          (l) => l.publication_code === selectedTemplateId || l.id === selectedTemplateId
        );
        if (!currentIsActive) {
          setConfig({ templateId: logos[0].publication_code as any });
        }
      } else {
        setActiveLogos([]);
      }
    } catch (err) {
      console.warn('Failed to load active logos:', err);
    } finally {
      setLogosLoading(false);
    }
  };

  useEffect(() => {
    refreshActiveLogos();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'spotnews_admin_publication_logos') {
        refreshActiveLogos();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const selectedLogo = activeLogos.find(
    (l) => l.publication_code === selectedTemplateId || l.id === selectedTemplateId
  ) || (activeLogos.length > 0 ? activeLogos[0] : null);

  const selectedTemplateDetails = selectedLogo
    ? { id: selectedLogo.publication_code, name: selectedLogo.name, logo_url: selectedLogo.logo_url }
    : (TEMPLATES_LIST.find((t) => t.id === selectedTemplateId) || { id: selectedTemplateId, name: 'RTI Express', logo_url: '' });

  useEffect(() => {
    if (selectedTemplateId === 'rti_express') {
      useUIStore.getState().setLogoMode(true);
      setConfig({
        borderColour: '#cc2222',
        headingBgColour: '#cc2222'
      });
    }
  }, [selectedTemplateId, setConfig]);

  const maxImages = ['A', 'B'].includes(selectedPattern) ? 1 : ['C', 'D'].includes(selectedPattern) ? 2 : 3;

  const getColourDetails = (hex: string, isBorder: boolean) => {
    const palettes = isBorder ? BORDER_COLOURS : HEADING_BG_COLOURS;
    const allColours = [...palettes.classic, ...palettes.lightAndSoft];
    return allColours.find(c => c.hex.toLowerCase() === hex.toLowerCase()) || { name: 'Custom', hex };
  };

  const activeColourDetails = activeColourTab === 'border'
    ? getColourDetails(selectedBorderColour, true)
    : getColourDetails(selectedHeadingBgColour, false);





  // ─── Image upload ───────────────────────────────────────────────────────────
  const handleImageUpload = async () => {
    if (imageUrls.length >= maxImages && !videoUrl) {
      alert(`Max ${maxImages} image(s) for Pattern ${selectedPattern}.`);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleVideoUpload = async () => {
    if (videoUrl) {
      alert('You can only upload one video.');
      return;
    }
    videoInputRef.current?.click();
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert('Video file exceeds maximum allowed size of 100MB.');
      e.target.value = '';
      return;
    }

    setIsUploadingVideo(true);
    setVideoUploadStatus('Uploading video…');
    try {
      const uploadRes = await generationService.uploadVideo(file, (_pct, msg) => {
        setVideoUploadStatus(msg);
      });
      if (uploadRes.success && uploadRes.data?.url) {
        setVideoUrl(uploadRes.data.url);
      } else {
        alert(`Upload Failed: ${uploadRes.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Upload Error\n\n${err.message || 'Unknown error'}`);
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadStatus('');
      e.target.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so the same file can be selected again
    e.target.value = '';
    if (!file) return;

    if (file.size === 0) {
      showImageWarning('The selected photo is empty. Please choose another photo.', 'Photo problem', false, null);
      return;
    }
    // Very large files (> 60 MB) are usually not photos at all
    if (file.size > 60 * 1024 * 1024) {
      showImageWarning('This file is too large to be a photo. Please choose a camera or gallery photo.', 'Photo too large', false, null);
      return;
    }
    // Any size / resolution is fine now: the crop sheet resizes it automatically.
    setCropFile(file);
  };

  // Kept for the warning modal's "compress" button (older flow)
  const handleProceedCompress = async () => {
    if (!pendingFileForCompression) return;
    setIsCompressingImage(true);
    try {
      const prepared = await prepareImage(pendingFileForCompression, { grayscale: isBlackAndWhite });
      setWarningModalOpen(false);
      setPendingFileForCompression(null);
      setCanCompressWarning(false);
      await uploadPreparedImage(prepared);
    } catch (err: any) {
      showImageWarning(err?.message || 'Could not prepare this photo.', 'Photo problem', false, null);
    } finally {
      setIsCompressingImage(false);
    }
  };

  /** Upload an already prepared (resized + cropped) JPEG and add it to the clipping. */
  const uploadPreparedImage = async (prepared: File) => {
    if (!prepared || prepared.size === 0) {
      showImageWarning('Empty photo. Please choose another photo.');
      return;
    }
    setIsUploadingImage(true);
    try {
      const uploadRes = await generationService.uploadImage(prepared);
      if (uploadRes && uploadRes.success && uploadRes.data?.url) {
        let finalUrl = uploadRes.data.url;
        if (finalUrl.includes('onrender.com')) {
          finalUrl = 'https://corsproxy.io/?' + encodeURIComponent(finalUrl);
        }
        setImageUrls(prev => [...prev, finalUrl].slice(0, maxImages));
      } else {
        showImageWarning(`Upload failed: ${(uploadRes as any)?.message || 'Please check your internet and try again.'}`, 'Upload failed');
      }
    } catch (err: any) {
      showImageWarning(`Upload failed: ${err?.message || 'Please check your internet and try again.'}`, 'Upload failed');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleGenerate = async () => {
    if (!headline || !content) return;
    const finalContent = limitWords(content, MAX_ARTICLE_WORDS);
    const finalHeadline = limitWords(headline, MAX_HEADLINE_WORDS).trim();
    if (activeLogos.length > 0) {
      const isSelectedActive = activeLogos.some(
        (l) => l.publication_code === selectedTemplateId || l.id === selectedTemplateId
      );
      if (!isSelectedActive) {
        alert('The selected publication logo has been disabled by the administrator. Please choose an active logo.');
        return;
      }
    }
    setLoading(true); setStageIndex(1);
    try {
      const reporterName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.full_name || user?.firstName || getReporterName(user?.email) || 'Reporter';
      const reporterImage = getReporterPhoto(user?.email) || user?.avatarUrl || (user as any)?.user_metadata?.avatar_url || (user as any)?.user_metadata?.picture || '';

      const resolvedImageUrls: string[] = [...imageUrls];

      const configToSave = {
        ...currentConfig, headline: finalHeadline, articleContent: finalContent, language, fontFamily,
        layoutColumns, imageUrls: resolvedImageUrls, imageUrl: resolvedImageUrls[0] || '', videoUrl: videoUrl || undefined,
        templateId: selectedTemplateId,
        publicationName: selectedTemplateDetails.name,
        logoId: logoMode ? selectedTemplateId : undefined,
        showWatermark: logoMode,
        showInnerBorders: showInnerBorders ?? true,
        publicationDate: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        reporterName,
        reporterImage,
      };
      setConfig(configToSave); setStageIndex(2);

      const payload: any = {
        ...configToSave,
        language,
        articleContent: finalContent,
        imageUrls: resolvedImageUrls,
        imageUrl: resolvedImageUrls[0] || '',
        videoUrl: videoUrl || undefined,
        generateHeadline: false,
        generate_headline: false,
        autoGenerateHeadline: false,
        showInnerBorders: showInnerBorders ?? true,
        columnMode: layoutColumns === 0 ? 'auto' : 'manual',
        layoutColumns,
        borderColor: currentConfig.borderColour || undefined,
        headingBg: currentConfig.headingBgColour || undefined,
        imageLayout: selectedPattern ? `pattern_${selectedPattern.toLowerCase()}` : undefined,
        reporterName,
        reporterImage,
        reporter_name: reporterName,
        reporter_image: reporterImage
      };
      setStageIndex(2);
      const renderTimer = setTimeout(() => setStageIndex(3), 8_000);
      const finalTimer = setTimeout(() => setStageIndex(4), 60_000);
      let res: any;
      try { res = await generationService.generate(payload as any); }
      finally { clearTimeout(renderTimer); clearTimeout(finalTimer); }

      const generation = res?.data?.id ? res.data : (res?.id ? res : null);
      if (generation) {
        generation.config = configToSave;
        addGeneration(generation);

        // Reset form for next generation
        resetConfig();
        setHeadline('');
        setContent('');
        setLanguage('te');
        setFontFamily('playfair');
        setLayoutColumns(3);
        setImageUrls([]);
        setVideoUrl(null);

        navigate(`/preview/${generation.id}`);
      }
      else throw new Error(`Unexpected server response: ${JSON.stringify(res)}`);
    } catch (err: any) {
      let errorTitle = 'Generation Failed';
      let errorMessage = err.response?.data?.message || err.message || JSON.stringify(err);
      if (err.response?.status === 403 || errorMessage.includes('403')) { errorTitle = 'Limit Reached'; errorMessage = 'Free clipping limit reached.'; }
      alert(`${errorTitle}\n\n${errorMessage}`);
    } finally { setLoading(false); setStageIndex(-1); }
  };

  return (
    <div style={{ background: '#EAF2FB', minHeight: '100%', paddingBottom: '8px' }}>




      {/* ── Page title ── */}
      <div style={{ background: 'transparent', paddingTop: '0px', paddingBottom: '3px', marginTop: '-7px' }}>
        <h1 style={{ color: '#163E6C', fontSize: '27.5px', fontWeight: 800, fontFamily: "'Georgia', serif", margin: 0, textAlign: 'center', letterSpacing: '0.3px' }}>
          Newspaper Clipping
        </h1>
      </div>

      <div style={{ padding: '0 12px', paddingBottom: '120px' }}>

        {/* ── SECTION 1: ACTIVE LOGO ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={sectionLabelStyle}>
                <Notebook style={{ width: 16, height: 16, color: '#0F487F' }} strokeWidth={2.4} />
                <strong style={{ fontWeight: 900, fontFamily: "system-ui, -apple-system, Arial, sans-serif", fontSize: '15px', letterSpacing: '0.5px', color: '#0F487F' }}>ACTIVE LOGO</strong>
              </div>
              <span style={{ color: '#0F172A', fontSize: '18.5px', fontWeight: 700 }}>{selectedTemplateDetails.name}</span>
              {activeLogos.length === 0 && !logosLoading && (
                <div style={{ color: '#D32F2F', fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                  No logos currently active
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setIsAdvancedModalOpen(true)}
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#1254A8', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(18,84,168,0.2)' }}
                title="Advanced Customization"
              >
                <SlidersHorizontal style={{ width: 16, height: 16 }} strokeWidth={2.2} />
              </button>
              <button
                onClick={() => {
                  refreshActiveLogos();
                  setIsLogoModalOpen(true);
                }}
                style={{ background: '#1254A8', color: '#ffffff', border: 'none', borderRadius: '18px', padding: '6px 18px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 2px 5px rgba(18,84,168,0.2)' }}
              >
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Style and Colours moved to Advanced Modal */}



        {/* ── SECTION 2: HEADLINE ── */}
        <div style={cardStyle}>
          <div style={sectionLabelStyle}>
            <FileText style={{ width: 16, height: 16, color: '#0F487F' }} strokeWidth={2.4} />
            <strong style={{ fontWeight: 900, fontFamily: "system-ui, -apple-system, Arial, sans-serif", fontSize: '15px', letterSpacing: '0.5px', color: '#0F487F' }}>HEADLINE</strong>
          </div>
          <input
            type="text"
            placeholder={`Enter headline (max ${MAX_HEADLINE_WORDS} words)`}
            value={headline}
            onChange={e => handleHeadlineChange(e.target.value)}
            style={{ ...inputStyle, fontSize: '19.5px', fontWeight: 700 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '15px', fontWeight: 700 }}>
            <span style={{ color: headlineLimitNotice ? '#B45309' : '#64748B' }}>
              {headlineLimitNotice
                ? `Headline: only ${MAX_HEADLINE_WORDS} words / శీర్షిక ${MAX_HEADLINE_WORDS} పదాలు మాత్రమే`
                : `Short headline: up to ${MAX_HEADLINE_WORDS} words`}
            </span>
            <span style={{ color: headlineWords >= MAX_HEADLINE_WORDS ? '#B45309' : '#0F487F' }}>
              {headlineWords}/{MAX_HEADLINE_WORDS}
            </span>
          </div>
        </div>

        {/* ── SECTION 3: ARTICLE CONTENT ── */}
        <div style={cardStyle}>
          <div style={sectionLabelStyle}>
            <Pencil style={{ width: 16, height: 16, color: '#0F487F' }} strokeWidth={2.4} />
            <strong style={{ fontWeight: 900, fontFamily: "system-ui, -apple-system, Arial, sans-serif", fontSize: '15px', letterSpacing: '0.5px', color: '#0F487F' }}>ARTICLE CONTENT</strong>
          </div>
          <textarea
            placeholder={`Enter article content (max ${MAX_ARTICLE_WORDS} words)...`}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.45, minHeight: '108px', height: '108px', borderColor: wordCount >= MAX_ARTICLE_WORDS ? '#F59E0B' : inputStyle.border as string }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '14px', fontWeight: 700 }}>
            <span style={{ color: wordLimitNotice ? '#B45309' : '#64748B' }}>
              {wordLimitNotice
                ? `Only the first ${MAX_ARTICLE_WORDS} words are kept / ${MAX_ARTICLE_WORDS} పదాలు మాత్రమే ఉంచబడ్డాయి`
                : `Keep it short: up to ${MAX_ARTICLE_WORDS} words`}
            </span>
            <span style={{ color: wordCount >= MAX_ARTICLE_WORDS ? '#B45309' : wordCount >= MAX_ARTICLE_WORDS - 5 ? '#CA8A04' : '#0F487F' }}>
              {wordCount}/{MAX_ARTICLE_WORDS}
            </span>
          </div>
        </div>

        {/* ── SECTION 4: FEATURED MEDIA ── */}
        <div style={{ ...cardStyle, marginBottom: '8px' }}>
          <div style={sectionLabelStyle}>
            <ImageIcon style={{ width: 16, height: 16, color: '#0F487F' }} strokeWidth={2.4} />
            <strong style={{ fontWeight: 900, fontFamily: "system-ui, -apple-system, Arial, sans-serif", fontSize: '15px', letterSpacing: '0.5px', color: '#0F487F' }}>FEATURED MEDIA</strong>
          </div>

          {(imageUrls.length > 0 || videoUrl) && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {videoUrl && (
                <div style={{ position: 'relative', flexShrink: 0, width: '78px', height: '78px', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.1)', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video style={{ width: 24, height: 24, color: '#fff' }} />
                  <button
                    onClick={() => setVideoUrl(null)}
                    style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', background: '#CC1E1E', border: 'none', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X style={{ width: '10px', height: '10px' }} strokeWidth={3} />
                  </button>
                </div>
              )}
              {imageUrls.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', flexShrink: 0, width: '78px', height: '78px', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                  <img src={url} alt={`img ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => setImageUrls(prev => prev.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', background: '#CC1E1E', border: 'none', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X style={{ width: '10px', height: '10px' }} strokeWidth={3} />
                  </button>
                  {/* Radio indicator */}
                  <div style={{ position: 'absolute', bottom: '3px', left: '3px', width: '14px', height: '14px', background: '#CC1E1E', border: '2px solid #fff', borderRadius: '50%' }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', alignSelf: 'flex-start', padding: '0 4px' }}>
              <input
                type="checkbox"
                checked={isBlackAndWhite}
                onChange={(e) => setIsBlackAndWhite(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#1254A8', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '15.5px', color: '#0F172A', fontWeight: 600 }}>Convert images to Black & White</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {imageUrls.length < maxImages && (
                <button
                  onClick={handleImageUpload}
                  disabled={loading || isUploadingImage}
                  style={{
                    flex: 1, border: '1.5px dashed #CBD9E8', borderRadius: '10px',
                    background: '#ffffff', padding: '12px 8px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                  }}
                >
                  {isUploadingImage
                    ? <Loader2 style={{ width: 20, height: 20, color: '#0F487F', animation: 'spin 1s linear infinite' }} strokeWidth={2.2} />
                    : <UploadCloud style={{ width: 20, height: 20, color: '#0F487F', opacity: 0.8 }} strokeWidth={2.2} />}
                  <span style={{ color: '#475569', fontSize: '14px', fontWeight: 600 }}>{isUploadingImage ? 'Uploading photo…' : 'Upload image'}</span>
                </button>
              )}
              {!videoUrl && (
                <button
                  onClick={handleVideoUpload}
                  disabled={loading || isUploadingVideo || isUploadingImage}
                  style={{
                    flex: 1, border: '1.5px dashed #CBD9E8', borderRadius: '10px',
                    background: '#ffffff', padding: '12px 8px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                  }}
                >
                  {isUploadingVideo
                    ? <Loader2 style={{ width: 20, height: 20, color: '#0F487F', animation: 'spin 1s linear infinite' }} strokeWidth={2.2} />
                    : <Video style={{ width: 20, height: 20, color: '#0F487F', opacity: 0.8 }} strokeWidth={2.2} />}
                  <span style={{ color: '#475569', fontSize: '14px', fontWeight: 600 }}>
                    {isUploadingVideo ? (videoUploadStatus || 'Uploading video…') : 'Upload video'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Font and Columns moved to Advanced Modal */}

        {/* ── Generate button (Normal Flow) ── */}
        <div style={{ marginTop: '6px', marginBottom: '6px' }}>
          {loading && currentStage && (
            <div style={{ background: '#0D1B2A', borderRadius: '12px 12px 0 0', padding: '8px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{currentStage.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'monospace' }}>{currentStage.pct}%</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#CC1E1E', borderRadius: '2px', width: `${currentStage.pct}%`, transition: 'width 0.7s ease-out' }} />
              </div>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading || isUploadingImage || !headline || !content}
            style={{
              width: '100%', padding: '12px 0', background: '#D65B5B',
              color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '21px', borderRadius: (loading && currentStage) ? '0 0 12px 12px' : '12px',
              fontFamily: "'Georgia', serif", cursor: (loading || isUploadingImage || !headline || !content) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: (loading || isUploadingImage || !headline || !content) ? 0.75 : 1,
              boxShadow: '0 2px 6px rgba(214, 91, 91, 0.25)',
            }}
          >
            {loading ? (
              <><Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /><span>{currentStage?.label || 'Processing…'}</span></>
            ) : (
              <span>Publish</span>
            )}
          </button>
        </div>

      </div>

      {/* ── Modals ── */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={videoInputRef}
        style={{ display: 'none' }}
        accept="video/*"
        onChange={handleVideoChange}
      />

      {/* Warning Popup Modal */}
      <ImageWarningModal
        isOpen={warningModalOpen}
        onClose={() => {
          if (!isCompressingImage) {
            setWarningModalOpen(false);
            setPendingFileForCompression(null);
            setCanCompressWarning(false);
          }
        }}
        title={warningTitle}
        errorMessage={warningMessage}
        canCompress={canCompressWarning}
        onProceedCompress={handleProceedCompress}
        isCompressing={isCompressingImage}
      />

      <PatternSelectionModal
        isOpen={isPatternModalOpen}
        onClose={() => setIsPatternModalOpen(false)}
        selectedPattern={selectedPattern}
        onSelectPattern={(patternId) => setConfig({ layoutPattern: patternId as any })}
      />

      {isLogoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div
            style={{ width: '100%', maxHeight: '80vh', background: '#0D1B2A', borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, fontFamily: "'Georgia', serif", margin: 0 }}>{t.selectLogo}</h2>
              <button onClick={() => setIsLogoModalOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '12px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', gap: '8px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
              {activeLogos.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '17px' }}>
                  {logosLoading ? 'Loading available logos…' : 'No publication logos are currently active. Please contact your administrator.'}
                </div>
              ) : (
                activeLogos.map((logo) => {
                  const isSelected = selectedTemplateId === logo.publication_code || selectedTemplateId === logo.id;
                  return (
                    <button
                      key={logo.id || logo.publication_code}
                      onClick={() => {
                        setConfig({ templateId: logo.publication_code as any });
                        setIsLogoModalOpen(false);
                      }}
                      style={{
                        background: isSelected ? 'rgba(204,30,30,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1.5px solid ${isSelected ? '#CC1E1E' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: '4px' }}>
                        {logo.logo_url ? (
                          <img src={logo.logo_url} alt={logo.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <Newspaper style={{ width: '22px', height: '22px', color: 'rgba(255,255,255,0.6)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontSize: '17px', fontWeight: 700 }}>{logo.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>{logo.publication_code}</div>
                      </div>
                      {isSelected && <CheckCircle2 style={{ width: '18px', height: '18px', color: '#CC1E1E', flexShrink: 0 }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {isAdvancedModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div
            style={{ width: '100%', maxHeight: '85vh', background: '#EEF3F8', borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0, background: '#fff' }}>
              <button
                onClick={() => setIsAdvancedModalOpen(false)}
                style={{ background: '#E8F2FC', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#145AB1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Back"
              >
                <ArrowLeft style={{ width: '18px', height: '18px' }} />
              </button>
              <h2 style={{ color: '#0F172A', fontSize: '22px', fontWeight: 800, fontFamily: "'Georgia', serif", margin: 0 }}>Style &amp; Colours</h2>
              <button onClick={() => setIsAdvancedModalOpen(false)} style={{ background: '#E8F2FC', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#145AB1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', WebkitOverflowScrolling: 'touch', paddingBottom: '40px' }}>
              
              {/* ── SECTION: STYLE & COLOURS ── */}
              <div style={cardStyle}>
                <div style={labelStyle}>🎨 STYLE &amp; COLOURS</div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    onClick={() => setIsAdvancedModalOpen(false)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid #145AB1',
                      background: '#145AB1',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '17px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Go back to generation screen"
                  >
                    <ArrowLeft style={{ width: '18px', height: '18px', color: '#ffffff' }} />
                  </button>
                  {[
                    { key: 'border', label: '▦  Border' },
                    { key: 'heading', label: 'abc  Heading BG' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveColourTab(tab.key as any)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: '8px',
                        border: activeColourTab === tab.key ? '1px solid rgba(20, 90, 177, 0.2)' : '1px solid #E2E8F0',
                        background: activeColourTab === tab.key ? '#145AB1' : '#F8FAFC',
                        color: activeColourTab === tab.key ? '#fff' : '#64748B',
                        fontWeight: activeColourTab === tab.key ? 700 : 500,
                        fontSize: '15px', cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Live Preview header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#64748B', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>LIVE PREVIEW</span>
                  <button
                    onClick={() => { setIsAdvancedModalOpen(false); navigate('/templates'); }}
                    style={{ background: 'none', border: '1px solid #145AB1', borderRadius: '6px', color: '#145AB1', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    CHANGE PATTERN
                  </button>
                </div>

                {/* Pattern Preview */}
                <div style={{ marginBottom: '10px' }}>
                  <LiveNewspaperPreview
                    patternId={selectedPattern}
                    borderColour={selectedBorderColour}
                    headingBgColour={selectedHeadingBgColour}
                    headlineText={headline}
                    onPress={() => { setIsAdvancedModalOpen(false); navigate('/templates'); }}
                  />
                </div>

                {/* Selected colour display */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: activeColourDetails.hex, flexShrink: 0, border: '1.5px solid #E2E8F0' }} />
                  <div>
                    <div style={{ color: '#0F172A', fontSize: '16px', fontWeight: 700 }}>{activeColourDetails.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#64748B', fontSize: '13px', fontFamily: 'monospace' }}>{activeColourDetails.hex}</span>
                      <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '12px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {activeColourTab === 'border' ? 'Border' : 'Heading BG'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Colour Swatches */}
                {(['classic', 'lightAndSoft'] as const).map(group => {
                  const palettes = activeColourTab === 'border' ? BORDER_COLOURS : HEADING_BG_COLOURS;
                  const colours = palettes[group];
                  const activeHex = activeColourTab === 'border' ? selectedBorderColour : selectedHeadingBgColour;
                  return (
                    <div key={group} style={{ marginBottom: '14px' }}>
                      <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                        {group === 'classic' ? 'CLASSIC COLOURS' : 'LIGHT & SOFT COLOURS'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                        {colours.map(c => {
                          const isSelected = activeHex.toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.hex}
                              onClick={() => activeColourTab === 'border' ? setConfig({ borderColour: c.hex }) : setConfig({ headingBgColour: c.hex })}
                              style={{
                                width: '100%', aspectRatio: '1', borderRadius: '8px', border: 'none',
                                background: c.hex, cursor: 'pointer', position: 'relative',
                                outline: isSelected ? '2.5px solid #015BB3' : '1px solid #E2E8F0',
                                outlineOffset: isSelected ? '2px' : '0px',
                                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                                transition: 'all 0.15s',
                              }}
                            >
                              {isSelected && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                                  <CheckCircle2 style={{ width: '14px', height: '14px', color: '#fff' }} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── SECTION: FONT + COLUMNS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {/* Font */}
                <div style={{ ...cardStyle, marginBottom: 0 }}>
                  <div style={labelStyle}>FONT</div>
                  <button
                    onClick={() => {
                      const fonts = ['playfair', 'merriweather', 'inter', 'courier'];
                      const next = fonts[(fonts.indexOf(fontFamily) + 1) % fonts.length];
                      setFontFamily(next);
                    }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                      color: '#0F172A', fontSize: '16px', fontWeight: 600,
                      textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    {fontFamily.charAt(0).toUpperCase() + fontFamily.slice(1)}
                  </button>
                </div>

                {/* Columns */}
                <div style={{ ...cardStyle, marginBottom: 0 }}>
                  <div style={labelStyle}>COLUMNS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {[{ label: 'Auto', val: 0 }, { label: '1 Column', val: 1 }, { label: '2 Columns', val: 2 }, { label: '3 Columns', val: 3 }]
                      .filter(({ val }) => showColPicker || layoutColumns === val)
                      .map(({ label, val }) => {
                        const isActive = layoutColumns === val;
                        return (
                          <button
                            key={label}
                            onClick={() => {
                              if (!showColPicker) {
                                setShowColPicker(true);
                              } else {
                                setLayoutColumns(val);
                                setShowColPicker(false);
                              }
                            }}
                            style={{
                              padding: '9px 12px', borderRadius: '8px',
                              background: isActive ? '#145AB1' : '#F8FAFC',
                              border: '1px solid ' + (isActive ? '#145AB1' : '#E2E8F0'),
                              color: isActive ? '#fff' : '#475569',
                              fontSize: '15px', fontWeight: isActive ? 700 : 400,
                              textAlign: 'left', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <span>{label}</span>
                            {!showColPicker && (
                              <span style={{ opacity: 0.5, fontSize: '13px' }}>▼</span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          grayscale={isBlackAndWhite}
          onDone={(prepared) => {
            setCropFile(null);
            uploadPreparedImage(prepared);
          }}
          onCancel={() => setCropFile(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
