import { Component, EventEmitter, Output, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Activity } from '../../core/models';
import { ActivityDayGroup } from '../../core/services/activities.service';
import { AppEmptyStateComponent } from '../../shared/app-empty-state';
import { AppSpinnerComponent } from '../../shared/app-spinner';
import { ActivityItemComponent } from './activity-item';

@Component({
  selector: 'activities-list',
  standalone: true,
  imports: [TranslocoPipe, AppEmptyStateComponent, ActivityItemComponent, AppSpinnerComponent],
  templateUrl: './activity-list.html',
})
export class ActivityListComponent {
  private transloco = inject(TranslocoService);
  readonly groups = input<ActivityDayGroup[]>([]);
  readonly loading = input(false);
  readonly hasFilters = input(false);
  readonly totalCount = input(0);
  @Output() edit = new EventEmitter<Activity>();
  @Output() remove = new EventEmitter<Activity>();
  formatDate(date: string): string {
    const value = new Date(`${date}T00:00:00Z`);
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(value);
  }
}
