import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { InactivityService } from './core/auth/inactivity.service';
import { authInterceptor, retryInterceptor } from './core/auth/interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // auth first (outermost) so a 401 is seen after retries settle.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, retryInterceptor])),
    provideAppInitializer(() => {
      inject(AuthService).restore();
      inject(InactivityService);
    }),
  ],
};
