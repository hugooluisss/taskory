import { Injectable } from '@angular/core';

const ERROR_KEYS: Record<string, string> = {
  VALIDATION_ERROR: 'errors.validation',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  EMAIL_TAKEN: 'errors.emailTaken',
  NOT_FOUND: 'errors.notFound',
  UNAUTHORIZED: 'errors.unauthorized',
  TOO_MANY_REQUESTS: 'errors.tooManyRequests',
  NO_ACTIVITIES: 'errors.noActivities',
  RANGE_TOO_LARGE: 'errors.rangeTooLarge',
  UNKNOWN_PROVIDER: 'errors.unknownProvider',
  LLM_UNAVAILABLE: 'errors.llmUnavailable',
  INVALID_LLM_OUTPUT: 'errors.invalidLlmOutput',
  REPORT_IN_PROGRESS: 'errors.reportInProgress',
  REPORT_NOT_RETRYABLE: 'errors.reportNotRetryable',
  API_KEY_LIMIT: 'errors.apiKeyLimit',
  PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
  NETWORK_ERROR: 'errors.network',
  UNKNOWN: 'errors.unknown',
};

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  key(code?: string): string {
    return ERROR_KEYS[code ?? 'UNKNOWN'] ?? ERROR_KEYS['UNKNOWN'];
  }
}
