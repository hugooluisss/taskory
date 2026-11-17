import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { ToastComponent } from './toast';
import { ToastService } from './toast.service';

describe('ToastComponent', () => {
  it('announces errors and success messages and has a dismiss control', async () => {
    await TestBed.configureTestingModule({ imports: [ToastComponent], providers: [ToastService] })
      .overrideComponent(ToastComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    service.error('Failed');
    service.success('Saved');
    fixture.detectChanges();
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    const statuses = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(alerts.length).toBe(1);
    expect(statuses.length).toBe(1);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(service.messages().length).toBe(1);
  });
});
