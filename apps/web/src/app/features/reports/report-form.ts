import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReportRequest, ProviderInfo, Language } from '../../core/models';
import { ReportsService } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';
import { ActivitiesService } from '../../core/services/activities.service';
import { AppButtonComponent } from '../../shared/app-button';
import { AppIconComponent } from '../../shared/app-icon';

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [FormsModule, TranslocoPipe, AppButtonComponent, AppIconComponent],
  templateUrl: './report-form.html',
})
export class ReportFormComponent {
  private reports = inject(ReportsService);
  private auth = inject(AuthService);
  private activities = inject(ActivitiesService);
  @Output() generate = new EventEmitter<ReportRequest>();
  readonly presets = this.reports.presets();
  readonly providers = signal<ProviderInfo[]>([]);
  readonly projects = signal<string[]>([]);
  readonly projectsUnavailable = signal(false);
  readonly providersUnavailable = signal(false);
  readonly from = signal(this.presets.thisWeek.from);
  readonly to = signal(this.presets.thisWeek.to);
  readonly project = signal('');
  readonly language = signal<Language>(this.auth.user()?.language ?? 'en');
  readonly style = signal<'summary' | 'detailed'>('summary');
  readonly provider = signal('');
  readonly model = signal('');
  readonly rangeError = signal(false);
  readonly loading = signal(false);
  readonly advanced = signal(false);
  constructor() {
    this.reports.providers().subscribe({
      next: (items) => this.providers.set(items),
      error: () => this.providersUnavailable.set(true),
    });
    this.activities.meta().subscribe({
      next: (meta) => this.projects.set(meta.projects),
      error: () => this.projectsUnavailable.set(true),
    });
  }
  selectPreset(name: keyof typeof this.presets): void {
    this.from.set(this.presets[name].from);
    this.to.set(this.presets[name].to);
    this.rangeError.set(false);
  }
  submit(): void {
    try {
      this.reports.validateRange(this.from(), this.to());
    } catch {
      this.rangeError.set(true);
      return;
    }
    this.rangeError.set(false);
    this.loading.set(true);
    this.generate.emit({
      from: this.from(),
      to: this.to(),
      project: this.project().trim() || undefined,
      language: this.language(),
      style: this.style(),
      provider: this.provider() || undefined,
      model: this.model().trim() || undefined,
    });
  }
  finish(): void {
    this.loading.set(false);
  }
}
