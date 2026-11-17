export interface ReportJobQueue {
  enqueue(id: string, userId: string): void;
  cancel(id: string): void;
  finishCancellation(id: string): void;
  resumeQueued(): Promise<void>;
}

export const REPORT_JOB_QUEUE = Symbol("REPORT_JOB_QUEUE");
