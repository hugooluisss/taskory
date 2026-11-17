import { Injectable, inject } from '@angular/core';
import { ApiKeysRepository } from '../repositories/api-keys.repository';

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private repository = inject(ApiKeysRepository);
  list() {
    return this.repository.list();
  }
  create(name: string) {
    return this.repository.create(name);
  }
  revoke(id: string) {
    return this.repository.revoke(id);
  }
}
