import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() name = '';
  @Input() language: Language = 'en';
  @Input() saving = false;
  @Output() save = new EventEmitter<{ name: string; language: Language }>();
  submitted = false;
  get nameInvalid(): boolean {
    return !this.name.trim();
  }
  submit(): void {
    this.submitted = true;
    if (this.nameInvalid || this.saving) return;
    this.save.emit({ name: this.name.trim(), language: this.language });
  }
}
