import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './app-spinner.html',
  styleUrl: './app-spinner.css',
})
export class AppSpinnerComponent {}
