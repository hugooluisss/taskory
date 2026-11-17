import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { ApiKeysSectionComponent } from './api-keys-section';

describe('Settings', () => {
  it('disables creation for a blank name and shows a one-time key in a highlighted region', async () => {
    await TestBed.configureTestingModule({
      imports: [ApiKeysSectionComponent],
      providers: [{ provide: TranslocoService, useValue: { getActiveLang: () => 'en' } }],
    })
      .overrideComponent(ApiKeysSectionComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ApiKeysSectionComponent);
    fixture.componentInstance.newKey = 'tk_once';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.secret code').textContent).toContain('tk_once');
    expect(fixture.nativeElement.querySelector('#key-name')).toBeTruthy();
    const copy = vi.fn();
    fixture.componentInstance.copy.subscribe(copy);
    fixture.nativeElement.querySelector('.secret button').click();
    expect(copy).toHaveBeenCalledWith('tk_once');
  });
  it('formats API key dates in the active language after a live switch', async () => {
    let language = 'en';
    await TestBed.configureTestingModule({
      imports: [ApiKeysSectionComponent],
      providers: [{ provide: TranslocoService, useValue: { getActiveLang: () => language } }],
    })
      .overrideComponent(ApiKeysSectionComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ApiKeysSectionComponent);
    fixture.componentInstance.keys = [
      { id: 'k1', name: 'key', prefix: 'tk_', createdAt: '2026-01-01T12:00:00Z', lastUsedAt: null },
    ];
    fixture.detectChanges();
    const english = fixture.nativeElement.querySelector('li').textContent;
    language = 'es';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.componentInstance.locale).toBe('es');
    const spanish = fixture.nativeElement.querySelector('li').textContent;
    expect(english).toMatch(/Jan/);
    expect(spanish).toMatch(/ene/i);
  });
});
