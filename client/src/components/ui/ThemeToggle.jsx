import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Circular Theme Toggle (Light ☀️ / Dark 🌙 only, no auto)
 * High-contrast tactile circular button with instant theme toggle
 */
export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'var(--surface-2)',
        border: '1.5px solid var(--border)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
        flexShrink: 0,
      }}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun size={18} color="var(--primary)" />
      ) : (
        <Moon size={18} color="var(--primary)" />
      )}
    </button>
  );
};
