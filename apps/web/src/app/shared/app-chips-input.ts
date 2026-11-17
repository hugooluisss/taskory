import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppIconComponent } from './app-icon';

export type ChipValidator = (value: string) => boolean;
let nextChipsId = 0;
@Component({
  selector: 'app-chips-input',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent],
  templateUrl: './app-chips-input.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppChipsInputComponent),
      multi: true,
    },
  ],
})
export class AppChipsInputComponent implements ControlValueAccessor {
  @Input() id = `app-chips-${nextChipsId++}`;
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() submitted = false;
  @Input() required = false;
  @Input() maxItems = 20;
  @Input() maxLength = 50;
  @Input() suggestions: string[] = [];
  @Input() mode: 'tags' | 'urls' = 'tags';
  @Input() validator: ChipValidator | null = null;
  readonly value = signal<string[]>([]);
  readonly inputValue = signal('');
  readonly disabled = signal(false);
  readonly touched = signal(false);
  private onChange: (value: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  get visibleError(): string {
    return this.touched() || this.submitted ? this.error : '';
  }
  get describedBy(): string | null {
    return this.hint || this.visibleError ? `${this.id}-help` : null;
  }
  writeValue(value: string[] | null): void {
    this.value.set(value ? [...value] : []);
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
  addOnKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.add([this.inputValue()]);
      this.inputValue.set('');
    } else if (event.key === 'Backspace' && !this.inputValue() && this.value().length) {
      this.remove(this.value()[this.value().length - 1]);
    }
  }
  addOnBlur(): void {
    this.add([this.inputValue()]);
    this.inputValue.set('');
    this.markTouched();
  }
  paste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text');
    if (!text) return;
    event.preventDefault();
    this.add(text.split(/[\n,]+/));
  }
  add(values: string[]): void {
    const next = [...this.value()];
    for (const raw of values) {
      const value = this.normalize(raw);
      if (
        !value ||
        value.length > this.maxLength ||
        !this.valid(value) ||
        this.isDuplicate(value, next) ||
        next.length >= this.maxItems
      )
        continue;
      next.push(value);
    }
    this.update(next);
  }
  remove(value: string): void {
    this.update(this.value().filter((item) => item !== value));
  }
  markTouched(): void {
    this.touched.set(true);
    this.onTouched();
  }
  private normalize(value: string): string {
    const trimmed = value.trim();
    return this.mode === 'tags' ? trimmed.toLowerCase() : trimmed;
  }
  private valid(value: string): boolean {
    if (this.validator) return this.validator(value);
    if (this.mode !== 'urls') return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
  private isDuplicate(value: string, items: string[]): boolean {
    return items.some(
      (item) =>
        (this.mode === 'tags' ? item.toLowerCase() : item) ===
        (this.mode === 'tags' ? value.toLowerCase() : value),
    );
  }
  private update(value: string[]): void {
    this.value.set(value);
    this.onChange(value);
  }
}
