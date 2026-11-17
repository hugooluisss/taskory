import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastTimer {
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delayMs);
  }
  cancel(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
  }
}
