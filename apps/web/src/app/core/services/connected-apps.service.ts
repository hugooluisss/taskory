import { Injectable, inject } from '@angular/core';
import { ConnectedAppsRepository } from '../repositories/connected-apps.repository';

@Injectable({ providedIn: 'root' })
export class ConnectedAppsService {
  private repository = inject(ConnectedAppsRepository);
  list() {
    return this.repository.list();
  }
  disconnect(id: string) {
    return this.repository.disconnect(id);
  }
}
