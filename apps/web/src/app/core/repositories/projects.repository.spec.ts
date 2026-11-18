import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectsRepository } from './projects.repository';

describe('ProjectsRepository', () => {
  let http: HttpTestingController;
  let repository: ProjectsRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(ProjectsRepository);
  });
  afterEach(() => http.verify());
  it('lists, creates, updates, and deletes projects through the API', () => {
    repository.list().subscribe();
    http.expectOne('/api/v1/projects').flush([]);
    repository.create('Apollo').subscribe();
    const create = http.expectOne('/api/v1/projects');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Apollo' });
    create.flush({ id: 'p1', name: 'Apollo' });
    repository.update('p1', { archived: true }).subscribe();
    const update = http.expectOne('/api/v1/projects/p1');
    expect(update.request.method).toBe('PATCH');
    update.flush({ id: 'p1', archived: true });
    repository.delete('p1').subscribe();
    const remove = http.expectOne('/api/v1/projects/p1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
