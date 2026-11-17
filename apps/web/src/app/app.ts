import { NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/services/auth.service';
import { ConfirmDialogComponent } from './shared/confirm-dialog';
import { LanguageSwitcherComponent } from './shared/language-switcher';
import { ToastComponent } from './shared/toast';
import { AppIconComponent } from './shared/app-icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NgIf,
    RouterOutlet,
    RouterLink,
    TranslocoPipe,
    LanguageSwitcherComponent,
    ConfirmDialogComponent,
    ToastComponent,
    AppIconComponent,
  ],
  templateUrl: './app.html',
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);
  readonly mobileNavOpen = signal(false);
  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
