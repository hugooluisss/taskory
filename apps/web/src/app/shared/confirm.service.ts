import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog: HTMLDialogElement | null = null;
  private resolveResult: ((result: boolean) => void) | null = null;
  private opener: HTMLElement | null = null;
  readonly options = signal<ConfirmOptions | null>(null);
  attach(dialog: HTMLDialogElement): void {
    this.dialog = dialog;
  }
  ask(options: ConfirmOptions): Promise<boolean> {
    if (!this.dialog) return Promise.resolve(false);
    if (this.resolveResult) this.answer(false);
    this.options.set(options);
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.showModal();
    queueMicrotask(() => this.dialog?.querySelector<HTMLElement>('[data-safe]')?.focus());
    return new Promise((resolve) => {
      this.resolveResult = resolve;
    });
  }
  answer(result: boolean): void {
    if (!this.resolveResult) return;
    const resolve = this.resolveResult;
    this.resolveResult = null;
    this.options.set(null);
    this.dialog?.close();
    resolve(result);
    this.opener?.focus();
    this.opener = null;
  }
}
