import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TdPreset } from './core/theme';
import { providePrimeNG } from 'primeng/config';
import { PRIMEUI_LICENSE } from '../environments/license';
import { appRoutes } from './app.routes';
import { DEFAULT_LANG, LocaleService } from './core/locale.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: DEFAULT_LANG,
    }),
    // Instantiating the service selects the persisted language and sets <html lang>.
    provideAppInitializer(() => {
      inject(LocaleService);
    }),
    providePrimeNG({
      theme: { preset: TdPreset, options: { darkModeSelector: '.td-dark' } },
      license: PRIMEUI_LICENSE,
    }),
  ],
};
