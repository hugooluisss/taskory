import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslocoService } from '@jsverse/transloco';
import { AppEmptyStateComponent } from '../../shared/app-empty-state';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ActivityListComponent } from './activity-list';
import { ActivityItemComponent } from './activity-item';
import { AppSpinnerComponent } from '../../shared/app-spinner';

describe('Activity management', () => {
  it('Empty states, loading state, and live result announcements', async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityListComponent],
      providers: [{ provide: TranslocoService, useValue: { getActiveLang: () => 'en' } }],
    })
      .overrideComponent(ActivityListComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(AppEmptyStateComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(AppSpinnerComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(ActivityItemComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const loadingFixture = TestBed.createComponent(ActivityListComponent);
    loadingFixture.componentRef.setInput('loading', true);
    loadingFixture.detectChanges();
    expect(loadingFixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    loadingFixture.destroy();
    const emptyFixture = TestBed.createComponent(ActivityListComponent);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    emptyFixture.destroy();
    const filteredFixture = TestBed.createComponent(ActivityListComponent);
    filteredFixture.componentRef.setInput('hasFilters', true);
    filteredFixture.detectChanges();
    expect(filteredFixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(filteredFixture.nativeElement.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
