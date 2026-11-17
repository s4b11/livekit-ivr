import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const QUERY = '(prefers-color-scheme: dark)';

/** Follows the system colour scheme and mirrors it onto <html class="dark">. */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() =>
    window.matchMedia(QUERY).matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setMode(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  return mode;
}
