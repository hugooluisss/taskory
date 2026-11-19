import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService } from '../../core/services/reports.service';
import { SharedReport } from '../../core/models';
import { ApiError } from '../../core/api-error';
@Component({
  selector: 'app-shared-report-page',
  standalone: true,
  imports: [TranslocoPipe],
  providers: [
    provideTranslocoScope({
      scope: 'reports',
      loader: {
        en: () => fetch('assets/i18n/reports/en.json').then((r) => r.json()),
        es: () => fetch('assets/i18n/reports/es.json').then((r) => r.json()),
      },
    }),
  ],
  templateUrl: './shared-report-page.html',
})
export class SharedReportPage {
  private reports = inject(ReportsService);
  private route = inject(ActivatedRoute);
  private i18n = inject(TranslocoService);
  private title = inject(Title);
  private meta = inject(Meta);
  readonly data = signal<SharedReport | null>(null);
  readonly state = signal('loading');
  constructor() {
    this.meta.addTag({ name: 'robots', content: 'noindex,nofollow' });
    this.title.setTitle('Shared report | Taskory');
    this.reports.shared(this.route.snapshot.paramMap.get('token')!).subscribe({
      next: (d) => {
        this.data.set(d);
        this.i18n.setActiveLang(d.language);
        document.documentElement.lang = d.language;
        this.state.set('ready');
        this.title.setTitle(`${d.period.from} – ${d.period.to} | Taskory`);
      },
      error: (e) =>
        this.state.set(e instanceof ApiError && e.status === 410 ? 'expired' : 'unknown'),
    });
  }
}
