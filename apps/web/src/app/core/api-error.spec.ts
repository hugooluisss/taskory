import { ApiError } from './api-error';

describe('API error envelope', () => {
  it('keeps optional extra details as a read-only record', () => {
    const details = { id: 'report-1' };
    const error = new ApiError('REPORT_IN_PROGRESS', 409, details);
    expect(error.details).toEqual({ id: 'report-1' });
    expect(Object.isFrozen(error.details)).toBe(true);
    expect(error.code).toBe('REPORT_IN_PROGRESS');
    expect(error.status).toBe(409);
  });
  it('keeps the two-argument constructor backward compatible', () => {
    const error = new ApiError('UNKNOWN', 500);
    expect(error.details).toEqual({});
  });
});
