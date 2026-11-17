import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppIconComponent } from '../../shared/app-icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-connect-assistant-card',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent],
  templateUrl: './connect-assistant-card.html',
})
export class ConnectAssistantCardComponent {
  @Input() serverUrl = '';
  @Output() copy = new EventEmitter<string>();
}
