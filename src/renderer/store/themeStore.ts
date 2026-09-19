import { writable, derived } from 'svelte/store';

export type ThemeMode = 'light' | 'dark';

export const theme = writable<ThemeMode>('light');
export const isDark = derived(theme, ($t) => $t === 'dark');

export function applyTheme(currentTheme: ThemeMode) {
  if (typeof document === 'undefined') return;

  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }

  // Update native Electron titleBarOverlay if available
  if (window.api && window.api.setTheme) {
    window.api.setTheme(currentTheme).catch(() => {});
  }
}

export function setTheme(newTheme: ThemeMode) {
  theme.set(newTheme);
  try {
    localStorage.setItem('tasker_theme_mode', newTheme);
    localStorage.setItem('tasker_theme', newTheme);
  } catch (e) {}
  applyTheme(newTheme);
}

export function toggleTheme() {
  theme.update((curr) => {
    const next: ThemeMode = curr === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('tasker_theme_mode', next);
      localStorage.setItem('tasker_theme', next);
    } catch (e) {}
    applyTheme(next);
    return next;
  });
}

export function initTheme(): ThemeMode {
  let initial: ThemeMode = 'light';
  try {
    const saved = localStorage.getItem('tasker_theme_mode');
    if (saved === 'dark') {
      initial = 'dark';
    } else {
      // Default to Light Mode
      initial = 'light';
      localStorage.setItem('tasker_theme_mode', 'light');
      localStorage.setItem('tasker_theme', 'light');
    }
  } catch (e) {
    initial = 'light';
  }

  theme.set(initial);
  applyTheme(initial);
  return initial;
}
