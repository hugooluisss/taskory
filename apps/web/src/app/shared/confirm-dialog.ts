import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialogComponent implements AfterViewInit {
  confirm = inject(ConfirmService);
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  ngAfterViewInit(): void {
    this.confirm.attach(this.dialog.nativeElement);
  }
  cancel(): void {
    this.confirm.answer(false);
  }
  backdropClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) this.confirm.answer(false);
  }
}
