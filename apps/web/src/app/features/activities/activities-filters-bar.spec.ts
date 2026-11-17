import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ActivitiesFiltersBarComponent } from './activities-filters-bar';

describe('Activity filters', () => {
  it('Expand and collapse additional filters', async () => {
    await TestBed.configureTestingModule({ imports: [ActivitiesFiltersBarComponent] })
      .overrideComponent(ActivitiesFiltersBarComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ActivitiesFiltersBarComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector(
      '[aria-controls="activity-extra-filters"]',
    ) as HTMLButtonElement;
    const extra = fixture.nativeElement.querySelector('#activity-extra-filters') as HTMLDivElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(extra.classList.contains('hidden')).toBe(true);
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(extra.classList.contains('hidden')).toBe(false);
  });

  it('Clear active filters', async () => {
    await TestBed.configureTestingModule({ imports: [ActivitiesFiltersBarComponent] })
      .overrideComponent(ActivitiesFiltersBarComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ActivitiesFiltersBarComponent);
    const component = fixture.componentInstance;
    const clear = vi.fn();
    component.clear.subscribe(clear);
    fixture.detectChanges();
    component.q.set('planning');
    fixture.detectChanges();
    expect(component.activeCount()).toBe(1);
    component.reset();
    expect(component.activeCount()).toBe(0);
    expect(clear).toHaveBeenCalled();
  });
});
