import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextFieldId = 0;
@Component({
  selector: 'app-field',
  standalone: true,
  templateUrl: './app-field.html',
  styleUrl: './app-field.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AppFieldComponent), multi: true },
  ],
})
export class AppFieldComponent implements ControlValueAccessor {
  @Input() id = `app-field-${nextFieldId++}`;
  @Input() label = '';
  @Input() type = 'text';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() submitted = false;
  value = '';
  disabled = false;
  touched = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  get describedBy(): string | null {
    return this.hint || this.visibleError ? `${this.id}-help` : null;
  }
  get visibleError(): string {
    return this.touched || this.submitted ? this.error : '';
  }
  writeValue(value: string | null): void {
    this.value = value ?? '';
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }
  updateValue(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onChange(this.value);
  }
  markTouched(): void {
    this.touched = true;
    this.onTouched();
  }
}
