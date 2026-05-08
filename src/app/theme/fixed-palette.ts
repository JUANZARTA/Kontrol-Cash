export interface ThemePaletteVars {
  [cssVar: string]: string;
}

// Paleta fija (base original acordada)
export const FIXED_THEME_PALETTE: ThemePaletteVars = {
  '--app-accent': '#0ea5e9',
  '--app-accent-strong': 'color-mix(in srgb, #0ea5e9 82%, #000 18%)',
  '--app-accent-soft': 'color-mix(in srgb, #0ea5e9 16%, transparent)',

  '--app-bg-light': '#f8fafc',
  '--app-bg-soft-light': '#eef4ff',
  '--app-surface-light': 'rgba(255, 255, 255, 0.92)',
  '--app-card-light': '#ffffff',
  '--app-border-light': '#dbe5f0',
  '--app-text-light': '#0f172a',
  '--app-muted-light': '#475569',
  '--app-muted-soft-light': '#94a3b8',

  '--app-bg-dark': '#020617',
  '--app-bg-soft-dark': '#0f172a',
  '--app-surface-dark': 'rgba(15, 23, 42, 0.92)',
  '--app-card-dark': '#0f172a',
  '--app-border-dark': 'rgba(148, 163, 184, 0.24)',
  '--app-text-dark': '#f1f5f9',
  '--app-muted-dark': '#cbd5e1',
  '--app-muted-soft-dark': '#94a3b8',
};
