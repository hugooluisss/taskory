import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiKeysRepository } from '../repositories/api-keys.repository';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  const repository = {
    list: vi.fn(() => of([])),
    create: vi.fn(() => of({ key: 'once' })),
    revoke: vi.fn(() => of(undefined)),
  };
  it('lists, creates and revokes through its repository without retaining a key', () => {
    TestBed.configureTestingModule({
      providers: [ApiKeysService, { provide: ApiKeysRepository, useValue: repository }],
    });
    const service = TestBed.inject(ApiKeysService);
    service.list().subscribe();
    service.create('agent').subscribe();
    service.revoke('k1').subscribe();
    expect(repository.list).toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith('agent');
    expect(repository.revoke).toHaveBeenCalledWith('k1');
    expect('key' in service).toBe(false);
  });
});
