import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiKey } from '../../core/models';
import '../../core/i18n/date-locales';

@Component({
  selector: 'app-api-keys-section',
  standalone: true,
  imports: [DatePipe, NgFor, NgIf, TranslocoPipe],
  templateUrl: './api-keys-section.html',
  styleUrl: './api-keys-section.css',
})
export class ApiKeysSectionComponent {
  private transloco = inject(TranslocoService);
  get locale(): string {
    return this.transloco.getActiveLang();
  }
  @Input() keys: ApiKey[] = [];
  @Input() keyName = '';
  @Input() newKey = '';
  @Input() creating = false;
  @Output() keyNameChange = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();
  @Output() copy = new EventEmitter<string>();
  @Output() dismiss = new EventEmitter<void>();
  @Output() revoke = new EventEmitter<string>();
}
