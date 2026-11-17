import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
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
    quickAdd.title = 'Three links';
    quickAdd.referenceUrls = urls;
    quickAdd.submit();
    fixture.detectChanges();
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
    quickAdd.title = 'Newer draft';
    post.flush(created);
    expect(quickAdd.title).toBe('Newer draft');
    http
      .expectOne('/api/v1/activities?page=1&limit=20')
      .flush({ items: [created], total: 1, page: 1, limit: 20 });
    await fixture.whenStable();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.nativeElement.querySelector('activities-item h3').textContent).toContain(
      'Three links',
    );
    expect(fixture.nativeElement.querySelectorAll('activities-item a')).toHaveLength(3);
    http.verify();
    fixture.destroy();
  });
});
