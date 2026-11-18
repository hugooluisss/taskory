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
      createdAt: '',
      updatedAt: '',
    });
    expect(fixture.componentInstance.error()).toBe('projects.deleteHasActivities');
  });
});
