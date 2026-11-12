import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Palette, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Interactive Client Theme & Mode Switcher
 * Lets the client switch between 4 curated agency color palettes + Light/Dark mode in real time.
 */
export const ThemeToggle = () => {
  const { resolvedTheme, setTheme, palette, setPalette, palettes } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isDark = resolvedTheme === 'dark';

  const toggleDarkMode = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activePaletteObj = (palettes || []).find((p) => p.id === palette) || palettes?.[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      {/* Palette Picker Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          height: '36px',
          padding: '0 0.7rem',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--surface)',
          border: '1.5px solid var(--border)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.42rem',
          color: 'var(--text)',
          fontSize: '0.78rem',
          fontWeight: 800,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        title="Customize Brand Theme"
        aria-label="Customize Brand Theme"
      >
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: activePaletteObj?.swatch || 'var(--primary)',
            boxShadow: '0 0 0 2px var(--primary-soft)',
            flexShrink: 0,
          }}
        />
        <Palette size={14} color="var(--primary)" />
        <span className="theme-picker-label" style={{ whiteSpace: 'nowrap' }}>
          Theme
        </span>
      </button>

      {/* Quick Light / Dark Mode Button */}
      <button
        type="button"
        onClick={toggleDarkMode}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--surface)',
          border: '1.5px solid var(--border)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <Sun size={17} color="var(--primary)" />
        ) : (
          <Moon size={17} color="var(--primary)" />
        )}
      </button>

      {/* Popover Menu */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '265px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.22)',
            padding: '0.85rem',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-muted)' }}>
              Brand Theme Studio
            </span>
            <button
              type="button"
              onClick={toggleDarkMode}
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--primary-text)',
                backgroundColor: 'var(--primary-soft)',
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {isDark ? <><Sun size={12} /> Light</> : <><Moon size={12} /> Dark</>}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {(palettes || []).map((item) => {
              const isSelected = item.id === palette;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPalette(item.id);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '11px',
                    backgroundColor: isSelected ? 'var(--primary-soft)' : 'transparent',
                    border: isSelected ? '1.5px solid var(--primary)' : '1px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${item.swatch} 0%, ${item.secondarySwatch} 100%)`,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.83rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={15} color="var(--primary)" style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
