import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.css',
})
export class PlaceholderPage {
  title = inject(ActivatedRoute).snapshot.data['title'] as string;
}
