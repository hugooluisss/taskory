import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Activity } from '../../core/models';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { AppChipsInputComponent } from '../../shared/app-chips-input';
import { AppTextareaComponent } from '../../shared/app-textarea';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ActivitiesPage } from './activities-page';
import { ActivitiesFiltersBarComponent } from './activities-filters-bar';
import { ActivityListComponent } from './activity-list';
import { ActivityItemComponent } from './activity-item';
import { ActivityFormDialogComponent } from './activity-form-dialog';
import { AppPaginationComponent } from '../../shared/app-pagination';
import { AppSpinnerComponent } from '../../shared/app-spinner';

describe('Activity management', () => {
  it('Create with three reference URLs', async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesPage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TranslocoService,
          useValue: { translate: (key: string) => key, getActiveLang: () => 'en' },
        },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    for (const component of [
      ActivitiesPage,
      ActivitiesFiltersBarComponent,
      ActivityListComponent,
      ActivityItemComponent,
      ActivityFormDialogComponent,
      AppPaginationComponent,
      AppSpinnerComponent,
    ]) {
      TestBed.overrideComponent(component, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      });
    }
    TestBed.overrideComponent(AppChipsInputComponent, {
      remove: { imports: [TranslocoPipe] },
      add: { imports: [TestTranslocoPipe] },
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(ActivitiesPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/activities/meta').flush({ projects: [], tags: [] });
    http
      .expectOne('/api/v1/activities?page=1&limit=20')
      .flush({ items: [], total: 0, page: 1, limit: 20 });
    const dialog = fixture.nativeElement.querySelector(
      'activities-form-dialog dialog',
    ) as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    (fixture.nativeElement.querySelector('app-page-header button') as HTMLButtonElement).click();
    expect(dialog.showModal).toHaveBeenCalled();
    const form = fixture.nativeElement.querySelector(
      'activities-form-dialog form',
    ) as HTMLFormElement;
    const dialogComponent = fixture.debugElement.query(By.directive(ActivityFormDialogComponent))
      .componentInstance as ActivityFormDialogComponent;
    const urls = ['https://one.test', 'https://two.test', 'https://three.test'];
    dialogComponent.form.setValue({
      date: '2026-11-17',
      title: 'Three links',
      description: '',
      project: '',
      tags: [],
      referenceUrls: urls,
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const created: Activity = {
      id: 'new',
      date: '2026-11-17',
      title: 'Three links',
      description: null,
      project: null,
      tags: [],
      referenceUrls: urls,
      createdAt: '',
      updatedAt: '',
    };
    const post = http.expectOne('/api/v1/activities');
    expect(post.request.body.referenceUrls).toEqual(urls);
    post.flush(created);
    await fixture.whenStable();
    http
      .expectOne('/api/v1/activities?page=1&limit=20')
      .flush({ items: [created], total: 1, page: 1, limit: 20 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('activities-item h3').textContent).toContain(
      'Three links',
    );
    expect(fixture.nativeElement.querySelectorAll('activities-item a')).toHaveLength(3);
    http.verify();
    fixture.destroy();
  });
});
