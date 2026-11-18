import { Component, EventEmitter, Output, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Project } from '../core/models';
import { ProjectsService } from '../core/services/projects.service';
import { AppIconComponent } from './app-icon';

@Component({
  selector: 'app-project-selector',
  standalone: true,
  imports: [FormsModule, TranslocoPipe, AppIconComponent],
  templateUrl: './project-selector.html',
})
export class ProjectSelectorComponent {
  private projectsService = inject(ProjectsService, { optional: true });
  readonly projects = input<Project[]>([]);
  readonly selectedIds = input<string[]>([]);
  readonly label = input('projects.selector.label');
  @Output() selectedIdsChange = new EventEmitter<string[]>();
  readonly creating = signal(false);
  readonly newName = signal('');
  readonly error = signal('');
  readonly createdProjects = signal<Project[]>([]);
  allProjects(): Project[] {
    return [...this.projects(), ...this.createdProjects()];
  }
  toggle(id: string, event: Event) {
    const ids = this.selectedIds();
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIdsChange.emit(
      checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id),
    );
  }
  create(): void {
    const name = this.newName().trim();
    if (!name || name.length > 100) return;
    this.error.set('');
    this.projectsService!.create(name).subscribe({
      next: (project) => {
        this.createdProjects.update((items) => [...items, project]);
        this.selectedIdsChange.emit([...new Set([...this.selectedIds(), project.id])]);
        this.creating.set(false);
        this.newName.set('');
      },
      error: () => this.error.set('projects.createError'),
    });
  }
}
