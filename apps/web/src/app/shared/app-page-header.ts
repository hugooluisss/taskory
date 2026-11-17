import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './app-page-header.html',
})
export class AppPageHeaderComponent {
  @Input() title = '';
  @Input() description = '';
}
