import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  it('opens one native dialog, focuses the safe action, and resolves approval', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const showModal = vi.fn(() => dialog.setAttribute('open', ''));
    const close = vi.fn(() => dialog.removeAttribute('open'));
    Object.defineProperty(dialog, 'showModal', { value: showModal, configurable: true });
    Object.defineProperty(dialog, 'close', { value: close, configurable: true });
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const service = TestBed.inject(ConfirmService);
    const result = service.ask({
      title: 'Delete?',
      message: 'Remove it?',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      danger: true,
    });
    fixture.detectChanges();
    await Promise.resolve();
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-title');
    expect(dialog.querySelector('[data-safe]')).toBe(document.activeElement);
    service.answer(true);
    await expect(result).resolves.toBe(true);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(opener).toBe(document.activeElement);
    opener.remove();
  });
  it('resolves the previous request as false when only one dialog may be open', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const showModal = vi.fn(() => dialog.setAttribute('open', ''));
    const close = vi.fn(() => dialog.removeAttribute('open'));
    Object.defineProperty(dialog, 'showModal', { value: showModal, configurable: true });
    Object.defineProperty(dialog, 'close', { value: close, configurable: true });
    const service = TestBed.inject(ConfirmService);
    const first = service.ask({
      title: 'First',
      message: 'First',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    const second = service.ask({
      title: 'Second',
      message: 'Second',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    await expect(first).resolves.toBe(false);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await expect(second).resolves.toBe(false);
  });
  it('resolves a backdrop click as false', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperty(dialog, 'showModal', {
      value: vi.fn(() => dialog.setAttribute('open', '')),
      configurable: true,
    });
    Object.defineProperty(dialog, 'close', {
      value: vi.fn(() => dialog.removeAttribute('open')),
      configurable: true,
    });
    const result = TestBed.inject(ConfirmService).ask({
      title: 'Confirm',
      message: 'Confirm?',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    fixture.detectChanges();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect(result).resolves.toBe(false);
  });
});
