import { Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Activity, ActivityFilters, Paginated } from '../../core/models';
import { ActivityFormValue, ActivitiesService } from '../../core/services/activities.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { AppPageHeaderComponent } from '../../shared/app-page-header';
import { AppPaginationComponent } from '../../shared/app-pagination';
import { ActivityFormDialogComponent } from './activity-form-dialog';
import { ActivityListComponent } from './activity-list';
import { ActivitiesFiltersBarComponent } from './activities-filters-bar';
import { ActivitiesQuickAddComponent } from './activities-quick-add';

const PAGE_LIMIT = 20;

@Component({
  selector: 'activities-page',
  standalone: true,
  imports: [
    TranslocoPipe,
    AppPageHeaderComponent,
    AppPaginationComponent,
    ActivityFormDialogComponent,
    ActivityListComponent,
    ActivitiesFiltersBarComponent,
    ActivitiesQuickAddComponent,
  ],
  providers: [provideTranslocoScope('activities')],
  templateUrl: './activities-page.html',
  styleUrl: './activities-page.css',
})
export class ActivitiesPage {
  private activities = inject(ActivitiesService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);
  @ViewChild(ActivitiesQuickAddComponent) private quickAdd!: ActivitiesQuickAddComponent;
  @ViewChild(ActivityFormDialogComponent) private formDialog!: ActivityFormDialogComponent;
  readonly items = signal<Activity[]>([]);
  readonly groups = signal(this.activities.groupByDay([]));
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');
  private requestId = 0;
  readonly filters = signal<ActivityFilters>({ limit: PAGE_LIMIT });
  readonly projects = signal<string[]>([]);
  readonly hasFilters = computed(() => {
    const filters = this.filters();
    return Boolean(filters.from || filters.to || filters.project || filters.tag || filters.q);
  });
  constructor() {
    this.activities.meta().subscribe({
      next: (meta) => this.projects.set(meta.projects),
      error: () => this.error.set('activities.loadError'),
    });
    this.load();
  }
  load(): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    this.activities
      .list({ ...this.filters(), page: this.page(), limit: PAGE_LIMIT })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: Paginated<Activity>) => {
          if (requestId !== this.requestId) return;
          this.items.set(result.items);
          this.total.set(result.total);
          this.pages.set(Math.max(1, Math.ceil(result.total / PAGE_LIMIT)));
          this.groups.set(this.activities.groupByDay(result.items));
          this.loading.set(false);
        },
        error: () => {
          if (requestId !== this.requestId) return;
          this.error.set('activities.loadError');
          this.loading.set(false);
        },
      });
  }
  applyFilters(raw: ActivityFilters): void {
    try {
      this.filters.set(this.activities.buildFilters(raw));
      this.page.set(1);
      this.load();
    } catch {
      this.error.set('activities.invalidRange');
    }
  }
  clearFilters(): void {
    this.filters.set({ limit: PAGE_LIMIT });
    this.page.set(1);
    this.load();
  }
  changePage(page: number): void {
    this.page.set(page);
    this.load();
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
  create(value: ActivityFormValue): void {
    const snapshot = {
      ...value,
      tags: [...(value.tags ?? [])],
      referenceUrls: [...(value.referenceUrls ?? [])],
    };
    this.quickAdd.pending.set(true);
    this.activities.create(value).subscribe({
      next: () => {
        this.quickAdd.clearIfUnchanged(snapshot);
        this.quickAdd.pending.set(false);
        this.toast.success(this.transloco.translate('activities.created'));
        this.load();
      },
      error: () => {
        this.quickAdd.pending.set(false);
        this.toast.error(this.transloco.translate('activities.saveError'));
      },
    });
  }
  edit(activity: Activity): void {
    this.formDialog.open(activity);
  }
  save(event: { id?: string; value: ActivityFormValue }): void {
    const request = event.id
      ? this.activities.update(event.id, event.value)
      : this.activities.create(event.value);
    request.subscribe({
      next: () => {
        this.formDialog.close();
        this.toast.success(this.transloco.translate('activities.saved'));
        this.load();
      },
      error: () => this.formDialog.saveFailed(),
    });
  }
  async remove(activity: Activity): Promise<void> {
    const accepted = await this.confirm.ask({
      title: this.transloco.translate('activities.confirmDeleteTitle'),
      message: this.transloco.translate('activities.confirmDeleteMessage', {
        title: activity.title,
      }),
      confirmLabel: this.transloco.translate('activities.delete'),
      cancelLabel: this.transloco.translate('activities.cancel'),
      danger: true,
    });
    if (!accepted) return;
    this.activities.remove(activity.id).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('activities.deleted'));
        this.load();
      },
      error: () => this.toast.error(this.transloco.translate('activities.deleteError')),
    });
  }
}
