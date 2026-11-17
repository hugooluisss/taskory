import { Component, EventEmitter, Output, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivityFilters } from '../../core/models';

@Component({
  selector: 'activities-filters-bar',
  standalone: true,
  imports: [FormsModule, TranslocoPipe],
  templateUrl: './activities-filters-bar.html',
  styleUrl: './activities-filters-bar.css',
})
export class ActivitiesFiltersBarComponent {
  readonly projects = input<string[]>([]);
  @Output() apply = new EventEmitter<ActivityFilters>();
  @Output() clear = new EventEmitter<void>();
  readonly from = signal('');
  readonly to = signal('');
  readonly project = signal('');
  readonly tag = signal('');
  readonly q = signal('');
  readonly expanded = signal(false);
  submit(): void {
    this.apply.emit({
      from: this.from(),
      to: this.to(),
      project: this.project(),
      tag: this.tag(),
      q: this.q(),
    });
  }
  reset(): void {
    this.from.set('');
    this.to.set('');
    this.project.set('');
    this.tag.set('');
    this.q.set('');
    this.clear.emit();
  }
}
