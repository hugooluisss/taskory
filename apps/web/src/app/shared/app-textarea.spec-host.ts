import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppTextareaComponent } from './app-textarea';

@Component({
  selector: 'app-textarea-test-host',
  standalone: true,
  imports: [AppTextareaComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './app-textarea.spec-host.html',
  styleUrl: './app-textarea.spec-host.css',
})
export class AppTextareaTestHost {
  form = new FormGroup({ description: new FormControl('', { nonNullable: true }) });
  modelValue = '';
}
