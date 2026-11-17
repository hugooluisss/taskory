import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import rootEn from '../../public/assets/i18n/en.json';
import rootEs from '../../public/assets/i18n/es.json';
import activitiesEn from '../../public/assets/i18n/activities/en.json';
import activitiesEs from '../../public/assets/i18n/activities/es.json';
import settingsEn from '../../public/assets/i18n/settings/en.json';
import settingsEs from '../../public/assets/i18n/settings/es.json';
import reportsEn from '../../public/assets/i18n/reports/en.json';
import reportsEs from '../../public/assets/i18n/reports/es.json';
import consentEn from '../../public/assets/i18n/consent/en.json';
import consentEs from '../../public/assets/i18n/consent/es.json';

const appRoot = join(process.cwd(), 'src/app');
const translations = {
  en: {
    ...rootEn,
    activities: activitiesEn,
    settings: settingsEn,
    reports: reportsEn,
    consent: consentEn,
  },
  es: {
    ...rootEs,
    activities: activitiesEs,
    settings: settingsEs,
    reports: reportsEs,
    consent: consentEs,
  },
};
const keyPattern =
  /['"]((?:activities|settings|reports|consent|auth|common|errors|shared|pagination|language|nav)\.[\w.]+)['"]/g;
const templateKeyPattern = /['"]([\w.]+)['"](?=\s*\|\s*transloco)/g;
const serviceKeyPattern = /\.translate\(\s*['"]([\w.]+)['"]/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(html|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function getPath(source: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (typeof value !== 'object' || value === null) return undefined;
    return (value as Record<string, unknown>)[part];
  }, source);
}

describe('Translation keys', () => {
  it('uses keys present in both languages at their resolved paths', () => {
    const files = [
      ...['activities', 'settings', 'consent', 'reports', 'auth', 'placeholders'].flatMap(
        (feature) => sourceFiles(join(appRoot, 'features', feature)),
      ),
      ...sourceFiles(join(appRoot, 'shared')),
      join(appRoot, 'core/services/error-message.service.ts'),
      join(appRoot, 'app.routes.ts'),
    ];
    const keys = new Set<string>();
    let hasDynamicReportErrors = false;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(keyPattern)) keys.add(match[1]);
      for (const match of source.matchAll(serviceKeyPattern)) {
        expect(match[1], `${file}: ${match[1]} should be explicitly namespaced`).toContain('.');
        keys.add(match[1]);
      }
      if (file.endsWith('.html')) {
        for (const match of source.matchAll(templateKeyPattern)) {
          expect(match[1], `${file}: ${match[1]} should be explicitly namespaced`).toContain('.');
          keys.add(match[1]);
        }
      }
      if (source.includes('reports.errors.${')) hasDynamicReportErrors = true;
    }
    if (hasDynamicReportErrors) {
      for (const code of Object.keys(reportsEn.errors)) keys.add(`reports.errors.${code}`);
    }

    for (const key of keys) {
      for (const language of ['en', 'es'] as const) {
        expect(getPath(translations[language], key), `${language}: ${key}`).toBeTypeOf('string');
      }
    }
  });
});
