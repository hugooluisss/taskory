import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextTextareaId = 0;
@Component({
  selector: 'app-textarea',
  standalone: true,
  templateUrl: './app-textarea.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppTextareaComponent),
      multi: true,
    },
  ],
})
export class AppTextareaComponent implements ControlValueAccessor {
  @Input() id = `app-textarea-${nextTextareaId++}`;
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() submitted = false;
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly touched = signal(false);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  get visibleError(): string {
    return this.touched() || this.submitted ? this.error : '';
  }
  get describedBy(): string | null {
    return this.hint || this.visibleError ? `${this.id}-help` : null;
  }
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
  updateValue(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
    this.onChange(this.value());
  }
  markTouched(): void {
    this.touched.set(true);
    this.onTouched();
  }
}
