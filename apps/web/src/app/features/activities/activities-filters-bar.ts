import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() projects: string[] = [];
  @Output() apply = new EventEmitter<ActivityFilters>();
  @Output() clear = new EventEmitter<void>();
  from = '';
  to = '';
  project = '';
  tag = '';
  q = '';
  expanded = false;
  submit(): void {
    this.apply.emit({
      from: this.from,
      to: this.to,
      project: this.project,
      tag: this.tag,
      q: this.q,
    });
  }
  reset(): void {
    this.from = '';
    this.to = '';
    this.project = '';
    this.tag = '';
    this.q = '';
    this.clear.emit();
  }
}
