import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Download } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * QRCard: Renders high-contrast QR code.
 * CRITICAL RULE: Always renders dark modules on a PURE WHITE background (#FFFFFF)
 * with a white quiet-zone padding in BOTH day and night modes to ensure 100% camera scanning reliability.
 */
export const QRCard = ({
  value,
  joinCode,
  title = 'Join Code & QR Scanner',
  size = 180,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    setCopiedCode(true);
    toast.success('Join code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const downloadSVG = () => {
    const svgEl = document.getElementById('quiz-qr-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-${joinCode || 'qr'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('QR Code downloaded!');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
      }}
    >
      {/* Dedicated White Container for Reliable Camera Scanning in ALL Modes */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '1.25rem',
          borderRadius: '1rem',
          border: '1px solid #E5E5E5',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <QRCodeSVG
          id="quiz-qr-svg"
          value={value || joinCode || 'QUIZESE'}
          size={size}
          level="H"
          bgColor="#FFFFFF"
          fgColor="#1C1917"
          marginSize={2}
        />
      </div>

      {joinCode && (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            6-CHARACTER JOIN CODE
          </div>
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              letterSpacing: '0.18em',
              color: 'var(--primary)',
              fontVariantNumeric: 'tabular-nums',
              marginTop: '0.15rem',
            }}
          >
            {joinCode}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={handleCopyCode}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', minHeight: '38px' }}
            >
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              {copiedCode ? 'Copied' : 'Copy Code'}
            </button>
            <button
              type="button"
              onClick={downloadSVG}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', minHeight: '38px' }}
            >
              <Download size={16} /> Save QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
