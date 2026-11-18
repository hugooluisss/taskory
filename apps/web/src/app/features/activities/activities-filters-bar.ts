import { Component, EventEmitter, Output, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivityFilters } from '../../core/models';
import { AppIconComponent } from '../../shared/app-icon';
import { ProjectSelectorComponent } from '../../shared/project-selector';
import { Project } from '../../core/models';

@Component({
  selector: 'activities-filters-bar',
  standalone: true,
  imports: [FormsModule, TranslocoPipe, AppIconComponent, ProjectSelectorComponent],
  templateUrl: './activities-filters-bar.html',
})
export class ActivitiesFiltersBarComponent {
  readonly projects = input<Project[]>([]);
  @Output() apply = new EventEmitter<ActivityFilters>();
  @Output() clear = new EventEmitter<void>();
  readonly from = signal('');
  readonly to = signal('');
  readonly projectIds = signal<string[]>([]);
  readonly tag = signal('');
  readonly q = signal('');
  readonly expanded = signal(false);
  readonly activeCount = computed(
    () =>
      [
        this.from(),
        this.to(),
        this.projectIds().length ? 'projects' : '',
        this.tag(),
        this.q(),
      ].filter(Boolean).length,
  );
  submit(): void {
    this.apply.emit({
      from: this.from(),
      to: this.to(),
      projectIds: this.projectIds(),
      tag: this.tag(),
      q: this.q(),
    });
  }
  reset(): void {
    this.from.set('');
    this.to.set('');
    this.projectIds.set([]);
    this.tag.set('');
    this.q.set('');
    this.clear.emit();
  }
}
