# Frontend Updates & Migration Guide

This document records **all customizations, bug fixes, and feature updates** applied to the `frountend/` application. When integrating or upgrading to a new frontend codebase, follow this guide to apply these essential modifications.

---

## Table of Contents
1. [Overview & Quick Checklist](#1-overview--quick-checklist)
2. [Logo & Watermark Fixes](#2-logo--watermark-fixes)
   - [2.1 Remove Top-Right Corner Logo Overlay](#21-remove-top-right-corner-logo-overlay)
   - [2.2 Restore Authentic RTI Express Logo Badge in Author Strip](#22-restore-authentic-rti-express-logo-badge-in-author-strip)
3. [Clipping Share & Download Proportions](#3-clipping-share--download-proportions)
   - [3.1 Disable Canvas Footer Band Stamping](#31-disable-canvas-footer-band-stamping)
   - [3.2 Share Untouched Clipping Image](#32-share-untouched-clipping-image)
   - [3.3 Download Pure JPG Without Extra Card](#33-download-pure-jpg-without-extra-card)
4. [Video Clipping Support](#4-video-clipping-support)
   - [4.1 Video Player in Detail & Feed](#41-video-player-in-detail--feed)
   - [4.2 Video Direct-to-App Sharing](#42-video-direct-to-app-sharing)
5. [Deep Links & Routing](#5-deep-links--routing)
6. [Android APK Build Commands](#6-android-apk-build-commands)

---

## 1. Overview & Quick Checklist

When migrating to a new frontend:
- [ ] Remove the circular top-right logo overlay from the news media card.
- [ ] Replace any crude placeholder vector SVG in the author strip with the crisp official asset: `rti_express_watermark.png`.
- [ ] Ensure `stampClipping.ts` does NOT append an extra canvas footer card (which ruins clipping height, aspect ratio, and adds unwanted duplicate QR codes).
- [ ] Verify `PreviewScreen.tsx` downloads `generation.png_url` directly.
- [ ] Check that `tsc -b` compiles cleanly without unused variable errors (`noUnusedLocals`).

---

## 2. Logo & Watermark Fixes

### 2.1 Remove Top-Right Corner Logo Overlay
- **File**: `src/components/NewsDetailCardStack.tsx`
- **Issue**: A circular `w-11 h-11` watermark logo was placed at `absolute top-2.5 right-2.5 z-10`, blocking faces and content in the top-right corner of news photos.
- **Action**: Completely remove the top-right overlay block.

#### Diff / Code Change:
```tsx
// REMOVE THIS BLOCK from the media container:
<div className="absolute top-2.5 right-2.5 z-10 w-11 h-11 rounded-full bg-white shadow-md border-2 border-white/80 p-0.5 flex items-center justify-center overflow-hidden">
  <img
    src={mastheadLogo}
    alt="RTI Spot News"
    className="w-full h-full object-contain"
  />
</div>
```

---

### 2.2 Restore Authentic RTI Express Logo Badge in Author Strip
- **File**: `src/components/NewsDetailCardStack.tsx`
- **Issue**: The bottom-right channel badge on the author strip was using either a plain blue text block or a crude placeholder SVG (generic circle and sticks) instead of the authentic logo.
- **Action**: Import `rti_express_watermark.png` and render it as an image badge.

#### Diff / Code Change:
```tsx
// 1. Update Import:
// Before:
import mastheadLogo from '@/assets/rti_express_logo.png';
// After:
import rtiExpressWatermark from '@/assets/rti_express_watermark.png';

// 2. In the Author Info Overlay Strip (bottom-right of photo):
// Replace placeholder SVG or plain text with:
<div className="flex items-center justify-center shadow-sm">
  <img
    src={rtiExpressWatermark}
    alt="RTI Express"
    className="h-6 w-auto max-w-[85px] object-contain rounded"
  />
</div>
```

---

## 3. Clipping Share & Download Proportions

### 3.1 Disable Canvas Footer Band Stamping
- **File**: `src/features/share/stampClipping.ts`
- **Issue**: `stampClipping` created an HTML5 Canvas and appended a `band = W * 0.19` blue footer card containing an app link pill and duplicate QR code. This stretched the image height, distorted the 540px newspaper clipping proportions, and degraded quality.
- **Action**: Modify `stampClipping` to return `clippingSrc` immediately without creating the extra canvas card.

#### Full File Content (`stampClipping.ts`):
```ts
// Preserves the original clipping as-is without appending any extra bottom card or footer band.
export async function stampClipping(clippingSrc: string, _link?: string, _logoSrc?: string): Promise<string> {
  return clippingSrc;
}
```

---

### 3.2 Share Untouched Clipping Image
- **File**: `src/features/share/ShareAfterClipping.tsx`
- **Issue**: The sharing bottom-sheet was calling `stampClipping(post.clippingUrl, link)`, which added the distorted footer card to shared WhatsApp/Facebook images.
- **Action**: Assign `post.clippingUrl` directly.

#### Diff / Code Change:
```tsx
// Before:
let clipping = "";
if (post.clippingUrl) {
  try {
    clipping = await stampClipping(post.clippingUrl, link);
  } catch {
    clipping = post.clippingUrl;
  }
}

// After:
const clipping = post.clippingUrl || "";
```
*(Also remove `import { stampClipping } from "./stampClipping";` so TypeScript `noUnusedLocals` does not fail the build).*

---

### 3.3 Download Pure JPG Without Extra Card
- **File**: `src/screens/PreviewScreen.tsx`
- **Issue**: Clicking "SAVE JPG" was stamping the extra footer card into the saved image.
- **Action**: Directly fetch and save `generation.png_url`.

#### Diff / Code Change:
```tsx
// In handleDownload('jpg'):
// Before:
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
}

// After:
} else if (format === 'jpg') {
  if (!generation.png_url) throw new Error("JPG URL not available");
  const res = await fetch(generation.png_url);
  blob = await res.blob();
}
```
*(Also remove unused imports `stampClipping` and `newsLink` from `PreviewScreen.tsx`).*

---

## 4. Video Clipping Support

### 4.1 Video Player in Detail & Feed
- **File**: `src/components/NewsDetailCardStack.tsx`
- Supports video clippings when `item.mp4_url` or `item.config.videoUrl` is present:
```tsx
{videoUrl ? (
  <video
    src={videoUrl}
    controls
    autoPlay={isActive}
    loop
    playsInline
    className="w-full h-full object-contain relative z-10"
  />
) : (
  <img src={rawClippingUrl} ... />
)}
```

### 4.2 Video Direct-to-App Sharing
- **File**: `src/features/share/shareImage.ts`
- Added `shareVideo()` function to save video to native cache via `@capacitor/filesystem` and share directly to WhatsApp (`com.whatsapp`) via `TargetShare` or system share sheet.

---

## 5. Deep Links & Routing

- **Files**:
  - `src/lib/deepLinks.ts`
  - `android/app/src/main/AndroidManifest.xml`
- **Configuration**:
  - Handles `https://rtiexpress.in/n/:id` (news article deep link) and `https://rtiexpress.in/r/:slug` (reporter profile).
  - Intent filter in `AndroidManifest.xml`:
    ```xml
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" android:host="rtiexpress.in" android:pathPrefix="/n/" />
        <data android:scheme="https" android:host="rtiexpress.in" android:pathPrefix="/r/" />
    </intent-filter>
    ```

---

## 6. Android APK Build Commands

Run these commands inside the frontend directory whenever building a new APK:

```bash
# 1. Typecheck & build production bundle
npm run build

# 2. Sync web assets & plugins to Capacitor native project
npx cap sync android

# 3. Compile Android Debug & Release APKs
cd android
gradlew.bat clean assembleDebug assembleRelease
cd ..

# 4. Built APKs will be located at:
# Debug:   android/app/build/outputs/apk/debug/app-debug.apk
# Release: android/app/build/outputs/apk/release/app-release.apk
```
