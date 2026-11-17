import { TestBed } from '@angular/core/testing';
import { ToastTimer } from './toast-timer';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  const callbacks: Array<() => void> = [];
  const timer = {
    schedule: vi.fn((callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length;
    }),
    cancel: vi.fn(),
  };
  beforeEach(() => {
    callbacks.length = 0;
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [ToastService, { provide: ToastTimer, useValue: timer }],
    });
  });
  it('shows success, error and info messages and caps visible toasts at three', () => {
    const service = TestBed.inject(ToastService);
    service.success('Saved');
    service.error('Failed');
    service.info('Copied');
    service.info('Fourth');
    expect(service.messages().map((message) => message.kind)).toEqual(['error', 'info', 'info']);
    expect(timer.cancel).toHaveBeenCalledWith(1);
  });
  it('auto-dismisses after the scheduled callback and can dismiss manually', () => {
    const service = TestBed.inject(ToastService);
    service.info('Notice');
    callbacks[0]();
    expect(service.messages()).toEqual([]);
    service.info('Second');
    service.dismiss(service.messages()[0].id);
    expect(service.messages()).toEqual([]);
    expect(timer.cancel).toHaveBeenCalled();
  });
});
