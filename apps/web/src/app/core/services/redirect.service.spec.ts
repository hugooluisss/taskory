import { TestBed } from '@angular/core/testing';
import { LOCATION_ASSIGN, RedirectService } from './redirect.service';

describe('RedirectService', () => {
  it('assigns the approved URL through its injectable location adapter', () => {
    const assign = vi.fn();
    TestBed.configureTestingModule({
      providers: [RedirectService, { provide: LOCATION_ASSIGN, useValue: assign }],
    });
    TestBed.inject(RedirectService).assign('https://client.test/callback');
    expect(assign).toHaveBeenCalledWith('https://client.test/callback');
  });
});
