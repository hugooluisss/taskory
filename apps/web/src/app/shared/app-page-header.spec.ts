import { TestBed } from '@angular/core/testing';
import { AppPageHeaderComponent } from './app-page-header';

describe('AppPageHeaderComponent', () => {
  it('renders its accessible control', async () => {
    await TestBed.configureTestingModule({ imports: [AppPageHeaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppPageHeaderComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
