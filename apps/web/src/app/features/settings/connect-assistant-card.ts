import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-connect-assistant-card',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './connect-assistant-card.html',
  styleUrl: './connect-assistant-card.css',
})
export class ConnectAssistantCardComponent {
  @Input() serverUrl = '';
  @Output() copy = new EventEmitter<string>();
}
