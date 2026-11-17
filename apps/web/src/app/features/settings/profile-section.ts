import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Language } from '../../core/models';

@Component({
  selector: 'app-profile-section',
  standalone: true,
  imports: [FormsModule, NgIf, TranslocoPipe],
  templateUrl: './profile-section.html',
  styleUrl: './profile-section.css',
})
export class ProfileSectionComponent {
  readonly name = model('');
  readonly language = model<Language>('en');
  @Input() saving = false;
  @Output() save = new EventEmitter<{ name: string; language: Language }>();
  readonly submitted = signal(false);
  get nameInvalid(): boolean {
    return !this.name().trim();
  }
  submit(): void {
    this.submitted.set(true);
    if (this.nameInvalid || this.saving) return;
    this.save.emit({ name: this.name().trim(), language: this.language() });
  }
}
