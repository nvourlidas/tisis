import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return 'dark';
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem('theme', mode);
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
