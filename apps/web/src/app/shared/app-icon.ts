import { Component, Input } from '@angular/core';
import { APP_ICON_PATHS, AppIconName } from './app-icon.paths';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './app-icon.html',
})
export class AppIconComponent {
  @Input({ required: true }) name!: AppIconName;
  @Input() size = 'size-5';
  get paths(): readonly string[] {
    return APP_ICON_PATHS[this.name];
  }
}
