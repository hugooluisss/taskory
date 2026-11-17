import { NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { ErrorMessageService } from '../../core/services/error-message.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher';
import { LocalPathService } from '../../core/services/local-path.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [NgIf, RouterLink, ReactiveFormsModule, TranslocoPipe, LanguageSwitcherComponent],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errors = inject(ErrorMessageService);
  private localPath = inject(LocalPathService);
  get returnUrl(): string {
    return this.localPath.normalize(this.route.snapshot.queryParamMap.get('returnUrl'));
  }
  readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  readonly loading = signal(false);
  readonly errorKey = signal('');
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    try {
      await this.auth.register(
        this.form.value.email!,
        this.form.value.password!,
        this.form.value.name!,
      );
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.errorKey.set(this.errors.key((error as { code?: string }).code));
    } finally {
      this.loading.set(false);
    }
  }
}
