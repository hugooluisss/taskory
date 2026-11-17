export const REPORT_SYNC_MAX_ACTIVITIES = 100;
export const CHUNK_SIZE = Math.max(
  1,
  Number(process.env.REPORT_CHUNK_SIZE) || REPORT_SYNC_MAX_ACTIVITIES,
);
export const MAX_REPORT_ACTIVITIES = 3000;
export const reportActivityLimit = (): number =>
  Number(process.env.REPORT_MAX_ACTIVITIES) || MAX_REPORT_ACTIVITIES;
export const MAX_HIGHLIGHTS_BEFORE_CONSOLIDATION = 100;
export const REPORT_RETENTION_DAYS = 30;
export const REPORT_GLOBAL_CONCURRENCY = 2;
export const REPORT_USER_CONCURRENCY = 1;
