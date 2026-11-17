import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { TestBed } from '@angular/core/testing';
import { AppSpinnerComponent } from './app-spinner';

describe('AppSpinnerComponent', () => {
  it('renders its accessible control', async () => {
    await TestBed.configureTestingModule({ imports: [AppSpinnerComponent] })
      .overrideComponent(AppSpinnerComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppSpinnerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
