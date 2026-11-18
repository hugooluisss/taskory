import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivitiesService } from '../../core/services/activities.service';
import { AppChipsInputComponent } from '../../shared/app-chips-input';
import { ProjectSelectorComponent } from '../../shared/project-selector';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ActivityFormDialogComponent } from './activity-form-dialog';

describe('Activity management', () => {
  it('Save error', async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityFormDialogComponent],
      providers: [
        {
          provide: ActivitiesService,
          useValue: { todayLocal: () => '2026-11-17', meta: () => of({ projects: [] }) },
        },
      ],
    })
      .overrideComponent(ProjectSelectorComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(ActivityFormDialogComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const fixture = TestBed.createComponent(ActivityFormDialogComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    const component = fixture.componentInstance;
    component.open();
    component.form.controls.title.setValue('Keep my edits');
    component.submit();
    component.saveFailed();
    fixture.detectChanges();
    expect(component.form.controls.title.value).toBe('Keep my edits');
    expect(fixture.nativeElement.textContent).toContain('saveError');
    component.close();
    expect(dialog.close).toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
