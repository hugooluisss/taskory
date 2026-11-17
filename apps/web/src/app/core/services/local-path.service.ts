import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocalPathService {
  normalize(value: string | null, fallback = '/activities'): string {
    return value &&
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !/[\\\u0000-\u001f\u007f]/.test(value)
      ? value
      : fallback;
  }
}
