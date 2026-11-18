import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReportRequest, Language, Project, ReportStyle, ReportStyles } from '../../core/models';
import { ReportsService } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';
import { AppButtonComponent } from '../../shared/app-button';
import { ProjectsService } from '../../core/services/projects.service';

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [FormsModule, TranslocoPipe, AppButtonComponent],
  templateUrl: './report-form.html',
})
export class ReportFormComponent {
  private reports = inject(ReportsService);
  private auth = inject(AuthService);
  private projectsService = inject(ProjectsService);
  @Output() generate = new EventEmitter<ReportRequest>();
  readonly presets = this.reports.presets();
  readonly projects = signal<Project[]>([]);
  readonly projectsLoaded = signal(false);
  readonly projectsUnavailable = signal(false);
  readonly from = signal(this.presets.thisWeek.from);
  readonly to = signal(this.presets.thisWeek.to);
  readonly selectedProjects = signal<string[]>([]);
  readonly language = signal<Language>(this.auth.user()?.language ?? 'en');
  readonly style = signal<ReportStyle>('summary');
  readonly reportStyles = signal<ReportStyles | null>(null);
  readonly customPrompt = signal('');
  readonly customPromptError = signal(false);
  readonly rangeError = signal(false);
  readonly projectError = signal(false);
  readonly loading = signal(false);
  constructor() {
    this.reports.getStyles().subscribe({
      next: (styles) => {
        this.reportStyles.set(styles);
        this.customPrompt.set(
          styles.customPrompt ?? this.promptFor('summary', this.language()) ?? '',
        );
      },
      error: () => this.reportStyles.set(null),
    });
    this.projectsService.list().subscribe({
      next: (projects) => {
        const available = projects.filter((project) => !project.archived);
        this.projects.set(available);
        this.selectedProjects.set(available.map((project) => project.id));
        this.projectsLoaded.set(true);
      },
      error: () => this.projectsUnavailable.set(true),
    });
  }
  selectPreset(name: keyof typeof this.presets): void {
    this.from.set(this.presets[name].from);
    this.to.set(this.presets[name].to);
    this.rangeError.set(false);
  }
  toggleProject(id: string): void {
    this.selectedProjects.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
    this.projectError.set(false);
  }
  submit(): void {
    if (this.style() === 'custom' && !this.customPrompt().trim()) {
      this.customPromptError.set(true);
      return;
    }
    this.customPromptError.set(false);
    try {
      this.reports.validateRange(this.from(), this.to());
    } catch {
      this.rangeError.set(true);
      return;
    }
    this.rangeError.set(false);
    if (this.projectsLoaded() && this.projects().length > 0 && !this.selectedProjects().length) {
      this.projectError.set(true);
      return;
    }
    this.projectError.set(false);
    this.loading.set(true);
    const selected = this.selectedProjects();
    this.generate.emit({
      from: this.from(),
      to: this.to(),
      projectIds:
        this.projects().length > 0 && selected.length === this.projects().length
          ? undefined
          : selected.length
            ? selected
            : undefined,
      language: this.language(),
      style: this.style(),
      ...(this.style() === 'custom' ? { customPrompt: this.customPrompt() } : {}),
    });
  }
  promptFor(style: ReportStyle, language = this.language()): string | undefined {
    if (style === 'custom') return undefined;
    return this.reportStyles()?.styles.find((item) => item.id === style)?.prompt[language];
  }
  updateCustomPrompt(event: Event): void {
    this.customPrompt.set((event.target as HTMLTextAreaElement).value);
    this.customPromptError.set(false);
  }
  finish(): void {
    this.loading.set(false);
  }
}
