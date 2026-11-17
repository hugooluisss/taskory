import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './app-pagination.html',
  styleUrl: './app-pagination.css',
})
export class AppPaginationComponent {
  @Input() page = 1;
  @Input() pages = 1;
  @Output() pageChange = new EventEmitter<number>();
}
