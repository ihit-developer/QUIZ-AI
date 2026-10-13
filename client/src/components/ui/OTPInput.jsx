import React, { useRef } from 'react';

export const OTPInput = ({ length = 6, value = '', onChange }) => {
  const inputRefs = useRef([]);

  const chars = value.split('').slice(0, length);
  while (chars.length < length) {
    chars.push('');
  }

  const handleChange = (e, idx) => {
    const rawVal = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!rawVal) {
      const next = [...chars];
      next[idx] = '';
      onChange(next.join(''));
      return;
    }

    if (rawVal.length > 1) {
      const pasted = rawVal.slice(0, length);
      onChange(pasted);
      const focusTarget = Math.min(pasted.length, length - 1);
      inputRefs.current[focusTarget]?.focus();
      return;
    }

    const next = [...chars];
    next[idx] = rawVal[0];
    onChange(next.join(''));

    if (idx < length - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e, idx) => {
    const raw = e.clipboardData.getData('text');
    const linkMatch = raw.match(/\/join\/([a-z0-9]{4,})/i);
    const pasted = (linkMatch?.[1] || raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !chars[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', width: '100%' }}>
      {chars.map((char, idx) => (
        <input
          key={idx}
          ref={(el) => (inputRefs.current[idx] = el)}
          type="text"
          maxLength={1}
          value={char}
          onChange={(e) => handleChange(e, idx)}
          onPaste={(e) => handlePaste(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          style={{
            width: 'clamp(44px, 12vw, 62px)',
            height: 'clamp(52px, 14vw, 68px)',
            textAlign: 'center',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--primary)',
            backgroundColor: 'var(--surface-2)',
            border: char ? '2px solid var(--primary)' : '1.5px solid var(--border)',
            borderRadius: 'var(--radius-btn)',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
            transition: 'border-color 0.15s ease',
          }}
        />
      ))}
    </div>
  );
};
