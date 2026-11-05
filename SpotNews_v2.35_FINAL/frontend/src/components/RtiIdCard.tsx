import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import rtiExpressLogo from '../assets/rti_express_logo.png';

export interface RtiCardData {
  cardNo: string;
  name: string;
  designation?: string;
  center?: string;
  validUpto?: string;
  photoUrl?: string;
  address?: string;
  pin?: string;
  phone?: string;
  relation?: string;
  guardian?: string;
  mediaType?: string;
  actLine?: string;
  orgName?: string;
  orgAddress?: string;
  orgGstin?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgCin?: string;
  orgMsme?: string;
  orgFirms?: string;
  orgLabour?: string;
  orgPostal?: string;
  logoUrl?: string;
}

interface RtiIdCardProps {
  data: RtiCardData;
  frontRef?: React.RefObject<HTMLDivElement | null>;
  backRef?: React.RefObject<HTMLDivElement | null>;
  side?: 'front' | 'back' | 'both';
  scale?: number;
  onPhotoClick?: () => void;
  onCardFlip?: () => void;
}

// Generate pixel-perfect Verification Seal as PNG data URL (100% html2canvas reliable)
function generateSealDataUrl(cardNo: string): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const cx = 200;
    const cy = 200;
    const color = '#251a82';

    ctx.clearRect(0, 0, 400, 400);

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, 185, 0, Math.PI * 2);
    ctx.lineWidth = 11;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Curved text helper
    const drawCurvedText = (text: string, radius: number, startAngle: number, endAngle: number, inward = true) => {
      const chars = text.split('');
      const totalAngle = endAngle - startAngle;
      const angleStep = totalAngle / (chars.length - 1 || 1);
      ctx.font = '900 27px Arial, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < chars.length; i++) {
        const angle = startAngle + i * angleStep;
        ctx.save();
        ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        ctx.rotate(angle + (inward ? Math.PI / 2 : -Math.PI / 2));
        ctx.fillText(chars[i], 0, 0);
        ctx.restore();
      }
    };

    // Top curve: ★ RTI EXPRESS ★
    drawCurvedText('★ RTI EXPRESS ★', 151, -2.45, -0.69, true);

    // Bottom curve: SPOT NEWS 24×7
    drawCurvedText('SPOT NEWS 24×7', 151, 2.45, 0.69, false);

    // Center text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // VERIFIED
    ctx.font = '900 34px Arial, sans-serif';
    ctx.fillText('VERIFIED', cx, cy - 28);

    // REPORTER
    ctx.font = '800 29px Arial, sans-serif';
    ctx.fillText('REPORTER', cx, cy + 9);

    // Card number
    const cleanNo = cardNo.length > 18 ? cardNo.slice(-16) : cardNo;
    ctx.font = '700 23px Arial, sans-serif';
    ctx.fillText(cleanNo, cx, cy + 44);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Seal generation error:', e);
    return '';
  }
}

// Generate pixel-perfect PRESS bottom banner as high-res PNG data URL (100% html2canvas reliable)
function generatePressBannerDataUrl(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Accent top blue stripe (0.7mm)
    ctx.fillStyle = '#06317a';
    ctx.fillRect(0, 0, 1080, 14);

    // 2. Red banner background (8.3mm)
    ctx.fillStyle = '#d71920';
    ctx.fillRect(0, 14, 1080, 166);

    // 3. Centered PRESS letters
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 96px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const letters = ['P', 'R', 'E', 'S', 'S'];
    const xPositions = [308, 424, 540, 656, 772];
    const yCenter = 97;

    for (let i = 0; i < letters.length; i++) {
      ctx.fillText(letters[i], xPositions[i], yCenter);
    }

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Press banner generation error:', e);
    return '';
  }
}

export const RtiIdCard: React.FC<RtiIdCardProps> = ({
  data,
  frontRef,
  backRef,
  side = 'both',
  scale = 1,
  onPhotoClick,
  onCardFlip,
}) => {
  const cardNo = (data.cardNo || 'RTI 1147').toUpperCase().trim();
  const name = (data.name || 'POKKALA MOHITH ROYAL').toUpperCase().trim();
  const designation = (data.designation || 'PRESS REPORTER').toUpperCase().trim();
  const center = (data.center || 'HYDERABAD').toUpperCase().trim();
  const validUpto = (data.validUpto || `31-12-${new Date().getFullYear() + 1}`).trim();
  const mediaType = (data.mediaType || 'PRINT MEDIA').toUpperCase().trim();
  const actLine = (data.actLine || 'RTI ACT-2005').trim();
  const photoUrl = data.photoUrl || '';
  const logoUrl = data.logoUrl || rtiExpressLogo;

  const address = (data.address || '# 7-2-28, VD Road, Hindupur, Sri Sathya Sai Dist, Andhra Pradesh').toUpperCase().trim();
  const pin = (data.pin || '515201').trim();
  const phone = (data.phone || '7668886666').trim();
  const relation = (data.relation || 'S/O').toUpperCase().trim();
  const guardian = (data.guardian || '').toUpperCase().trim();

  const orgName = data.orgName || 'FOUZIYA PUBLICATIONS';
  const orgAddress = data.orgAddress || '# 7-2-28, VD Road, HINDUPUR-515201, Sri Sathya Sai Dist. A.P.';
  const orgGstin = data.orgGstin || '37ABJPF4955F1ZK';
  const orgPhone = data.orgPhone || '7668886666';
  const orgEmail = data.orgEmail || 'contactspotnews@gmail.com';
  const orgCin = data.orgCin || 'U64200AP2021PTC118146';
  const orgMsme = data.orgMsme || 'UDYAM-AP-250038710';
  const orgFirms = data.orgFirms || '43 of 2018';
  const orgLabour = data.orgLabour || 'AP-25-18-006-03671823';
  const orgPostal = data.orgPostal || 'HDP/010/2024-2026';

  // Seal PNG data URL
  const [sealPng, setSealPng] = useState<string>(() => generateSealDataUrl(cardNo));
  useEffect(() => {
    const png = generateSealDataUrl(cardNo);
    if (png) setSealPng(png);
  }, [cardNo]);

  // PRESS Banner PNG data URL
  const [pressBannerPng, setPressBannerPng] = useState<string>(() => generatePressBannerDataUrl());
  useEffect(() => {
    const png = generatePressBannerDataUrl();
    if (png) setPressBannerPng(png);
  }, []);

  // QR Code PNG data URL
  const [qrPng, setQrPng] = useState<string>('');
  useEffect(() => {
    const payload = `RTI EXPRESS Spot News 24x7\nID: ${cardNo}\n${name}\n${designation}\nValid upto: ${validUpto}\nVerify: ${orgPhone}`;
    QRCode.toDataURL(payload, {
      margin: 1,
      color: {
        dark: '#06317a',
        light: '#ffffff',
      },
      width: 250,
    })
      .then((url) => setQrPng(url))
      .catch((err) => console.warn('QR code generation error:', err));
  }, [cardNo, name, designation, validUpto, orgPhone]);

  // Dynamic font scaling to guarantee long names fit cleanly without clipping
  const nameLen = name.length;
  const nameFontSize =
    nameLen >= 26
      ? '1.95mm'
      : nameLen >= 22
      ? '2.1mm'
      : nameLen >= 18
      ? '2.25mm'
      : nameLen >= 14
      ? '2.45mm'
      : '2.75mm';

  const desigFontSize =
    designation.length > 22
      ? '2.15mm'
      : designation.length > 16
      ? '2.35mm'
      : '2.65mm';

  const centerFontSize =
    center.length > 20
      ? '2.2mm'
      : center.length > 15
      ? '2.45mm'
      : '2.7mm';

  const pinSuffix = pin && !address.includes(pin) ? `, PIN: ${pin}` : '';

  // Render Front Card
  const renderFront = (isOffscreen = false, elementId = 'rti-card-front', refObj?: any) => (
    <div
      ref={refObj || (isOffscreen ? undefined : (frontRef as any))}
      id={elementId}
      className={`rti-card relative bg-white select-none overflow-hidden rounded-[3mm] ${isOffscreen ? '' : 'shadow-2xl'}`}
      style={{
        width: '53.98mm',
        height: '85.6mm',
        minWidth: '53.98mm',
        minHeight: '85.6mm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, Heros, Arial, sans-serif',
        color: '#1b1f2a',
        border: '0.25mm solid #c9d3e4',
        boxShadow: isOffscreen ? 'none' : undefined,
        position: 'relative',
        left: 0,
        top: 0,
        opacity: 1,
        pointerEvents: isOffscreen ? 'none' : undefined,
      }}
    >
      {/* Top Brand Header */}
      <div
        className="absolute left-0 right-0 top-0 overflow-hidden"
        style={{
          height: '19.8mm',
          background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #e8f0fc 100%)',
        }}
      >
        {/* Header bottom accent stripe */}
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{
            height: '0.8mm',
            background: 'linear-gradient(90deg, #06317a, #0b4fb3 60%, #d71920 60%, #d71920)',
          }}
        />

        {/* Logo */}
        <div
          className="absolute rounded-full overflow-hidden flex items-center justify-center bg-white"
          style={{
            left: '2.2mm',
            top: '1.6mm',
            width: '16.6mm',
            height: '16.6mm',
            boxShadow: '0 0.25mm 0.8mm rgba(6, 49, 122, 0.35)',
          }}
        >
          <img
            src={logoUrl || rtiExpressLogo}
            alt="Spot News Logo"
            className="w-full h-full object-contain pointer-events-none"
            crossOrigin="anonymous"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== rtiExpressLogo) {
                target.src = rtiExpressLogo;
              }
            }}
          />
        </div>

        {/* Brand text */}
        <div
          className="absolute flex flex-col justify-center text-left"
          style={{
            left: '20.2mm',
            right: '1.4mm',
            top: 0,
            bottom: '0.9mm',
          }}
        >
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 800,
              fontSize: '4.8mm',
              lineHeight: 1,
              color: '#0b4fb3',
              letterSpacing: '-0.15mm',
              whiteSpace: 'nowrap',
            }}
          >
            RTI EXPRESS
          </div>
          <div
            style={{
              fontFamily: 'Heros, sans-serif',
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: '3.9mm',
              lineHeight: 1,
              color: '#d71920',
              marginTop: '1.3mm',
              letterSpacing: '0.05mm',
              whiteSpace: 'nowrap',
            }}
          >
            Spot News 24×7
          </div>
        </div>
      </div>

      {/* Act Line */}
      <div
        className="absolute left-0 right-0 text-center pointer-events-none"
        style={{
          top: '20.8mm',
          height: '3.0mm',
          lineHeight: '3.0mm',
          fontFamily: 'Heros, sans-serif',
          fontWeight: 700,
          fontSize: '2.8mm',
          color: '#d71920',
          letterSpacing: '0.15mm',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '5.5mm',
            height: '0.35mm',
            background: '#d71920',
            verticalAlign: 'middle',
            marginRight: '1.4mm',
          }}
        />
        <span style={{ verticalAlign: 'middle' }}>{actLine}</span>
        <span
          style={{
            display: 'inline-block',
            width: '5.5mm',
            height: '0.35mm',
            background: '#d71920',
            verticalAlign: 'middle',
            marginLeft: '1.4mm',
          }}
        />
      </div>

      {/* Media Type Vertical Ribbon */}
      <div
        className="absolute flex items-center justify-center pointer-events-none"
        style={{
          left: '8.8mm',
          top: '25.2mm',
          height: '27.2mm',
          width: '5mm',
        }}
      >
        <span
          style={{
            display: 'block',
            transform: 'rotate(-90deg)',
            whiteSpace: 'nowrap',
            fontFamily: 'Heros, sans-serif',
            fontWeight: 700,
            fontSize: '2.95mm',
            lineHeight: 1,
            color: '#d71920',
            letterSpacing: '0.25mm',
          }}
        >
          {mediaType}
        </span>
      </div>

      {/* Reporter Photo */}
      <div
        onClick={onPhotoClick}
        className={`absolute overflow-hidden bg-[#eef2f8] ${onPhotoClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all' : ''}`}
        style={{
          left: '15.2mm',
          top: '25.2mm',
          width: '23.6mm',
          height: '27.2mm',
          border: '0.55mm solid #0b4fb3',
          boxSizing: 'border-box',
        }}
        title={onPhotoClick ? 'Click to change photo' : undefined}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            style={{ objectPosition: '50% 20%' }}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center text-center p-1"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '2mm',
              lineHeight: 1.3,
              color: '#8a94a6',
            }}
          >
            <span>PASTE</span>
            <span>PHOTO</span>
            <span>HERE</span>
          </div>
        )}
      </div>

      {/* Watermark Logo in center */}
      <img
        src={logoUrl}
        alt=""
        crossOrigin="anonymous"
        className="absolute pointer-events-none"
        style={{
          left: '12mm',
          top: '52mm',
          width: '30mm',
          height: '24mm',
          opacity: 0.08,
          objectFit: 'contain',
        }}
      />

      {/* Verification Seal PNG Image (100% html2canvas reliable) */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '33.2mm',
          top: '37.5mm',
          width: '15.0mm',
          height: '15.0mm',
          transform: 'rotate(-14deg)',
          zIndex: 10,
        }}
      >
        {sealPng ? (
          <img
            src={sealPng}
            alt="Official Verification Seal"
            className="w-full h-full object-contain"
            style={{ display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '0.6mm solid #251a82',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#251a82',
              fontWeight: 900,
              fontSize: '2mm',
            }}
          >
            VERIFIED
          </div>
        )}
      </div>

      {/* Fields Box: Clean grid with aligned colons and guaranteed non-overlapping bounds */}
      <div
        className="absolute flex flex-col justify-between"
        style={{
          left: '2.4mm',
          right: '2.0mm',
          top: '53.8mm',
          height: '21.8mm',
        }}
      >
        {/* Name */}
        <div style={{ display: 'flex', alignItems: 'baseline', height: '4.0mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '18.5mm', flexShrink: 0, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.5mm', color: '#2b2f38', letterSpacing: '0.01mm', lineHeight: '1.2' }}>
            Name
          </span>
          <span style={{ width: '2.2mm', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.5mm', color: '#2b2f38', lineHeight: '1.2' }}>
            :
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: '1.2mm',
              fontFamily: 'Inter, Arial, sans-serif',
              fontWeight: 700,
              fontSize: nameFontSize,
              color: '#d71920',
              textTransform: 'uppercase',
              letterSpacing: nameLen >= 18 ? '-0.03mm' : '0.01mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              lineHeight: '1.2',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transformOrigin: 'left center',
                transform: nameLen > 18 ? 'scaleX(0.90)' : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
          </span>
        </div>

        {/* Designation */}
        <div style={{ display: 'flex', alignItems: 'baseline', height: '4.0mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.2mm', flexShrink: 0, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', letterSpacing: '0.01mm', lineHeight: '1.2' }}>
            Designation
          </span>
          <span style={{ width: '1.8mm', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', lineHeight: '1.2' }}>
            :
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: '0.8mm',
              fontFamily: 'Inter, Arial, sans-serif',
              fontWeight: 700,
              fontSize: desigFontSize,
              color: '#111111',
              textTransform: 'uppercase',
              letterSpacing: designation.length > 18 ? '-0.02mm' : '0.01mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              lineHeight: '1.2',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transformOrigin: 'left center',
                transform: designation.length > 18 ? 'scaleX(0.92)' : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {designation}
            </span>
          </span>
        </div>

        {/* Center */}
        <div style={{ display: 'flex', alignItems: 'baseline', height: '4.0mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.2mm', flexShrink: 0, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', letterSpacing: '0.01mm', lineHeight: '1.2' }}>
            Center
          </span>
          <span style={{ width: '1.8mm', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', lineHeight: '1.2' }}>
            :
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: '0.8mm',
              fontFamily: 'Inter, Arial, sans-serif',
              fontWeight: 700,
              fontSize: centerFontSize,
              color: '#111111',
              textTransform: 'uppercase',
              letterSpacing: center.length > 16 ? '-0.02mm' : '0.01mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              lineHeight: '1.2',
            }}
          >
            {center}
          </span>
        </div>

        {/* Valid Upto */}
        <div style={{ display: 'flex', alignItems: 'baseline', height: '4.0mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.2mm', flexShrink: 0, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', letterSpacing: '0.01mm', lineHeight: '1.2' }}>
            Valid Upto
          </span>
          <span style={{ width: '1.8mm', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', lineHeight: '1.2' }}>
            :
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: '0.8mm',
              fontFamily: 'Inter, Arial, sans-serif',
              fontWeight: 700,
              fontSize: '2.8mm',
              color: '#111111',
              textTransform: 'uppercase',
              letterSpacing: '0.01mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              lineHeight: '1.2',
            }}
          >
            {validUpto}
          </span>
        </div>

        {/* Card No. */}
        <div style={{ display: 'flex', alignItems: 'baseline', height: '4.0mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.2mm', flexShrink: 0, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', letterSpacing: '0.01mm', lineHeight: '1.2' }}>
            Card No.
          </span>
          <span style={{ width: '1.8mm', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, fontSize: '2.4mm', color: '#2b2f38', lineHeight: '1.2' }}>
            :
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: '0.8mm',
              fontFamily: 'Inter, Arial, sans-serif',
              fontWeight: 700,
              fontSize: cardNo.length > 16 ? '2.6mm' : '2.9mm',
              color: '#0b4fb3',
              textTransform: 'uppercase',
              letterSpacing: '0.01mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              lineHeight: '1.2',
            }}
          >
            {cardNo}
          </span>
        </div>
      </div>

      {/* Bottom PRESS Banner: High-resolution PNG Image (100% html2canvas reliable) */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none overflow-hidden"
        style={{
          height: '9.0mm',
          width: '100%',
        }}
      >
        {pressBannerPng ? (
          <img
            src={pressBannerPng}
            alt="PRESS"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'fill',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#d71920' }} />
        )}
      </div>
    </div>
  );

  // Render Back Card
  const renderBack = (isOffscreen = false, elementId = 'rti-card-back', refObj?: any) => (
    <div
      ref={refObj || (isOffscreen ? undefined : (backRef as any))}
      id={elementId}
      className={`rti-card relative bg-white select-none overflow-hidden rounded-[3mm] ${isOffscreen ? '' : 'shadow-2xl'}`}
      style={{
        width: '53.98mm',
        height: '85.6mm',
        minWidth: '53.98mm',
        minHeight: '85.6mm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, Heros, Arial, sans-serif',
        color: '#1b1f2a',
        border: '0.25mm solid #c9d3e4',
        boxShadow: isOffscreen ? 'none' : undefined,
        position: 'relative',
        left: 0,
        top: 0,
        opacity: 1,
        pointerEvents: isOffscreen ? 'none' : undefined,
      }}
    >
      {/* Back Body */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          top: '2.3mm',
          bottom: '17.2mm',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: 'Termes, serif',
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: '4.15mm',
            lineHeight: 1,
            color: '#a50f15',
            letterSpacing: '0.05mm',
            flex: 'none',
          }}
        >
          <span style={{ borderBottom: '0.32mm solid #a50f15', paddingBottom: '0.35mm' }}>
            EMPLOYEE ADDRESS
          </span>
        </div>

        {/* Name - Rendered fully without truncation */}
        <div
          className="w-full px-2 text-center"
          style={{
            marginTop: '1.5mm',
            fontFamily: 'Heros, sans-serif',
            fontWeight: 700,
            fontSize: name.length > 20 ? '3.1mm' : '3.8mm',
            lineHeight: 1.1,
            color: '#d71920',
            whiteSpace: 'nowrap',
            overflow: 'visible',
            flex: 'none',
          }}
        >
          {name}
        </div>

        {/* Address */}
        <div
          className="w-full text-center"
          style={{
            padding: '0 2.4mm',
            marginTop: '0.9mm',
            fontFamily: 'Heros, sans-serif',
            fontWeight: 700,
            fontSize: '2.35mm',
            lineHeight: 1.3,
            color: '#1d1f24',
            textTransform: 'uppercase',
            flex: 'none',
          }}
        >
          {guardian && (
            <div className="truncate">
              {relation}: {guardian}
            </div>
          )}
          <div className="addr-text" style={{ whiteSpace: 'normal', maxHeight: '11mm', overflow: 'hidden' }}>
            {address}
            {pinSuffix}
          </div>
          <div className="truncate" style={{ marginTop: '0.4mm' }}>
            PH: {phone}
          </div>
        </div>

        {/* QR Code PNG Image (100% html2canvas reliable) */}
        <div
          className="flex items-center justify-center"
          style={{
            width: '20mm',
            height: '20mm',
            marginTop: '1.4mm',
            flex: 'none',
          }}
        >
          {qrPng ? (
            <img
              src={qrPng}
              alt="QR Code"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f1f5f9' }} />
          )}
        </div>

        {/* QR Caption */}
        <div
          style={{
            marginTop: '0.5mm',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '1.6mm',
            lineHeight: 1,
            color: '#5a6476',
            letterSpacing: '0.1mm',
            flex: 'none',
          }}
        >
          SCAN TO VERIFY · {cardNo}
        </div>

        <div style={{ flex: '1 1 0', minHeight: 0 }} />

        {/* Instruction Title */}
        <div
          style={{
            fontFamily: 'Termes, serif',
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: '3.3mm',
            lineHeight: 1,
            color: '#a50f15',
            flex: 'none',
          }}
        >
          <span style={{ borderBottom: '0.3mm solid #a50f15', paddingBottom: '0.3mm' }}>
            INSTRUCTION
          </span>
        </div>

        {/* Instruction List */}
        <ul
          className="list-none text-left"
          style={{
            width: '100%',
            padding: '0 2.2mm 0 3mm',
            marginTop: '1.1mm',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.85mm',
            lineHeight: 1.28,
            color: '#3a2a8c',
            flex: 'none',
          }}
        >
          <li style={{ paddingLeft: '2mm', textIndent: '-2mm', marginBottom: '0.15mm' }}>
            <span style={{ fontWeight: 700 }}>* </span>This card shall be displayed while on duty
          </li>
          <li style={{ paddingLeft: '2mm', textIndent: '-2mm', marginBottom: '0.15mm' }}>
            <span style={{ fontWeight: 700 }}>* </span>Report immediately to issuing authority in case of loss / damage
          </li>
          <li style={{ paddingLeft: '2mm', textIndent: '-2mm' }}>
            <span style={{ fontWeight: 700 }}>* </span>This card shall be handed over while leaving the organization
          </li>
        </ul>
      </div>

      {/* Back Footer */}
      <div
        className="absolute left-0 right-0 bottom-0 text-center text-white"
        style={{
          height: '16.4mm',
          background: 'linear-gradient(180deg, #0b4fb3 0%, #06317a 100%)',
          paddingTop: '0.8mm',
          borderTop: '0.5mm solid #d71920',
        }}
      >
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: '1.45mm',
            lineHeight: 1,
            color: '#ffd84d',
            letterSpacing: '0.3mm',
          }}
        >
          HEAD OFFICE
        </div>
        <div
          style={{
            fontFamily: 'Heros, sans-serif',
            fontWeight: 700,
            fontSize: '2.55mm',
            lineHeight: 1,
            margin: '0.35mm 0',
            letterSpacing: '0.06mm',
          }}
        >
          {orgName}
        </div>
        <div
          className="truncate px-1"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.33mm',
            lineHeight: 1.3,
          }}
        >
          {orgAddress}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.33mm',
            lineHeight: 1.3,
          }}
        >
          <b style={{ fontWeight: 700 }}>GSTIN:</b> {orgGstin} &nbsp;·&nbsp; <b style={{ fontWeight: 700 }}>Mob:</b> {orgPhone}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.33mm',
            lineHeight: 1.3,
          }}
        >
          <b style={{ fontWeight: 700 }}>e-mail:</b> {orgEmail}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.33mm',
            lineHeight: 1.3,
          }}
        >
          <b style={{ fontWeight: 700 }}>CIN:</b> {orgCin} &nbsp;·&nbsp; <b style={{ fontWeight: 700 }}>MSME:</b> {orgMsme}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.33mm',
            lineHeight: 1.3,
          }}
        >
          <b style={{ fontWeight: 700 }}>Register of Firms No:</b> {orgFirms} &nbsp;·&nbsp; <b style={{ fontWeight: 700 }}>Labour Reg No:</b> {orgLabour}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '1.33mm',
            lineHeight: 1.3,
          }}
        >
          <b style={{ fontWeight: 700 }}>Postal licence:</b> {orgPostal}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="rti-card-container inline-flex flex-col sm:flex-row items-center justify-center gap-6 relative select-none"
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {/* Pristine flat export elements positioned within viewport behind page */}
      <div
        className="rti-export-nodes pointer-events-none"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          opacity: 0.001,
          zIndex: -9999,
          pointerEvents: 'none',
          width: '53.98mm',
          height: '85.6mm',
          overflow: 'hidden',
          transform: 'none',
        }}
      >
        {renderFront(true, 'rti-card-front', frontRef)}
        {renderBack(true, 'rti-card-back', backRef)}
      </div>

      {/* Visual Renderings */}
      {side === 'both' ? (
        <>
          {renderFront(false, 'rti-card-front-visible')}
          {renderBack(false, 'rti-card-back-visible')}
        </>
      ) : (
        /* 3D Smooth Flip Card */
        <div
          className="rti-flip-scene cursor-pointer select-none"
          style={{
            perspective: '1200px',
            width: '53.98mm',
            height: '85.6mm',
          }}
          onClick={onCardFlip}
          title="Click to flip ID card"
        >
          <div
            className="rti-flip-card relative w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              transform: side === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Front Face */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)',
              }}
            >
              {renderFront(false, 'rti-card-front-visible')}
            </div>

            {/* Back Face */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {renderBack(false, 'rti-card-back-visible')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
