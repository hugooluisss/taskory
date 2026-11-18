import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { HttpErrorResponse } from '@angular/common/http';
import { Project } from '../../core/models';
import { ProjectsService } from '../../core/services/projects.service';
import { AppIconComponent } from '../../shared/app-icon';
import { AppPageHeaderComponent } from '../../shared/app-page-header';

@Component({
  selector: 'projects-page',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent, AppPageHeaderComponent],
  templateUrl: './projects-page.html',
})
export class ProjectsPage {
  private projectsService = inject(ProjectsService);
  readonly projects = signal<Project[]>([]);
  readonly names = signal<Record<string, string>>({});
  readonly error = signal('');
  constructor() {
    this.load();
  }
  load(): void {
    this.projectsService.list().subscribe({ next: (items) => this.projects.set(items) });
  }
  rename(project: Project): void {
    const name = this.names()[project.id]?.trim();
    if (!name || name === project.name) return;
    this.projectsService.rename(project.id, name).subscribe({
      next: (updated) => {
        this.projects.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      },
      error: () => this.error.set('projects.saveError'),
    });
  }
  archive(project: Project): void {
    this.projectsService.archive(project.id, !project.archived).subscribe({
      next: (updated) =>
        this.projects.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        ),
      error: () => this.error.set('projects.saveError'),
    });
  }
  remove(project: Project): void {
    this.error.set('');
    this.projectsService.remove(project.id).subscribe({
      next: () => this.projects.update((items) => items.filter((item) => item.id !== project.id)),
      error: (error: HttpErrorResponse) =>
        this.error.set(
          error.status === 409 ? 'projects.deleteHasActivities' : 'projects.deleteError',
        ),
    });
  }
  setName(id: string, value: string): void {
    this.names.update((names) => ({ ...names, [id]: value }));
  }
  updateName(id: string, event: Event): void {
    this.setName(id, (event.target as HTMLInputElement).value);
  }
}
