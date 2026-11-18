import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ProjectsService } from '../core/services/projects.service';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ProjectSelectorComponent } from './project-selector';

describe('Project selector', () => {
  it('creates and selects a new project', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSelectorComponent],
      providers: [
        {
          provide: ProjectsService,
          useValue: { create: vi.fn(() => of({ id: 'p2', name: 'New', archived: false })) },
        },
      ],
    })
      .overrideComponent(ProjectSelectorComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProjectSelectorComponent);
    fixture.componentRef.setInput('selectedIds', ['p1']);
    const selected = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(selected);
    fixture.componentInstance.newName.set(' New ');
    fixture.componentInstance.create();
    expect(selected).toHaveBeenCalledWith(['p1', 'p2']);
    expect(fixture.componentInstance.allProjects()).toHaveLength(1);
  });
});
