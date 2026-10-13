import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = ({
  label,
  error,
  icon: Icon,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  style = {},
  ...props
}) => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
          {label} {required && <span style={{ color: 'var(--primary)' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        {Icon && (
          <div
            style={{
              position: 'absolute',
              left: '0.9rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <Icon size={18} />
          </div>
        )}
        <input
          type={isPassword && passwordVisible ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={className}
          style={{
            width: '100%',
            backgroundColor: 'var(--surface-2)',
            color: 'var(--text)',
            border: error ? '1.5px solid var(--hero)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-btn)',
            padding: Icon ? `0.75rem ${isPassword ? '2.8rem' : '1rem'} 0.75rem 2.6rem` : `0.75rem ${isPassword ? '2.8rem' : '1rem'}`,
            fontSize: '0.95rem',
            minHeight: '44px',
            transition: 'border-color 0.15s ease',
            ...style,
          }}
          {...props}
        />
        {isPassword && (
          <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '0.75rem', color: 'var(--text-muted)', display: 'flex', padding: '0.2rem' }}>
            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <span style={{ fontSize: '0.78rem', color: 'var(--primary-text)', fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  );
};
