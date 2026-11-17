import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ActivitiesPage } from './activities-page';
import { ActivitiesQuickAddComponent } from './activities-quick-add';
import { ActivitiesFiltersBarComponent } from './activities-filters-bar';
import { ActivityListComponent } from './activity-list';
import { ActivityItemComponent } from './activity-item';
import { ActivityFormDialogComponent } from './activity-form-dialog';
import { AppPaginationComponent } from '../../shared/app-pagination';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { Activity } from '../../core/models';

describe('Activity management', () => {
  it('Create with several URLs', async () => {
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
      ActivitiesQuickAddComponent,
      ActivitiesFiltersBarComponent,
      ActivityListComponent,
      ActivityItemComponent,
      ActivityFormDialogComponent,
      AppPaginationComponent,
    ]) {
      TestBed.overrideComponent(component, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      });
    }
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(ActivitiesPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/activities/meta').flush({ projects: [], tags: [] });
    http
      .expectOne('/api/v1/activities?page=1&limit=20')
      .flush({ items: [], total: 0, page: 1, limit: 20 });
    const quickAdd = fixture.debugElement.query(By.directive(ActivitiesQuickAddComponent))
      .componentInstance as ActivitiesQuickAddComponent;
    const urls = ['https://one.test', 'https://two.test', 'https://three.test'];
    quickAdd.title.set('Three links');
    quickAdd.referenceUrls.set(urls);
    quickAdd.submit();
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
    expect(fixture.nativeElement.querySelector('activities-list .skeleton')).toBeTruthy();
    expect(
      (
        fixture.nativeElement.querySelector(
          'activities-quick-add button[type="submit"]',
        ) as HTMLButtonElement
      ).hasAttribute('disabled'),
    ).toBe(true);
    quickAdd.title.set('Newer draft');
    post.flush(created);
    expect(quickAdd.title()).toBe('Newer draft');
    await fixture.whenStable();
    expect(
      (
        fixture.nativeElement.querySelector(
          'activities-quick-add button[type="submit"]',
        ) as HTMLButtonElement
      ).hasAttribute('disabled'),
    ).toBe(false);
    http
      .expectOne('/api/v1/activities?page=1&limit=20')
      .flush({ items: [created], total: 1, page: 1, limit: 20 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('activities-item h3').textContent).toContain(
      'Three links',
    );
    expect(fixture.nativeElement.querySelector('activities-list .skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('activities-item a')).toHaveLength(3);
    fixture.componentInstance.load();
    http
      .expectOne('/api/v1/activities?page=1&limit=20')
      .flush(
        { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Failed' },
        { status: 500, statusText: 'Server Error' },
      );
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'activities.loadError',
    );
    http.verify();
    fixture.destroy();
  });
});
