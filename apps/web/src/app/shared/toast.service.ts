import { Injectable, signal } from '@angular/core';
import { ToastTimer } from './toast-timer';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 0;
  constructor(private timer: ToastTimer) {}
  success(message: string): void {
    this.show('success', message);
  }
  error(message: string): void {
    this.show('error', message);
  }
  info(message: string): void {
    this.show('info', message);
  }
  dismiss(id: number): void {
    this.clearTimer(id);
    this.messages.update((messages) => messages.filter((message) => message.id !== id));
  }
  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) this.timer.cancel(timer);
    this.timers.delete(id);
  }
  private show(kind: ToastKind, message: string): void {
    const id = ++this.nextId;
    const messages = [...this.messages(), { id, kind, message }];
    while (messages.length > 3) {
      const oldest = messages.shift();
      if (oldest) this.clearTimer(oldest.id);
    }
    this.messages.set(messages);
    this.timers.set(
      id,
      this.timer.schedule(() => this.dismiss(id), 5000),
    );
  }
}
