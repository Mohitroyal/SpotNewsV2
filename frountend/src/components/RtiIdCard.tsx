import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

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

export const RtiIdCard: React.FC<RtiIdCardProps> = ({
  data,
  frontRef,
  backRef,
  side = 'both',
  scale = 1,
  onPhotoClick,
  onCardFlip,
}) => {
  const [qrSvg, setQrSvg] = useState<string>('');

  const cardNo = (data.cardNo || 'RTI 1147').toUpperCase().trim();
  const name = (data.name || 'POKKALA MOHITH ROYAL').toUpperCase().trim();
  const designation = (data.designation || 'PRESS REPORTER').toUpperCase().trim();
  const center = (data.center || 'HYDERABAD').toUpperCase().trim();
  const validUpto = (data.validUpto || `31-12-${new Date().getFullYear() + 1}`).trim();
  const mediaType = (data.mediaType || 'PRINT MEDIA').toUpperCase().trim();
  const actLine = (data.actLine || 'RTI ACT-2005').trim();
  const photoUrl = data.photoUrl || '';
  const logoUrl = data.logoUrl || '/logo_spotnews.png';

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

  // Dynamic font scaling to guarantee long names like "POKKALA MOHITH ROYAL" fit cleanly without ellipsis
  const nameLen = name.length;
  const nameFontSize =
    nameLen >= 26
      ? '1.9mm'
      : nameLen >= 19
      ? '2.15mm'
      : nameLen >= 15
      ? '2.4mm'
      : nameLen >= 12
      ? '2.65mm'
      : '2.95mm';

  const desigFontSize =
    designation.length > 22
      ? '2.3mm'
      : designation.length > 17
      ? '2.6mm'
      : '2.95mm';

  const centerFontSize =
    center.length > 20
      ? '2.35mm'
      : center.length > 15
      ? '2.65mm'
      : '2.95mm';

  // Generate QR code SVG payload
  useEffect(() => {
    const payload = `RTI EXPRESS Spot News 24x7\nID: ${cardNo}\n${name}\n${designation}\nValid upto: ${validUpto}\nVerify: ${orgPhone}`;
    QRCode.toString(payload, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#06317a',
        light: '#ffffff',
      },
    })
      .then((svgString) => setQrSvg(svgString))
      .catch((err) => console.warn('QR code generation error:', err));
  }, [cardNo, name, designation, validUpto, orgPhone]);

  const pinSuffix = pin && !address.includes(pin) ? `, PIN: ${pin}` : '';

  // Render Front Card
  const renderFront = (isOffscreen = false, elementId = 'rti-card-front', refObj?: any) => (
    <div
      ref={refObj || (isOffscreen ? undefined : (frontRef as any))}
      id={elementId}
      className="rti-card relative bg-white select-none overflow-hidden shadow-2xl rounded-[3mm]"
      style={{
        width: '53.98mm',
        height: '85.6mm',
        minWidth: '53.98mm',
        minHeight: '85.6mm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, Heros, Arial, sans-serif',
        color: '#1b1f2a',
        border: '0.2mm solid #c9d3e4',
        position: isOffscreen ? 'absolute' : 'relative',
        left: isOffscreen ? 0 : undefined,
        top: isOffscreen ? 0 : undefined,
        zIndex: isOffscreen ? -9999 : undefined,
        opacity: isOffscreen ? 0 : undefined,
        pointerEvents: isOffscreen ? 'none' : undefined,
      }}
    >
      {/* Top Brand Header */}
      <div
        className="absolute left-0 right-0 top-0 overflow-hidden"
        style={{
          height: '20.5mm',
          background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #e8f0fc 100%)',
        }}
      >
        {/* Header bottom accent stripe */}
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{
            height: '0.9mm',
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
            src={logoUrl}
            alt="Spot News Logo"
            className="w-full h-full object-contain"
            crossOrigin="anonymous"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo_spotnews.png';
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
          top: '21.4mm',
          height: '3.4mm',
          lineHeight: '3.4mm',
          fontFamily: 'Heros, sans-serif',
          fontWeight: 700,
          fontSize: '3.1mm',
          color: '#d71920',
          letterSpacing: '0.15mm',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '6mm',
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
            width: '6mm',
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
          left: '9mm',
          top: '25.6mm',
          height: '28.6mm',
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
            fontSize: '3.05mm',
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
          top: '25.6mm',
          width: '23.6mm',
          height: '28.6mm',
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
          height: '30mm',
          opacity: 0.06,
          borderRadius: '50%',
        }}
      />

      {/* Verification Seal SVG */}
      <svg
        className="absolute pointer-events-none"
        viewBox="0 0 100 100"
        aria-hidden="true"
        style={{
          left: '33.6mm',
          top: '40.4mm',
          width: '14.2mm',
          height: '14.2mm',
          transform: 'rotate(-14deg)',
          opacity: 0.9,
        }}
      >
        <defs>
          <path id="sealArc" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <g fill="none" stroke="#3b2fa0" strokeWidth="2.6">
          <circle cx="50" cy="50" r="47" />
          <circle cx="50" cy="50" r="29" />
        </g>
        <text fontFamily="Inter" fontWeight="800" fontSize="11.2" fill="#3b2fa0" letterSpacing="1.1">
          <textPath href="#sealArc" startOffset="0">
            ★ RTI EXPRESS ★ SPOT NEWS 24×7
          </textPath>
        </text>
        <text x="50" y="45" textAnchor="middle" fontFamily="Inter" fontWeight="800" fontSize="8.6" fill="#3b2fa0">
          VERIFIED
        </text>
        <text x="50" y="56" textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="7.4" fill="#3b2fa0">
          REPORTER
        </text>
        <text x="50" y="66" textAnchor="middle" fontFamily="Inter" fontWeight="600" fontSize="6" fill="#3b2fa0">
          {cardNo}
        </text>
      </svg>

      {/* Fields Box */}
      <div
        className="absolute flex flex-col justify-between"
        style={{
          left: '2.4mm',
          right: '2mm',
          top: '55.5mm',
          bottom: '9.2mm',
        }}
      >
        {/* Name - Rendered fully without ellipsis truncation */}
        <div className="flex items-baseline" style={{ height: '3.95mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.6mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm', color: '#2b2f38' }}>
            Name
          </span>
          <span style={{ width: '2.2mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm' }}>:</span>
          <span
            className="flex-1 min-w-0"
            style={{
              fontFamily: 'Heros, sans-serif',
              fontWeight: 700,
              fontSize: nameFontSize,
              color: '#d71920',
              textTransform: 'uppercase',
              letterSpacing: nameLen >= 18 ? '-0.06mm' : '0.01mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {name}
          </span>
        </div>

        {/* Designation */}
        <div className="flex items-baseline" style={{ height: '3.95mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.6mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm', color: '#2b2f38' }}>
            Designation
          </span>
          <span style={{ width: '2.2mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm' }}>:</span>
          <span
            className="flex-1 min-w-0"
            style={{
              fontFamily: 'Heros, sans-serif',
              fontWeight: 700,
              fontSize: desigFontSize,
              color: '#111111',
              textTransform: 'uppercase',
              letterSpacing: designation.length > 18 ? '-0.03mm' : '0.03mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {designation}
          </span>
        </div>

        {/* Center */}
        <div className="flex items-baseline" style={{ height: '3.95mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.6mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm', color: '#2b2f38' }}>
            Center
          </span>
          <span style={{ width: '2.2mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm' }}>:</span>
          <span
            className="flex-1 min-w-0"
            style={{
              fontFamily: 'Heros, sans-serif',
              fontWeight: 700,
              fontSize: centerFontSize,
              color: '#111111',
              textTransform: 'uppercase',
              letterSpacing: center.length > 16 ? '-0.03mm' : '0.03mm',
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {center}
          </span>
        </div>

        {/* Valid Upto */}
        <div className="flex items-baseline" style={{ height: '3.95mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.6mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm', color: '#2b2f38' }}>
            Valid Upto
          </span>
          <span style={{ width: '2.2mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm' }}>:</span>
          <span
            className="flex-1 min-w-0"
            style={{
              fontFamily: 'Heros, sans-serif',
              fontWeight: 700,
              fontSize: '3.2mm',
              color: '#111111',
              textTransform: 'uppercase',
              letterSpacing: '0.03mm',
              whiteSpace: 'nowrap',
            }}
          >
            {validUpto}
          </span>
        </div>

        {/* Card No. */}
        <div className="flex items-baseline" style={{ height: '3.95mm', whiteSpace: 'nowrap' }}>
          <span style={{ width: '15.6mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm', color: '#2b2f38' }}>
            Card No.
          </span>
          <span style={{ width: '2.2mm', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '2.55mm' }}>:</span>
          <span
            className="flex-1 min-w-0 font-mono"
            style={{
              fontFamily: 'Heros, monospace, sans-serif',
              fontWeight: 700,
              fontSize: cardNo.length > 16 ? '2.7mm' : '3.1mm',
              color: '#0b4fb3',
              textTransform: 'uppercase',
              letterSpacing: '0.02mm',
              whiteSpace: 'nowrap',
            }}
          >
            {cardNo}
          </span>
        </div>
      </div>

      {/* Bottom PRESS Banner */}
      <div
        className="absolute left-0 right-0 bottom-0 flex items-center justify-center"
        style={{
          height: '8.4mm',
          background: '#d71920',
        }}
      >
        {/* Top border of press banner */}
        <div
          className="absolute left-0 right-0 top-0"
          style={{
            height: '0.7mm',
            background: '#06317a',
          }}
        />
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: '7.4mm',
            lineHeight: 1,
            color: '#ffffff',
            letterSpacing: '2.6mm',
            marginRight: '-2.6mm',
            marginTop: '0.7mm',
          }}
        >
          PRESS
        </span>
      </div>
    </div>
  );

  // Render Back Card
  const renderBack = (isOffscreen = false, elementId = 'rti-card-back', refObj?: any) => (
    <div
      ref={refObj || (isOffscreen ? undefined : (backRef as any))}
      id={elementId}
      className="rti-card relative bg-white select-none overflow-hidden shadow-2xl rounded-[3mm]"
      style={{
        width: '53.98mm',
        height: '85.6mm',
        minWidth: '53.98mm',
        minHeight: '85.6mm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, Heros, Arial, sans-serif',
        color: '#1b1f2a',
        border: '0.2mm solid #c9d3e4',
        position: isOffscreen ? 'absolute' : 'relative',
        left: isOffscreen ? 0 : undefined,
        top: isOffscreen ? 0 : undefined,
        zIndex: isOffscreen ? -9999 : undefined,
        opacity: isOffscreen ? 0 : undefined,
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

        {/* QR Code SVG */}
        <div
          className="flex items-center justify-center"
          style={{
            width: '20mm',
            height: '20mm',
            marginTop: '1.4mm',
            flex: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

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
      className="rti-card-container inline-flex flex-col sm:flex-row items-center justify-center gap-6 relative"
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
      }}
    >
      {/* Always present pristine flat export elements for html2canvas */}
      <div
        className="rti-export-nodes pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: 0,
          zIndex: -9999,
          pointerEvents: 'none',
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
