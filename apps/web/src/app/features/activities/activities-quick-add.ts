import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
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
  title = '';
  date = this.activities.todayLocal();
  description = '';
  project = '';
  tags: string[] = [];
  referenceUrls: string[] = [];
  expanded = false;
  pending = false;
  submit(): void {
    if (!this.title.trim() || this.pending) return;
    this.createActivity.emit({
      title: this.title,
      date: this.date,
      description: this.description,
      project: this.project,
      tags: this.tags,
      referenceUrls: this.referenceUrls,
    });
  }
  clearIfUnchanged(snapshot: ActivityFormValue): void {
    if (
      this.title === snapshot.title &&
      this.date === snapshot.date &&
      this.description === snapshot.description &&
      this.project === snapshot.project &&
      JSON.stringify(this.tags) === JSON.stringify(snapshot.tags) &&
      JSON.stringify(this.referenceUrls) === JSON.stringify(snapshot.referenceUrls)
    )
      this.reset();
  }
  reset(): void {
    this.title = '';
    this.description = '';
    this.project = '';
    this.tags = [];
    this.referenceUrls = [];
    this.expanded = false;
    this.date = this.activities.todayLocal();
  }
}
