import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './app-empty-state.html',
  styleUrl: './app-empty-state.css',
})
export class AppEmptyStateComponent {
  @Input() title = '';
  @Input() message = '';
}
