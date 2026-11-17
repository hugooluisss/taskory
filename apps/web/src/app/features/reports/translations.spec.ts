import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Internationalization', () => {
  it('keeps the reports keys equal in Spanish and English', () => {
    const english = JSON.parse(
      readFileSync(resolve(process.cwd(), 'public/assets/i18n/reports/en.json'), 'utf8'),
    ) as Record<string, unknown>;
    const spanish = JSON.parse(
      readFileSync(resolve(process.cwd(), 'public/assets/i18n/reports/es.json'), 'utf8'),
    ) as Record<string, unknown>;
    const keys = (value: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof child === 'object' && child !== null
          ? keys(child as Record<string, unknown>, path)
          : [path];
      });
    expect(keys(english).sort()).toEqual(keys(spanish).sort());
  });
});
