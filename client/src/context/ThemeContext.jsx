import React, { createContext, useContext, useState, useEffect } from 'react';
import { BRAND_CONFIG, THEME_PALETTES } from '../config/brand';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('quizese_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  const [palette, setPaletteState] = useState(() => {
    try {
      const savedPalette = localStorage.getItem('quizese_palette');
      if (savedPalette && THEME_PALETTES.some((p) => p.id === savedPalette)) {
        return savedPalette;
      }
    } catch {}
    return BRAND_CONFIG.defaultPalette || 'indigo';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    const updateResolved = () => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      const active = isDark ? 'dark' : 'light';
      setResolvedTheme(active);

      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    updateResolved();
    try {
      localStorage.setItem('quizese_theme', theme);
    } catch {}

    if (theme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateResolved();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', palette);
    try {
      localStorage.setItem('quizese_palette', palette);
    } catch {}
  }, [palette]);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme);
  };

  const setPalette = (nextPalette) => {
    setPaletteState(nextPalette);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        palette,
        setPalette,
        palettes: THEME_PALETTES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
