import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { ConsentDetailsComponent } from './consent-details';

describe('Consent page hardening', () => {
  it('labels the client unverified and shows its id and complete redirect destination', async () => {
    await TestBed.configureTestingModule({ imports: [ConsentDetailsComponent] })
      .overrideComponent(ConsentDetailsComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ConsentDetailsComponent);
    fixture.componentInstance.request = {
      clientName: 'Calendar app',
      clientId: 'client-123',
      redirectUri: 'https://client.test/return?source=taskory',
      redirectHost: 'client.test',
      scope: 'activities reports',
      accessDescription: 'full-access',
      expiresAt: '',
    };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('consent.unverified');
    expect(text).toContain('Calendar app');
    expect(text).toContain('client-123');
    expect(text).toContain('https://client.test/return?source=taskory');
    expect(fixture.nativeElement.querySelectorAll('dt')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('code').textContent).toContain('source=taskory');
  });
});
