import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppChipsInputComponent } from './app-chips-input';

@Component({
  selector: 'app-chips-test-host',
  standalone: true,
  imports: [AppChipsInputComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './app-chips-input.spec-host.html',
  styleUrl: './app-chips-input.spec-host.css',
})
export class AppChipsInputTestHost {
  form = new FormGroup({ tags: new FormControl<string[]>([], { nonNullable: true }) });
  modelValue: string[] = [];
}
