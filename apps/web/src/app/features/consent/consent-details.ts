import { Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConsentRequest } from '../../core/models';

@Component({
  selector: 'app-consent-details',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './consent-details.html',
  styleUrl: './consent-details.css',
})
export class ConsentDetailsComponent {
  @Input({ required: true }) request!: ConsentRequest;
}
