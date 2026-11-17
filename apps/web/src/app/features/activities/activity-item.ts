import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Activity } from '../../core/models';
import { AppIconComponent } from '../../shared/app-icon';

@Component({
  selector: 'activities-item',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent],
  templateUrl: './activity-item.html',
})
export class ActivityItemComponent {
  @Input({ required: true }) activity!: Activity;
  @Output() edit = new EventEmitter<Activity>();
  @Output() remove = new EventEmitter<Activity>();
  readonly expanded = signal(false);
}
