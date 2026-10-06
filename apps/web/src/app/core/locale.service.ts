import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'en' | 'fr';

export const SUPPORTED_LANGS: readonly AppLang[] = ['en', 'fr'];
export const DEFAULT_LANG: AppLang = 'en';
export const LANG_STORAGE_KEY = 'td.lang';

const isAppLang = (value: unknown): value is AppLang =>
  typeof value === 'string' &&
  (SUPPORTED_LANGS as readonly string[]).includes(value);

/** Current UI language: persisted in localStorage, mirrored on `<html lang>` and in ngx-translate. */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  private readonly _lang = signal<AppLang>(this.readStoredLang());
  readonly lang = this._lang.asReadonly();

  constructor() {
    this.apply(this._lang());
  }

  setLang(lang: AppLang): void {
    if (lang === this._lang()) {
      return;
    }
    this._lang.set(lang);
    this.writeStoredLang(lang);
    this.apply(lang);
  }

  private apply(lang: AppLang): void {
    this.document.documentElement.lang = lang;
    this.translate.use(lang);
  }

  private readStoredLang(): AppLang {
    try {
      const stored =
        this.document.defaultView?.localStorage.getItem(LANG_STORAGE_KEY);
      return isAppLang(stored) ? stored : DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  }

  private writeStoredLang(lang: AppLang): void {
    try {
      this.document.defaultView?.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Storage may be unavailable (private mode, quota): the choice simply is not persisted.
    }
  }
}
