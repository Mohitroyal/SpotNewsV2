import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';

/**
 * Capture an HTML element to high-res PNG canvas
 */
export async function captureCardElement(el: HTMLElement, scale = 3.5): Promise<HTMLCanvasElement> {
  return await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.opacity = '1';
      clonedEl.style.visibility = 'visible';
      clonedEl.style.display = 'block';
      clonedEl.style.position = 'relative';
      clonedEl.style.left = '0';
      clonedEl.style.top = '0';
      clonedEl.style.transform = 'none';
      if (clonedEl.parentElement) {
        clonedEl.parentElement.style.opacity = '1';
        clonedEl.parentElement.style.transform = 'none';
      }
    },
  });
}

/**
 * Export and Save/Share 2-Page ID Card PDF
 */
export async function exportIdCardPdf(
  cardNo: string,
  frontEl: HTMLElement,
  backEl?: HTMLElement | null,
  openShare = false
): Promise<{ success: boolean; message: string }> {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [53.98, 85.6],
    });

    // 1. Render Front Side
    const frontCanvas = await captureCardElement(frontEl, 3.5);
    const frontImg = frontCanvas.toDataURL('image/jpeg', 0.96);
    pdf.addImage(frontImg, 'JPEG', 0, 0, 53.98, 85.6);

    // 2. Render Back Side (if provided)
    if (backEl) {
      const backCanvas = await captureCardElement(backEl, 3.5);
      const backImg = backCanvas.toDataURL('image/jpeg', 0.96);
      pdf.addPage([53.98, 85.6], 'portrait');
      pdf.addImage(backImg, 'JPEG', 0, 0, 53.98, 85.6);
    }

    const cleanCardNo = cardNo.replace(/[^A-Za-z0-9_-]/g, '_');
    const fileName = `RTI_EXPRESS_ID_${cleanCardNo}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64Uri = pdf.output('datauristring');
      const base64Data = pdfBase64Uri.split(',')[1] || pdfBase64Uri;

      try {
        if (Capacitor.getPlatform() === 'android') {
          await Filesystem.requestPermissions().catch(() => {});
        }

        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        // Save to Documents for permanent offline storage
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
        } catch (docErr) {
          console.warn('Documents save notice:', docErr);
        }

        if (openShare) {
          await Share.share({
            title: `RTI Express ID Card - ${cardNo}`,
            text: `Official Press Identity Card for ${cardNo}`,
            url: cacheResult.uri,
            files: [cacheResult.uri],
            dialogTitle: 'Share ID Card (PDF)',
          });
          return { success: true, message: 'Share sheet opened!' };
        }

        return { success: true, message: 'ID Card PDF saved successfully to your Documents!' };
      } catch (nativeErr: any) {
        console.error('Native Filesystem save error:', nativeErr);
        return { success: false, message: `Could not save file: ${nativeErr.message || nativeErr}` };
      }
    } else {
      // Browser fallback
      pdf.save(fileName);
      return { success: true, message: 'ID Card PDF downloaded to your device!' };
    }
  } catch (err: any) {
    console.error('PDF Export Error:', err);
    return { success: false, message: err.message || 'Failed to generate PDF' };
  }
}

/**
 * Export and Save/Share PNG Image of Front or Back Side
 */
export async function exportIdCardPng(
  cardNo: string,
  el: HTMLElement,
  sideName: 'FRONT' | 'BACK',
  openShare = false
): Promise<{ success: boolean; message: string }> {
  try {
    const canvas = await captureCardElement(el, 4); // 300+ DPI
    const dataUrl = canvas.toDataURL('image/png');
    const cleanCardNo = cardNo.replace(/[^A-Za-z0-9_-]/g, '_');
    const fileName = `RTI_EXPRESS_${cleanCardNo}_${sideName}.png`;

    if (Capacitor.isNativePlatform()) {
      const base64Data = dataUrl.split(',')[1] || dataUrl;

      try {
        if (Capacitor.getPlatform() === 'android') {
          await Filesystem.requestPermissions().catch(() => {});
        }

        // Save into device gallery (Photos / Gallery album)
        try {
          await Media.savePhoto({ path: dataUrl });
        } catch (mediaErr) {
          console.warn('Media savePhoto notice:', mediaErr);
        }

        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        // Also save to Documents
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
        } catch (docErr) {
          console.warn('Documents save notice:', docErr);
        }

        if (openShare) {
          await Share.share({
            title: `RTI Express ID Card (${sideName})`,
            text: `RTI EXPRESS Spot News 24x7 Press ID Card (${sideName})`,
            url: cacheResult.uri,
            files: [cacheResult.uri],
            dialogTitle: `Share ${sideName} Image`,
          });
          return { success: true, message: 'Share sheet opened!' };
        }

        return { success: true, message: `${sideName} card saved directly to your Photos / Gallery!` };
      } catch (nativeErr: any) {
        console.error('Native PNG save error:', nativeErr);
        return { success: false, message: `Could not save image: ${nativeErr.message || nativeErr}` };
      }
    } else {
      // Browser download
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, message: `${sideName} PNG downloaded successfully!` };
    }
  } catch (err: any) {
    console.error('PNG Export Error:', err);
    return { success: false, message: err.message || 'Failed to download image' };
  }
}

/**
 * Print ID Card
 */
export async function printIdCard(
  cardNo: string,
  frontEl: HTMLElement,
  backEl?: HTMLElement | null
): Promise<{ success: boolean; message: string }> {
  if (Capacitor.isNativePlatform()) {
    return await exportIdCardPdf(cardNo, frontEl, backEl);
  } else {
    window.print();
    return { success: true, message: 'Opening print dialog...' };
  }
}

/**
 * Share ID Card with Front Card Image
 */
export async function shareIdCard(
  cardNo: string,
  shareText: string,
  frontEl?: HTMLElement | null
): Promise<{ success: boolean; message: string }> {
  try {
    if (Capacitor.isNativePlatform() && frontEl) {
      const canvas = await captureCardElement(frontEl, 3.5);
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1] || dataUrl;
      const cleanCardNo = cardNo.replace(/[^A-Za-z0-9_-]/g, '_');
      const fileName = `RTI_EXPRESS_${cleanCardNo}_SHARE.png`;

      const cacheResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: 'RTI EXPRESS Spot News 24x7 Press ID Card',
        text: shareText,
        url: cacheResult.uri,
        files: [cacheResult.uri],
        dialogTitle: 'Share Reporter ID Card',
      });
      return { success: true, message: 'Share sheet opened!' };
    } else if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: 'RTI EXPRESS Spot News 24x7 Press ID Card',
        text: shareText,
        dialogTitle: 'Share Reporter ID Card',
      });
      return { success: true, message: 'Share sheet opened!' };
    } else if (navigator.share) {
      await navigator.share({
        title: 'RTI EXPRESS Spot News 24x7 Press ID Card',
        text: shareText,
      });
      return { success: true, message: 'Card shared successfully!' };
    } else {
      await navigator.clipboard.writeText(shareText);
      return { success: true, message: 'Card details copied to clipboard!' };
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('canceled') || err.message?.includes('dismissed')) {
      return { success: true, message: '' };
    }
    console.error('Share error:', err);
    return { success: false, message: err.message || 'Failed to share card' };
  }
}
