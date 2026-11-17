import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ActivitiesFiltersBarComponent } from './activities-filters-bar';

describe('Activity management', () => {
  it('emits optional filters and can clear them', async () => {
    await TestBed.configureTestingModule({ imports: [ActivitiesFiltersBarComponent] })
      .overrideComponent(ActivitiesFiltersBarComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ActivitiesFiltersBarComponent);
    const component = fixture.componentInstance;
    const apply = vi.spyOn(component.apply, 'emit');
    const clear = vi.spyOn(component.clear, 'emit');
    fixture.detectChanges();
    component.from = '2026-11-01';
    component.submit();
    expect(apply).toHaveBeenCalledWith({ from: '2026-11-01', to: '', project: '', tag: '', q: '' });
    component.reset();
    expect(clear).toHaveBeenCalled();
  });
});
