import { Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppIconComponent } from '../../shared/app-icon';
import { ConsentRequest } from '../../core/models';

@Component({
  selector: 'app-consent-details',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent],
  templateUrl: './consent-details.html',
})
export class ConsentDetailsComponent {
  @Input({ required: true }) request!: ConsentRequest;
}
