import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectsRepository } from '../repositories/projects.repository';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  it('trims names and delegates catalog mutations', () => {
    const repository = {
      list: vi.fn(() => of([])),
      create: vi.fn(() => of({})),
      update: vi.fn(() => of({})),
      delete: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [ProjectsService, { provide: ProjectsRepository, useValue: repository }],
    });
    const service = TestBed.inject(ProjectsService);
    service.list().subscribe();
    service.create(' Apollo ').subscribe();
    service.create(' New ', ' Context ').subscribe();
    service.rename('p1', ' New name ').subscribe();
    service.archive('p1', true).subscribe();
    service.describe('p1', ' Context ').subscribe();
    service.remove('p1').subscribe();
    expect(repository.create).toHaveBeenCalledWith('Apollo', undefined);
    expect(repository.create).toHaveBeenCalledWith('New', 'Context');
    expect(repository.update).toHaveBeenNthCalledWith(1, 'p1', { name: 'New name' });
    expect(repository.update).toHaveBeenNthCalledWith(2, 'p1', { archived: true });
    expect(repository.update).toHaveBeenNthCalledWith(3, 'p1', { description: 'Context' });
    expect(repository.delete).toHaveBeenCalledWith('p1');
  });
});
