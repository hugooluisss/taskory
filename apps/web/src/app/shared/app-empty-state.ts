import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './app-empty-state.html',
})
export class AppEmptyStateComponent {
  @Input() title = '';
  @Input() message = '';
}
