import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Activity } from '../../core/models';
import { ActivityFormValue, ActivitiesService } from '../../core/services/activities.service';
import { AppChipsInputComponent } from '../../shared/app-chips-input';
import { AppTextareaComponent } from '../../shared/app-textarea';

@Component({
  selector: 'activities-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe, AppChipsInputComponent, AppTextareaComponent],
  templateUrl: './activity-form-dialog.html',
  styleUrl: './activity-form-dialog.css',
})
export class ActivityFormDialogComponent {
  private activities = inject(ActivitiesService);
  @Input() projects: string[] = [];
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @Output() saveActivity = new EventEmitter<{ id?: string; value: ActivityFormValue }>();
  form = new FormGroup({
    date: new FormControl('', { nonNullable: true, validators: Validators.required }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', { nonNullable: true }),
    project: new FormControl('', { nonNullable: true }),
    tags: new FormControl<string[]>([], { nonNullable: true }),
    referenceUrls: new FormControl<string[]>([], { nonNullable: true }),
  });
  currentId?: string;
  saving = false;
  submitted = false;
  error = '';
  private opener: HTMLElement | null = null;
  open(activity?: Activity): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.currentId = activity?.id;
    this.submitted = false;
    this.saving = false;
    this.error = '';
    this.form.reset({
      date: activity?.date ?? this.activities.todayLocal(),
      title: activity?.title ?? '',
      description: activity?.description ?? '',
      project: activity?.project ?? '',
      tags: activity?.tags ?? [],
      referenceUrls: activity?.referenceUrls ?? [],
    });
    this.dialog.nativeElement.showModal();
    queueMicrotask(() => this.dialog.nativeElement.querySelector<HTMLElement>('input')?.focus());
  }
  submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.error = '';
    this.saveActivity.emit({ id: this.currentId, value: this.form.getRawValue() });
  }
  saveFailed(): void {
    this.saving = false;
    this.error = 'saveError';
  }
  close(): void {
    this.dialog.nativeElement.close();
    this.saving = false;
    this.opener?.focus();
    this.opener = null;
  }
  get titleError(): string {
    const control = this.form.controls.title;
    if (!control.touched && !this.submitted) return '';
    return control.hasError('required')
      ? 'required'
      : control.hasError('maxlength')
        ? 'titleTooLong'
        : '';
  }
  get dateError(): string {
    const control = this.form.controls.date;
    return (control.touched || this.submitted) && control.hasError('required') ? 'required' : '';
  }
}
