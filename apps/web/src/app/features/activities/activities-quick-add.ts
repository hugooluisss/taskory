import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivityFormValue } from '../../core/services/activities.service';
import { ActivitiesService } from '../../core/services/activities.service';
import { AppChipsInputComponent } from '../../shared/app-chips-input';
import { AppTextareaComponent } from '../../shared/app-textarea';

@Component({
  selector: 'activities-quick-add',
  standalone: true,
  imports: [FormsModule, TranslocoPipe, AppChipsInputComponent, AppTextareaComponent],
  templateUrl: './activities-quick-add.html',
  styleUrl: './activities-quick-add.css',
})
export class ActivitiesQuickAddComponent {
  private activities = inject(ActivitiesService);
  @Input() projects: string[] = [];
  @Output() createActivity = new EventEmitter<ActivityFormValue>();
  readonly title = signal('');
  readonly date = signal(this.activities.todayLocal());
  readonly description = signal('');
  readonly project = signal('');
  readonly tags = signal<string[]>([]);
  readonly referenceUrls = signal<string[]>([]);
  readonly expanded = signal(false);
  readonly pending = signal(false);
  submit(): void {
    if (!this.title().trim() || this.pending()) return;
    this.createActivity.emit({
      title: this.title(),
      date: this.date(),
      description: this.description(),
      project: this.project(),
      tags: this.tags(),
      referenceUrls: this.referenceUrls(),
    });
  }
  clearIfUnchanged(snapshot: ActivityFormValue): void {
    if (
      this.title() === snapshot.title &&
      this.date() === snapshot.date &&
      this.description() === snapshot.description &&
      this.project() === snapshot.project &&
      JSON.stringify(this.tags()) === JSON.stringify(snapshot.tags) &&
      JSON.stringify(this.referenceUrls()) === JSON.stringify(snapshot.referenceUrls)
    )
      this.reset();
  }
  reset(): void {
    this.title.set('');
    this.description.set('');
    this.project.set('');
    this.tags.set([]);
    this.referenceUrls.set([]);
    this.expanded.set(false);
    this.date.set(this.activities.todayLocal());
  }
}
