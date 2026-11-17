import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastService } from './toast.service';
import { AppIconComponent } from './app-icon';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent],
  templateUrl: './toast.html',
})
export class ToastComponent {
  toast = inject(ToastService);
}
