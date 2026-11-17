import { TestBed } from '@angular/core/testing';
import { AppFieldTestHost } from './app-field.spec-host';

describe('AppFieldComponent', () => {
  it('binds values through a reactive form and ngModel', async () => {
    await TestBed.configureTestingModule({ imports: [AppFieldTestHost] }).compileComponents();
    const fixture = TestBed.createComponent(AppFieldTestHost);
    fixture.componentInstance.form.controls.name.setValue('Ada');
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('input');
    expect(inputs[0].value).toBe('Ada');
    inputs[0].value = 'Grace';
    inputs[0].dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.form.controls.name.value).toBe('Grace');
    inputs[1].value = 'Lin';
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.modelValue).toBe('Lin');
  });
  it('reflects disabled, required, touched error and accessible descriptions', async () => {
    await TestBed.configureTestingModule({ imports: [AppFieldTestHost] }).compileComponents();
    const fixture = TestBed.createComponent(AppFieldTestHost);
    const control = fixture.componentInstance.form.controls.name;
    fixture.detectChanges();
    fixture.nativeElement.querySelector('input#reactive-name').dispatchEvent(new Event('blur'));
    control.disable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input#reactive-name');
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('reactive-name-help');
    expect(fixture.nativeElement.querySelector('label[for="reactive-name"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('#reactive-name-help').getAttribute('aria-live'),
    ).toBe('polite');
  });
});
