import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { ConnectedAppsSectionComponent } from './connected-apps-section';
import { AppSpinnerComponent } from '../../shared/app-spinner';

describe('Connected apps', () => {
  it('offers an accessible empty state and emits the selected disconnect action', async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectedAppsSectionComponent, AppSpinnerComponent],
      providers: [{ provide: TranslocoService, useValue: { getActiveLang: () => 'en' } }],
    })
      .overrideComponent(ConnectedAppsSectionComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ConnectedAppsSectionComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    const withApp = TestBed.createComponent(ConnectedAppsSectionComponent);
    withApp.componentInstance.apps = [
      {
        id: 'app-1',
        clientName: 'Calendar',
        createdAt: '2026-01-01T00:00:00Z',
        lastUsedAt: '2026-01-02T00:00:00Z',
      },
    ];
    const disconnect = vi.fn();
    withApp.componentInstance.disconnect.subscribe(disconnect);
    withApp.detectChanges();
    expect(withApp.nativeElement.querySelector('li').textContent).not.toContain(
      'settings.lastUsedUnknown',
    );
    withApp.nativeElement.querySelector('li button').click();
    expect(disconnect).toHaveBeenCalledWith('app-1');
  });
  it('formats connected app dates in the active language after a live switch', async () => {
    let language = 'en';
    await TestBed.configureTestingModule({
      imports: [ConnectedAppsSectionComponent],
      providers: [{ provide: TranslocoService, useValue: { getActiveLang: () => language } }],
    })
      .overrideComponent(ConnectedAppsSectionComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ConnectedAppsSectionComponent);
    fixture.componentInstance.apps = [
      { id: 'app-1', clientName: 'Calendar', createdAt: '2026-01-01T12:00:00Z', lastUsedAt: null },
    ];
    fixture.detectChanges();
    const english = fixture.nativeElement.querySelector('li').textContent;
    language = 'es';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    const spanish = fixture.nativeElement.querySelector('li').textContent;
    expect(english).toMatch(/Jan/);
    expect(spanish).toMatch(/ene/i);
  });
});
