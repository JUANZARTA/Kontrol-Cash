import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'mi-cartera-theme';
  private readonly accentStorageKey = 'mi-cartera-accent';
  private readonly customColorKey = 'mi-cartera-custom-color';
  private readonly themeSubject = new BehaviorSubject<ThemeMode>('light');
  readonly theme$ = this.themeSubject.asObservable();

  private initialized = false;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  initTheme(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    const savedTheme = window.localStorage.getItem(this.storageKey);
    const theme = this.isThemeMode(savedTheme) ? savedTheme : this.getPreferredTheme();
    this.applyTheme(theme);
    this.initialized = true;
  }

  initAccent(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const useCustom = window.localStorage.getItem(this.customColorKey) === 'true';
    const accent = window.localStorage.getItem(this.accentStorageKey) || '#0ea5e9';
    if (useCustom) {
      this.applyAccentVars(accent);
      this.document.documentElement.classList.add('custom-color');
    }
  }

  toggleTheme(): void {
    this.setTheme(this.isDarkMode() ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): void {
    this.applyTheme(theme);
    if (isPlatformBrowser(this.platformId)) {
      window.localStorage.setItem(this.storageKey, theme);
    }
  }

  isDarkMode(): boolean {
    return this.themeSubject.value === 'dark';
  }

  setCustomColorMode(enabled: boolean, accentHex: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.localStorage.setItem(this.customColorKey, String(enabled));
    window.localStorage.setItem(this.accentStorageKey, accentHex);
    const root = this.document.documentElement;
    if (enabled) {
      this.applyAccentVars(accentHex);
      root.classList.add('custom-color');
    } else {
      root.classList.remove('custom-color');
      this.clearAccentVars();
    }
  }

  previewAccentColor(hex: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.applyAccentVars(hex);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;
    root.classList.toggle('dark-theme', theme === 'dark');
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    this.themeSubject.next(theme);
  }

  private applyAccentVars(hex: string): void {
    if (!this.isValidHex(hex)) return;
    const { h, s, l } = this.hexToHsl(hex);
    const root = this.document.documentElement;

    const btnL = Math.min(l, 42);
    const sPct = `${s}%`;

    // Light mode
    root.style.setProperty('--app-accent', `hsl(${h}, ${sPct}, ${btnL}%)`);
    root.style.setProperty('--app-accent-hover', `hsl(${h}, ${sPct}, ${Math.max(btnL - 8, 15)}%)`);
    root.style.setProperty('--app-accent-link', `hsl(${h}, ${sPct}, ${btnL}%)`);
    root.style.setProperty('--app-accent-muted', `hsla(${h}, ${sPct}, 55%, 0.13)`);

    // Sidebar gradient (always dark regardless of light/dark mode)
    const sSide = `${Math.min(s, 72)}%`;
    root.style.setProperty('--app-sidebar-from', `hsl(${h}, ${sSide}, 9%)`);
    root.style.setProperty('--app-sidebar-via', `hsl(${h}, ${Math.min(s, 66)}%, 7%)`);
    root.style.setProperty('--app-sidebar-to', `hsl(${h}, ${Math.min(s, 80)}%, 5%)`);

    // Dark mode
    // Los pisos de saturación de abajo son para que colores poco saturados no se vean
    // "lavados" en dark mode. Pero si el color elegido es gris puro (s=0: negro, blanco,
    // grises), no tiene tono real — forzar un piso lo tiñe con el hue=0 (rojo) por defecto
    // de hexToHsl. Por eso a s=0 lo dejamos en 0 siempre, sin piso.
    const sDark = s === 0 ? 0 : Math.max(Math.round(s * 0.4), 14);
    const sBtnDark = s === 0 ? 0 : Math.max(s - 14, 28);
    root.style.setProperty('--app-accent-dark-bg', `hsl(${h}, ${sDark}%, 4%)`);
    root.style.setProperty('--app-accent-dark-bg-soft', `hsl(${h}, ${sDark}%, 7%)`);
    root.style.setProperty('--app-accent-dark-surface', `hsla(${h}, ${sDark}%, 10%, 0.92)`);
    root.style.setProperty('--app-accent-dark-row', `hsla(${h}, ${sDark}%, 8%, 0.88)`);
    root.style.setProperty('--app-accent-dark-btn', `hsl(${h}, ${sBtnDark}%, 28%)`);
    root.style.setProperty('--app-accent-dark-btn-hover', `hsl(${h}, ${sBtnDark}%, 22%)`);
    root.style.setProperty('--app-accent-dark-glow-1', `hsla(${h}, ${sPct}, 55%, 0.07)`);
    root.style.setProperty('--app-accent-dark-glow-2', `hsla(${h}, ${sPct}, 45%, 0.09)`);
  }

  private clearAccentVars(): void {
    const props = [
      '--app-accent', '--app-accent-hover', '--app-accent-link', '--app-accent-muted',
      '--app-sidebar-from', '--app-sidebar-via', '--app-sidebar-to',
      '--app-accent-dark-bg', '--app-accent-dark-bg-soft', '--app-accent-dark-surface',
      '--app-accent-dark-row', '--app-accent-dark-btn', '--app-accent-dark-btn-hover',
      '--app-accent-dark-glow-1', '--app-accent-dark-glow-2',
    ];
    const root = this.document.documentElement;
    props.forEach(p => root.style.removeProperty(p));
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  private isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  }

  private getPreferredTheme(): ThemeMode {
    if (!isPlatformBrowser(this.platformId)) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private isThemeMode(value: string | null): value is ThemeMode {
    return value === 'light' || value === 'dark';
  }
}
