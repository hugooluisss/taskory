import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { ErrorMessageService } from './error-message.service';

describe('ErrorMessageService', () => {
  const codes: Record<string, string> = {
    VALIDATION_ERROR: 'errors.validation',
    INVALID_CREDENTIALS: 'errors.invalidCredentials',
    EMAIL_TAKEN: 'errors.emailTaken',
    NOT_FOUND: 'errors.notFound',
    UNAUTHORIZED: 'errors.unauthorized',
    TOO_MANY_REQUESTS: 'errors.tooManyRequests',
    NO_ACTIVITIES: 'errors.noActivities',
    RANGE_TOO_LARGE: 'errors.rangeTooLarge',
    LLM_UNAVAILABLE: 'errors.llmUnavailable',
    INVALID_LLM_OUTPUT: 'errors.invalidLlmOutput',
    REPORT_IN_PROGRESS: 'errors.reportInProgress',
    REPORT_NOT_RETRYABLE: 'errors.reportNotRetryable',
    API_KEY_LIMIT: 'errors.apiKeyLimit',
    PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
    NETWORK_ERROR: 'errors.network',
    UNKNOWN: 'errors.unknown',
  };
  it.each(Object.entries(codes))('maps %s to its translation key', (code, key) => {
    expect(TestBed.inject(ErrorMessageService).key(code)).toBe(key);
  });
  it('uses the generic and network fallbacks', () => {
    const service = TestBed.inject(ErrorMessageService);
    expect(service.key()).toBe('errors.unknown');
    expect(service.key('UNRECOGNIZED')).toBe('errors.unknown');
    expect(service.key('NETWORK_ERROR')).toBe('errors.network');
  });
  it('keeps every translation key in Spanish and English', () => {
    const es = JSON.parse(readFileSync('public/assets/i18n/es.json', 'utf8'));
    const en = JSON.parse(readFileSync('public/assets/i18n/en.json', 'utf8'));
    const flatten = (value: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'object' && child !== null
          ? flatten(child as Record<string, unknown>, prefix ? `${prefix}.${key}` : key)
          : [prefix ? `${prefix}.${key}` : key],
      );
    expect(flatten(es).sort()).toEqual(flatten(en).sort());
    for (const key of Object.values(codes)) expect(flatten(es)).toContain(key);
  });
});
