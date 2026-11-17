import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppChipsInputComponent } from './app-chips-input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { AppChipsInputTestHost } from './app-chips-input.spec-host';

describe('AppChipsInputComponent', () => {
  it('binds chips through reactive forms and ngModel', async () => {
    await TestBed.configureTestingModule({ imports: [AppChipsInputTestHost] })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppChipsInputTestHost);
    fixture.componentInstance.form.controls.tags.setValue(['one']);
    fixture.detectChanges();
    const tagInput = fixture.nativeElement.querySelector('input#reactive-tags');
    expect(fixture.nativeElement.textContent).toContain('one');
    tagInput.value = ' Two ';
    tagInput.dispatchEvent(new Event('input'));
    tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.tags.value).toEqual(['one', 'two']);
    const modelInput = fixture.nativeElement.querySelector('input#model-tags');
    modelInput.value = 'Model';
    modelInput.dispatchEvent(new Event('input'));
    modelInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.modelValue).toEqual(['model']);
  });
  it('deduplicates, splits paste, removes chips and supports Backspace', async () => {
    await TestBed.configureTestingModule({ imports: [AppChipsInputTestHost] })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppChipsInputTestHost);
    const control = fixture.componentInstance.form.controls.tags;
    control.setValue(['first']);
    fixture.detectChanges();
    const component = fixture.debugElement.queryAll(By.directive(AppChipsInputComponent))[0]
      .componentInstance as AppChipsInputComponent;
    component.add([' FIRST ', 'second,third']);
    expect(control.value).toEqual(['first', 'second,third']);
    component.add(['second', 'third']);
    expect(control.value).toEqual(['first', 'second,third', 'second', 'third']);
    fixture.detectChanges();
    const removeButton = fixture.nativeElement.querySelector('.badge button');
    removeButton.click();
    expect(control.value).toEqual(['second,third', 'second', 'third']);
    const input = fixture.nativeElement.querySelector('input#reactive-tags');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(control.value.at(-1)).toBe('second');
    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'fourth, fifth' } });
    component.paste(paste as ClipboardEvent);
    expect(control.value.slice(-2)).toEqual(['fourth', 'fifth']);
  });
  it('applies max item and length rules, and validates URL mode', async () => {
    await TestBed.configureTestingModule({ imports: [AppChipsInputTestHost] })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppChipsInputTestHost);
    const component = fixture.debugElement.queryAll(By.directive(AppChipsInputComponent))[2]
      .componentInstance as AppChipsInputComponent;
    component.add(['https://good.test', 'javascript:bad', 'ftp://bad.test']);
    expect(component.value()).toEqual(['https://good.test']);
    component.maxItems = 1;
    component.add(['https://next.test']);
    expect(component.value()).toEqual(['https://good.test']);
    component.maxLength = 3;
    component.mode = 'tags';
    component.add(['longer']);
    expect(component.value()).toEqual(['https://good.test']);
  });
  it('adds comma-separated and blur values, and respects a custom validator', async () => {
    await TestBed.configureTestingModule({ imports: [AppChipsInputTestHost] })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppChipsInputTestHost);
    const component = fixture.debugElement.queryAll(By.directive(AppChipsInputComponent))[1]
      .componentInstance as AppChipsInputComponent;
    component.inputValue.set('valid');
    component.addOnKey(new KeyboardEvent('keydown', { key: ',' }));
    expect(component.value()).toEqual(['valid']);
    component.validator = (value) => value.startsWith('ok');
    component.add(['invalid', 'ok-value']);
    expect(component.value()).toEqual(['valid', 'ok-value']);
    component.inputValue.set('ok-blur');
    component.addOnBlur();
    expect(component.value()).toEqual(['valid', 'ok-value', 'ok-blur']);
  });
  it('reflects disabled and touched validation accessibly', async () => {
    await TestBed.configureTestingModule({ imports: [AppChipsInputTestHost] })
      .overrideComponent(AppChipsInputComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(AppChipsInputTestHost);
    const control = fixture.componentInstance.form.controls.tags;
    fixture.detectChanges();
    fixture.nativeElement.querySelector('input#reactive-tags').dispatchEvent(new Event('blur'));
    control.disable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input#reactive-tags');
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('reactive-tags-help');
  });
});
