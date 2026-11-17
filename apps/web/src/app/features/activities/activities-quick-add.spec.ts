import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivitiesService } from '../../core/services/activities.service';
import { AppChipsInputComponent } from '../../shared/app-chips-input';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ActivitiesQuickAddComponent } from './activities-quick-add';

describe('Activity management', () => {
  it('Quick-add Enter flow uses the local-today default and a visible label', async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesQuickAddComponent],
      providers: [
        {
          provide: ActivitiesService,
          useValue: { todayLocal: () => '2026-11-17', meta: () => of({ projects: [] }) },
        },
      ],
    })
      .overrideComponent(ActivitiesQuickAddComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ActivitiesQuickAddComponent);
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.createActivity, 'emit');
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('#quick-title') as HTMLInputElement;
    expect(component.date).toBe('2026-11-17');
    expect(fixture.nativeElement.querySelector('label[for="quick-title"]')).toBeTruthy();
    component.title = 'Ship the page';
    title.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ship the page', date: '2026-11-17' }),
    );
  });
  it('ignores Enter while a create is pending', async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesQuickAddComponent],
      providers: [{ provide: ActivitiesService, useValue: { todayLocal: () => '2026-11-17' } }],
    })
      .overrideComponent(ActivitiesQuickAddComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ActivitiesQuickAddComponent);
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.createActivity, 'emit');
    component.title = 'Pending';
    component.pending = true;
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('#quick-title') as HTMLInputElement;
    title.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(emit).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });
});
