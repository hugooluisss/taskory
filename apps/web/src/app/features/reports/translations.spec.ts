import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Internationalization', () => {
  const catalogs = () =>
    (['en', 'es'] as const).map(
      (language) =>
        JSON.parse(
          readFileSync(
            resolve(process.cwd(), `public/assets/i18n/reports/${language}.json`),
            'utf8',
          ),
        ) as Record<string, unknown>,
    );

  it('keeps the reports keys equal in Spanish and English', () => {
    const [english, spanish] = catalogs();
    const keys = (value: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof child === 'object' && child !== null
          ? keys(child as Record<string, unknown>, path)
          : [path];
      });
    expect(keys(english).sort()).toEqual(keys(spanish).sort());
  });

  it('uses Transloco interpolation syntax for report catalog placeholders', () => {
    const strings = (value: Record<string, unknown>): string[] =>
      Object.values(value).flatMap((child) =>
        typeof child === 'string'
          ? [child]
          : typeof child === 'object' && child !== null
            ? strings(child as Record<string, unknown>)
            : [],
      );
    for (const catalog of catalogs()) {
      expect(strings(catalog).join('\n')).not.toMatch(/(?<!\{)\{(?!\{)[^{}]+\}(?!\})/);
    }
  });
});
