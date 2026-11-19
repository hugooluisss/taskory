import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'transloco', standalone: true })
export class TestTranslocoPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    const template =
      key === 'reports.detail.metadata'
        ? '{{style}} · {{language}} · {{provider}} / {{model}} · {{tokens}} tokens · {{count}} activities'
        : key;
    return Object.entries(params ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template,
    );
  }
}
