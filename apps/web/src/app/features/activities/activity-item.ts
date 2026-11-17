import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Activity } from '../../core/models';

@Component({
  selector: 'activities-item',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './activity-item.html',
  styleUrl: './activity-item.css',
})
export class ActivityItemComponent {
  @Input({ required: true }) activity!: Activity;
  @Output() edit = new EventEmitter<Activity>();
  @Output() remove = new EventEmitter<Activity>();
  readonly expanded = signal(false);
}
