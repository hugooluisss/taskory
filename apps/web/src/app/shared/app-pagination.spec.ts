import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { TestBed } from '@angular/core/testing';
import { AppPaginationComponent } from './app-pagination';

describe('AppPaginationComponent', () => {
  it('renders its accessible control', async () => {
    await TestBed.configureTestingModule({ imports: [AppPaginationComponent] })
      .overrideComponent(AppPaginationComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppPaginationComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
