import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';

export const ShareQuizModal = ({ isOpen, onClose, quiz }) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !quiz) return null;

  const joinUrl = `${window.location.origin}/join/${quiz.joinCode}`;
  const isSelfPaced = quiz.mode === 'self_paced';

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    toast.success('Join link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(quiz.joinCode);
    toast.success('Join code copied to clipboard!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card-solid"
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
          padding: 'clamp(1rem, 4vw, 1.5rem)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          backgroundColor: 'var(--surface)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            color: 'var(--text-muted)',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>
            QUIZ PUBLISHED SUCCESSFULLY
          </span>
          <div style={{ marginBottom: '0.5rem' }}>
            <span className="badge badge-primary">
              {isSelfPaced ? 'SELF-PACED QUIZ' : 'LIVE ARENA QUIZ'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)' }}>
            {quiz.title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            {isSelfPaced
              ? 'Copy the code or direct link once, then share it with students. They can attempt before the due date.'
              : 'Share the code, projected QR card, or direct link with students to begin.'}
          </p>
        </div>

        <div style={{ textAlign: 'center', padding: '1rem', borderRadius: 'var(--radius-card)', background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-text)', letterSpacing: '0.08em' }}>JOIN CODE</div>
          <div style={{ fontSize: '2rem', letterSpacing: '0.16em', fontWeight: 900, color: 'var(--primary-text)', margin: '0.2rem 0 0.6rem' }}>{quiz.joinCode}</div>
          <Button type="button" variant="secondary" size="sm" onClick={copyCode}><Copy size={14} /> Copy Code</Button>
          {isSelfPaced && <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Students can attempt this self-paced quiz at any time before its due date.</p>}
        </div>

        {/* Shareable Link Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
            DIRECT SHAREABLE LINK
          </label>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-btn)',
              padding: '0.35rem 0.5rem 0.35rem 0.85rem',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              readOnly
              value={joinUrl}
              style={{
                background: 'transparent',
                border: 'none',
                width: '100%',
                fontSize: '0.85rem',
                color: 'var(--text)',
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={copyLink}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', minHeight: '34px' }}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Primary Action: Direct Entry to Live Room as Host */}
        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '0.85rem',
            fontSize: '1rem',
            fontWeight: 800,
          }}
        >
          {isSelfPaced ? 'Done — Go to Dashboard' : '🚀 Launch & Enter Live Room as Host'}
        </button>
      </div>
    </div>
  );
};
