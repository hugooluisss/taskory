import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class ToastComponent {
  toast = inject(ToastService);
}
