import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReportsService } from '../../core/services/reports.service';
import { ReportsPage } from './reports-page';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Report listing', () => {
  it('loads a page of saved reports', () => {
    const reports = { list: vi.fn(() => of({ items: [], total: 0, page: 1, limit: 10 })) };
    TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: TranslocoService, useValue: {} },
        provideRouter([]),
      ],
    }).overrideComponent(ReportsPage, {
      remove: { imports: [TranslocoPipe] },
      add: { imports: [TestTranslocoPipe] },
    });
    const fixture = TestBed.createComponent(ReportsPage);
    expect(reports.list).toHaveBeenCalledWith(1);
    fixture.destroy();
  });
});
