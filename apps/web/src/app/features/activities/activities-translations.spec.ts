import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Activity management', () => {
  it('keeps the Spanish and English scope keys in sync', () => {
    const directory = resolve(process.cwd(), 'public/assets/i18n/activities');
    const english = JSON.parse(readFileSync(resolve(directory, 'en.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    const spanish = JSON.parse(readFileSync(resolve(directory, 'es.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort());
  });
});
