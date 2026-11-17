import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConnectedApp } from '../../core/models';
import { AppSpinnerComponent } from '../../shared/app-spinner';
import { AppIconComponent } from '../../shared/app-icon';
import { AppEmptyStateComponent } from '../../shared/app-empty-state';
import '../../core/i18n/date-locales';

@Component({
  selector: 'app-connected-apps-section',
  standalone: true,
  imports: [
    DatePipe,
    NgFor,
    NgIf,
    TranslocoPipe,
    AppEmptyStateComponent,
    AppSpinnerComponent,
    AppIconComponent,
  ],
  templateUrl: './connected-apps-section.html',
})
export class ConnectedAppsSectionComponent {
  private transloco = inject(TranslocoService);
  get locale(): string {
    return this.transloco.getActiveLang();
  }
  @Input() apps: ConnectedApp[] = [];
  @Input() loading = false;
  @Output() disconnect = new EventEmitter<string>();
}
