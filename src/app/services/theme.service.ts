import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'mi-cartera-theme';
  private readonly themeSubject = new BehaviorSubject<ThemeMode>('light');
  readonly theme$ = this.themeSubject.asObservable();

  private initialized = false;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  initTheme(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const savedTheme = window.localStorage.getItem(this.storageKey);
    const theme = this.isThemeMode(savedTheme)
      ? savedTheme
      : this.getPreferredTheme();

    this.applyTheme(theme);
    this.initialized = true;
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

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;

    root.classList.toggle('dark-theme', theme === 'dark');
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    this.themeSubject.next(theme);
  }

  private getPreferredTheme(): ThemeMode {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  private isThemeMode(value: string | null): value is ThemeMode {
    return value === 'light' || value === 'dark';
  }
}
