import { TestBed } from '@angular/core/testing';
import { AppSelectTestHost } from './app-select.spec-host';

describe('AppSelectComponent', () => {
  it('binds values through reactive forms and ngModel and renders a placeholder', async () => {
    await TestBed.configureTestingModule({ imports: [AppSelectTestHost] }).compileComponents();
    const fixture = TestBed.createComponent(AppSelectTestHost);
    fixture.componentInstance.form.controls.project.setValue('one');
    fixture.detectChanges();
    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects[0].value).toBe('one');
    expect(selects[0].options[0].textContent.trim()).toBe('Choose');
    selects[0].value = 'two';
    selects[0].dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.form.controls.project.value).toBe('two');
    selects[1].value = 'one';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.modelValue).toBe('one');
  });
  it('exposes disabled and touched error attributes', async () => {
    await TestBed.configureTestingModule({ imports: [AppSelectTestHost] }).compileComponents();
    const fixture = TestBed.createComponent(AppSelectTestHost);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('select#reactive-project').dispatchEvent(new Event('blur'));
    fixture.componentInstance.form.controls.project.disable();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select#reactive-project');
    expect(select.disabled).toBe(true);
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe('reactive-project-help');
  });
});
