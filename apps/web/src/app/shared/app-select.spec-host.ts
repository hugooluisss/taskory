import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppSelectComponent } from './app-select';

@Component({
  selector: 'app-select-test-host',
  standalone: true,
  imports: [AppSelectComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './app-select.spec-host.html',
  styleUrl: './app-select.spec-host.css',
})
export class AppSelectTestHost {
  form = new FormGroup({ project: new FormControl('', { nonNullable: true }) });
  modelValue = '';
}
