import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppFieldComponent } from './app-field';

@Component({
  selector: 'app-field-test-host',
  standalone: true,
  imports: [AppFieldComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './app-field.spec-host.html',
  styleUrl: './app-field.spec-host.css',
})
export class AppFieldTestHost {
  form = new FormGroup({ name: new FormControl('', { nonNullable: true }) });
  modelValue = '';
}
