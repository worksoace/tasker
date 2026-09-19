import type { AppSettings, CustomThemeColors } from '../../main/types';

export interface ThemePresetOption {
  id: string;
  name: string;
  icon: string;
  bgApp: string;
  accent: string;
  description?: string;
}

export const MINIMAL_PRESETS: ThemePresetOption[] = [
  { id: 'light-clean', name: 'Clean White', icon: 'sun', bgApp: '#ffffff', accent: '#0f172a', description: 'Pure white & slate' },
  { id: 'light-sky', name: 'Soft Sky', icon: 'droplet', bgApp: '#f8fafc', accent: '#0284c7', description: 'Soft slate & cyan' },
  { id: 'light-indigo', name: 'Indigo Light', icon: 'sparkles', bgApp: '#ffffff', accent: '#4f46e5', description: 'Bright & vibrant indigo' },
  { id: 'dark-minimal', name: 'Minimal Dark', icon: 'moon', bgApp: '#18181b', accent: '#38bdf8', description: 'Dark zinc & sky' },
  { id: 'oled-minimal', name: 'OLED Black', icon: 'circle-dot', bgApp: '#000000', accent: '#f4f4f5', description: 'Pure black & white' }
];

export const DEV_DARK_PRESETS: ThemePresetOption[] = [
  { id: 'dev-midnight', name: 'Midnight Dev', icon: 'bolt', bgApp: '#09090b', accent: '#6366f1', description: 'Zinc-950 & Indigo' },
  { id: 'dev-matrix', name: 'Terminal Matrix', icon: 'terminal', bgApp: '#041d15', accent: '#10b981', description: 'Deep pine & Emerald' },
  { id: 'dev-oled', name: 'OLED Violet', icon: 'gem', bgApp: '#000000', accent: '#a855f7', description: 'Pitch black & Purple' },
  { id: 'dev-amber', name: 'Warm Charcoal', icon: 'mug', bgApp: '#18181b', accent: '#f59e0b', description: 'Warm dark & Amber' },
  { id: 'dev-synth', name: 'Cyber Synth', icon: 'wand', bgApp: '#0f051d', accent: '#ec4899', description: 'Deep neon & Rose' }
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) {
    return { r: 15, g: 23, b: 42 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function isLightBackground(hex: string): boolean {
  return getLuminance(hex) > 0.45;
}

export function getContrastTextColor(hex: string): string {
  return isLightBackground(hex) ? '#09090b' : '#ffffff';
}

export function adjustBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (c: number) => Math.min(255, Math.max(0, Math.round(c + (255 * percent) / 100)));
  const nr = adjust(r).toString(16).padStart(2, '0');
  const ng = adjust(g).toString(16).padStart(2, '0');
  const nb = adjust(b).toString(16).padStart(2, '0');
  return `#${nr}${ng}${nb}`;
}

export function computeAdaptiveColors(bgApp: string, accent: string): CustomThemeColors {
  const isLight = isLightBackground(bgApp);

  if (isLight) {
    return {
      bgApp,
      accent,
      accentHover: adjustBrightness(accent, -15),
      bgSurface: bgApp === '#ffffff' ? '#f8fafc' : adjustBrightness(bgApp, -3),
      bgCard: '#ffffff',
      border: bgApp === '#ffffff' ? '#e2e8f0' : adjustBrightness(bgApp, -8),
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      inputBg: '#f8fafc'
    };
  } else {
    return {
      bgApp,
      accent,
      accentHover: adjustBrightness(accent, 15),
      bgSurface: adjustBrightness(bgApp, 6),
      bgCard: adjustBrightness(bgApp, 10),
      border: adjustBrightness(bgApp, 14),
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      inputBg: adjustBrightness(bgApp, 6)
    };
  }
}

export const AVAILABLE_SANS_FONTS = [
  { label: 'Inter (Clean & Modern)', value: 'Inter' },
  { label: 'Plus Jakarta Sans (Tech)', value: 'Plus Jakarta Sans' },
  { label: 'Poppins (Soft Round)', value: 'Poppins' },
  { label: 'Outfit (Geometric Display)', value: 'Outfit' },
  { label: 'System Default UI', value: 'system-ui' }
];

export const AVAILABLE_MONO_FONTS = [
  { label: 'JetBrains Mono (Developer)', value: 'JetBrains Mono' },
  { label: 'Fira Code (Ligatures)', value: 'Fira Code' },
  { label: 'Source Code Pro', value: 'Source Code Pro' },
  { label: 'Standard Monospace', value: 'monospace' }
];

const loadedFonts = new Set<string>();

export function loadGoogleFont(fontName: string) {
  if (!fontName || fontName === 'system-ui' || fontName === 'monospace' || loadedFonts.has(fontName)) {
    return;
  }

  try {
    const formattedName = fontName.replace(/ /g, '+');
    const fontUrl = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@300;400;500;600;700&display=swap`;
    
    const existing = document.querySelector(`link[data-font="${fontName}"]`);
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontUrl;
      link.setAttribute('data-font', fontName);
      document.head.appendChild(link);
      loadedFonts.add(fontName);
    }
  } catch (err) {
    console.error('Failed to load google font:', fontName, err);
  }
}

export function applyTheme(settings: Partial<AppSettings>) {
  if (typeof document === 'undefined') return;

  const mode = settings.mode || 'minimal';
  let bgApp = settings.themeColors?.bgApp || '#ffffff';
  let accent = settings.themeColors?.accent || '#0f172a';

  // DEV MODE ENFORCEMENT: Dev mode should NEVER have a light theme!
  if (mode === 'dev' && isLightBackground(bgApp)) {
    bgApp = '#09090b';
    accent = '#6366f1';
  }

  const colors = computeAdaptiveColors(bgApp, accent);
  const sansFont = settings.fontFamily || (mode === 'minimal' ? 'Inter' : 'JetBrains Mono');
  const monoFont = settings.fontMono || 'JetBrains Mono';
  const fontSize = settings.fontSize || 'normal';
  const radius = settings.borderRadius || (mode === 'minimal' ? 'lg' : 'md');

  // Load Google Fonts
  loadGoogleFont(sansFont);
  loadGoogleFont(monoFont);

  const root = document.documentElement;
  const isLight = isLightBackground(bgApp);
  const accentTextColor = getContrastTextColor(colors.accent);

  // Apply Colors as CSS Variables
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-accent-text', accentTextColor);
  root.style.setProperty('--color-accent-hover', colors.accentHover || colors.accent);
  root.style.setProperty('--color-bg-app', colors.bgApp);
  root.style.setProperty('--color-bg-surface', colors.bgSurface || '#ffffff');
  root.style.setProperty('--color-bg-card', colors.bgCard || '#ffffff');
  root.style.setProperty('--color-border', colors.border || '#e2e8f0');
  root.style.setProperty('--color-text-primary', colors.textPrimary || '#0f172a');
  root.style.setProperty('--color-text-secondary', colors.textSecondary || '#64748b');
  root.style.setProperty('--color-input-bg', colors.inputBg || '#f8fafc');

  // Set is-light or is-dark indicator attribute on html element
  root.setAttribute('data-theme-scheme', isLight ? 'light' : 'dark');
  root.setAttribute('data-mode', mode);

  // Apply Typography
  const sansStack = sansFont === 'system-ui'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : `"${sansFont}", system-ui, -apple-system, sans-serif`;
  const monoStack = monoFont === 'monospace'
    ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    : `"${monoFont}", ui-monospace, SFMono-Regular, monospace`;

  root.style.setProperty('--font-sans', sansStack);
  root.style.setProperty('--font-mono', monoStack);

  // Font Size (Comfortable, legible scale)
  let fontSizePx = '15.5px';
  if (fontSize === 'compact') fontSizePx = '14px';
  if (fontSize === 'large') fontSizePx = '17.5px';
  root.style.setProperty('--font-size-base', fontSizePx);

  // Border Radius
  let radiusPx = '14px';
  if (radius === 'none') radiusPx = '0px';
  if (radius === 'sm') radiusPx = '8px';
  if (radius === 'md') radiusPx = '12px';
  if (radius === 'lg') radiusPx = '16px';
  if (radius === 'full') radiusPx = '9999px';
  root.style.setProperty('--radius-base', radiusPx);
}


