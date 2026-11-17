import en from '../../../../public/assets/i18n/settings/en.json';
import es from '../../../../public/assets/i18n/settings/es.json';

describe('Settings', () => {
  it('keeps Spanish and English keys in sync', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
});
