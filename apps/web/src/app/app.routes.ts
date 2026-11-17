import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

const placeholder = () =>
  import('./features/placeholders/placeholder-page').then((module) => module.PlaceholderPage);

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((module) => module.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-page').then((module) => module.RegisterPage),
  },
  {
    path: 'activities',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/activities/activities-page').then((module) => module.ActivitiesPage),
    data: { title: 'nav.activities' },
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reports-page').then((module) => module.ReportsPage),
    data: { title: 'nav.reports' },
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings-page').then((module) => module.SettingsPage),
    data: { title: 'nav.settings' },
  },
  {
    path: 'oauth/consent',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/consent/consent-page').then((module) => module.ConsentPage),
    data: { title: 'nav.consent' },
  },
  { path: '', pathMatch: 'full', redirectTo: 'activities' },
  { path: '**', redirectTo: 'activities' },
];
