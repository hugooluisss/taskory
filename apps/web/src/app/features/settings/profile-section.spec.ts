import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { ProfileSectionComponent } from './profile-section';

describe('Settings', () => {
  it('requires a nonempty name and labels each profile field', async () => {
    await TestBed.configureTestingModule({ imports: [ProfileSectionComponent] })
      .overrideComponent(ProfileSectionComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProfileSectionComponent);
    fixture.componentInstance.submitted = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('label[for="profile-name"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('label[for="profile-language"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
  it('emits the validated name and selected language on save', async () => {
    await TestBed.configureTestingModule({ imports: [ProfileSectionComponent] })
      .overrideComponent(ProfileSectionComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ProfileSectionComponent);
    fixture.componentInstance.name = '  Grace  ';
    fixture.componentInstance.language = 'es';
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    fixture.componentInstance.submit();
    expect(save).toHaveBeenCalledWith({ name: 'Grace', language: 'es' });
  });
});
