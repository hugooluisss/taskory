import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ProjectsService } from '../../core/services/projects.service';
import { TestTranslocoPipe } from '../../shared/test-transloco.pipe';
import { ProjectsPage } from './projects-page';

describe('Project management', () => {
  it('reports the API conflict when deleting a project with activities', async () => {
    const service = {
      list: () => of([]),
      remove: () => throwError(() => new HttpErrorResponse({ status: 409 })),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectsPage],
      providers: [{ provide: ProjectsService, useValue: service }],
    })
      .overrideComponent(ProjectsPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.componentInstance.remove({
      id: 'p1',
      name: 'Apollo',
      archived: false,
      description: null,
      createdAt: '',
      updatedAt: '',
    });
    expect(fixture.componentInstance.error()).toBe('projects.deleteHasActivities');
  });

  it('saves an edited description', async () => {
    const project = {
      id: 'p1',
      name: 'Apollo',
      description: null,
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const service = {
      list: () => of([project]),
      describe: vi.fn(() => of({ ...project, description: 'Context' })),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectsPage],
      providers: [{ provide: ProjectsService, useValue: service }],
    })
      .overrideComponent(ProjectsPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProjectsPage);
    fixture.componentInstance.descriptions.set({ p1: 'Context' });
    fixture.componentInstance.describe(project);
    expect(service.describe).toHaveBeenCalledWith('p1', 'Context');
    expect(fixture.componentInstance.projects()[0].description).toBe('Context');
  });
});
