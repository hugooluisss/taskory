import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { ConnectAssistantCardComponent } from './connect-assistant-card';

describe('Agent connection and consent', () => {
  it('shows a labelled server address and emits it for copying', async () => {
    await TestBed.configureTestingModule({ imports: [ConnectAssistantCardComponent] })
      .overrideComponent(ConnectAssistantCardComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ConnectAssistantCardComponent);
    fixture.componentInstance.serverUrl = 'https://taskory.test/mcp';
    const copied = vi.fn();
    fixture.componentInstance.copy.subscribe(copied);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.nativeElement.querySelector('label[for="server-address"]')).toBeTruthy();
    expect(copied).toHaveBeenCalledWith('https://taskory.test/mcp');
  });
});
