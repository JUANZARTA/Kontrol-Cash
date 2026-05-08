import { ThemePaletteVars } from './fixed-palette';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const safe = (hex || '#0ea5e9').replace('#', '');
  const normalized = safe.length === 3 ? safe.split('').map((c) => c + c).join('') : safe;
  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case r:
        h = 60 * (((g - b) / d) % 6);
        break;
      case g:
        h = 60 * ((b - r) / d + 2);
        break;
      default:
        h = 60 * ((r - g) / d + 4);
        break;
    }
  }

  if (h < 0) h += 360;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const buildEditablePalette = (accent: string): ThemePaletteVars => {
  const { h, s } = hexToHsl(accent || '#0ea5e9');
  return {
    '--app-accent': accent || '#0ea5e9',
    '--app-accent-strong': `hsl(${h} ${clamp(s + 8, 35, 95)}% 38%)`,
    '--app-accent-soft': `hsl(${h} ${clamp(s, 30, 90)}% 92%)`,

    '--app-bg-light': `hsl(${h} 38% 97%)`,
    '--app-bg-soft-light': `hsl(${h} 34% 94%)`,
    '--app-surface-light': `hsla(${h}, 35%, 99%, 0.92)`,
    '--app-card-light': `hsl(${h} 28% 99%)`,
    '--app-border-light': `hsl(${h} 22% 86%)`,
    '--app-text-light': `hsl(${h} 25% 13%)`,
    '--app-muted-light': `hsl(${h} 14% 38%)`,
    '--app-muted-soft-light': `hsl(${h} 12% 58%)`,

    '--app-bg-dark': `hsl(${h} 32% 7%)`,
    '--app-bg-soft-dark': `hsl(${h} 28% 13%)`,
    '--app-surface-dark': `hsla(${h}, 24%, 16%, 0.92)`,
    '--app-card-dark': `hsl(${h} 24% 15%)`,
    '--app-border-dark': `hsla(${h}, 15%, 70%, 0.26)`,
    '--app-text-dark': `hsl(${h} 35% 95%)`,
    '--app-muted-dark': `hsl(${h} 18% 80%)`,
    '--app-muted-soft-dark': `hsl(${h} 12% 62%)`,
  };
};
