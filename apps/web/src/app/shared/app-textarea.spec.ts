import { TestBed } from '@angular/core/testing';
import { AppTextareaTestHost } from './app-textarea.spec-host';

describe('AppTextareaComponent', () => {
  it('binds values through reactive forms and ngModel', async () => {
    await TestBed.configureTestingModule({ imports: [AppTextareaTestHost] }).compileComponents();
    const fixture = TestBed.createComponent(AppTextareaTestHost);
    fixture.componentInstance.form.controls.description.setValue('Text');
    fixture.detectChanges();
    const areas = fixture.nativeElement.querySelectorAll('textarea');
    expect(areas[0].value).toBe('Text');
    areas[0].value = 'Updated';
    areas[0].dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.form.controls.description.value).toBe('Updated');
    areas[1].value = 'Model';
    areas[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.modelValue).toBe('Model');
  });
  it('exposes disabled and touched validation accessibly', async () => {
    await TestBed.configureTestingModule({ imports: [AppTextareaTestHost] }).compileComponents();
    const fixture = TestBed.createComponent(AppTextareaTestHost);
    const control = fixture.componentInstance.form.controls.description;
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('textarea#reactive-description')
      .dispatchEvent(new Event('blur'));
    control.disable();
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('textarea#reactive-description');
    expect(element.disabled).toBe(true);
    expect(element.required).toBe(true);
    expect(element.getAttribute('aria-invalid')).toBe('true');
    expect(element.getAttribute('aria-describedby')).toBe('reactive-description-help');
  });
});
