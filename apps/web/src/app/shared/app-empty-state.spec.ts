import { TestBed } from '@angular/core/testing';
import { AppEmptyStateComponent } from './app-empty-state';

describe('AppEmptyStateComponent', () => {
  it('renders its accessible control', async () => {
    await TestBed.configureTestingModule({ imports: [AppEmptyStateComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppEmptyStateComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
