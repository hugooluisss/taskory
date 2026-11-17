import en from '../../../../public/assets/i18n/consent/en.json';
import es from '../../../../public/assets/i18n/consent/es.json';

describe('Agent connection and consent', () => {
  it('keeps Spanish and English keys in sync', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
});
