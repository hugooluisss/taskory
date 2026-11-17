import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'transloco', standalone: true })
export class TestTranslocoPipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}
