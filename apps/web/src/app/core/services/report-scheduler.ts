import { InjectionToken } from '@angular/core';
import { asyncScheduler, SchedulerLike } from 'rxjs';

export const REPORT_SCHEDULER = new InjectionToken<SchedulerLike>('REPORT_SCHEDULER', {
  providedIn: 'root',
  factory: () => asyncScheduler,
});
