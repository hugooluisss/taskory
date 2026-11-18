import { Injectable, inject } from '@angular/core';
import { ProjectsRepository } from '../repositories/projects.repository';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private repository = inject(ProjectsRepository);
  list() {
    return this.repository.list();
  }
  create(name: string) {
    return this.repository.create(name.trim());
  }
  rename(id: string, name: string) {
    return this.repository.update(id, { name: name.trim() });
  }
  archive(id: string, archived: boolean) {
    return this.repository.update(id, { archived });
  }
  remove(id: string) {
    return this.repository.delete(id);
  }
}
