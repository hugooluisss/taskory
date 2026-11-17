import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OAuthRequestsRepository } from '../repositories/oauth-requests.repository';
import { OAuthRequestsService } from './oauth-requests.service';

describe('OAuthRequestsService', () => {
  it('loads request details and returns the approved redirect URL', async () => {
    const repository = {
      getRequest: vi.fn(() => of({ clientId: 'c1' })),
      decide: vi.fn(() => of({ redirectUrl: 'https://client.test/cb' })),
    };
    TestBed.configureTestingModule({
      providers: [OAuthRequestsService, { provide: OAuthRequestsRepository, useValue: repository }],
    });
    const service = TestBed.inject(OAuthRequestsService);
    service.getRequest('r1').subscribe();
    await expect(service.decide('r1', true)).resolves.toEqual({
      redirectUrl: 'https://client.test/cb',
    });
    expect(repository.getRequest).toHaveBeenCalledWith('r1');
    expect(repository.decide).toHaveBeenCalledWith('r1', true);
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd'])(
    'rejects unsafe redirect target %s',
    async (target) => {
      const repository = { getRequest: vi.fn(), decide: vi.fn(() => of({ redirectUrl: target })) };
      TestBed.configureTestingModule({
        providers: [
          OAuthRequestsService,
          { provide: OAuthRequestsRepository, useValue: repository },
        ],
      });
      await expect(TestBed.inject(OAuthRequestsService).decide('r1', false)).rejects.toThrow(
        TypeError,
      );
    },
  );
});
