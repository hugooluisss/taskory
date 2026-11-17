import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import rootEn from '../../../../public/assets/i18n/en.json';
import rootEs from '../../../../public/assets/i18n/es.json';
import activitiesEn from '../../../../public/assets/i18n/activities/en.json';
import activitiesEs from '../../../../public/assets/i18n/activities/es.json';
import { ActivitiesService } from '../../core/services/activities.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { ActivitiesPage } from './activities-page';

describe('Activity management', () => {
  it('renders the activity page in English and Spanish', async () => {
    await TestBed.configureTestingModule({
      imports: [
        ActivitiesPage,
        TranslocoTestingModule.forRoot({
          langs: {
            en: rootEn,
            es: rootEs,
            'activities/en': activitiesEn,
            'activities/es': activitiesEs,
          },
          translocoConfig: {
            availableLangs: ['en', 'es'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            scopes: { autoPrefixKeys: false },
          },
        }),
      ],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivitiesService,
          useValue: {
            todayLocal: () => '2026-11-17',
            meta: () => of({ projects: [], tags: [] }),
            list: () => of({ items: [], total: 0, page: 1, limit: 20 }),
            groupByDay: () => [],
            buildFilters: (filters: unknown) => filters,
          },
        },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActivitiesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-page-header h1').textContent).toContain(
      'Activities',
    );
    expect(fixture.nativeElement.querySelector('.visually-hidden').textContent).toContain(
      '0 activities',
    );

    TestBed.inject(TranslocoService).setActiveLang('es');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-page-header h1').textContent).toContain(
      'Actividades',
    );
    expect(fixture.nativeElement.querySelector('.visually-hidden').textContent).toContain(
      '0 actividades',
    );
    fixture.destroy();
  });
});
