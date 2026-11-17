import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConnectedAppsRepository } from '../repositories/connected-apps.repository';
import { ConnectedAppsService } from './connected-apps.service';

describe('ConnectedAppsService', () => {
  it('lists and disconnects connected apps through its repository', () => {
    const repository = { list: vi.fn(() => of([])), disconnect: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({
      providers: [ConnectedAppsService, { provide: ConnectedAppsRepository, useValue: repository }],
    });
    const service = TestBed.inject(ConnectedAppsService);
    service.list().subscribe();
    service.disconnect('c1').subscribe();
    expect(repository.list).toHaveBeenCalled();
    expect(repository.disconnect).toHaveBeenCalledWith('c1');
  });
});
