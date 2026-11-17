import { TestBed } from '@angular/core/testing';
import { AppButtonComponent } from './app-button';

describe('AppButtonComponent', () => {
  it('renders the selected variant and disables with an accessible loading state', async () => {
    await TestBed.configureTestingModule({ imports: [AppButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppButtonComponent);
    fixture.componentInstance.variant = 'danger';
    fixture.componentInstance.loading = true;
    fixture.componentInstance.fullWidth = true;
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('danger')).toBe(true);
    expect(button.classList.contains('full-width')).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.spinner').getAttribute('aria-hidden')).toBe('true');
  });
});
