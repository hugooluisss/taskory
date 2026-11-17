import { ReportJob, ReportResult } from '../models';

export type ReportCreationResult =
  { kind: 'done'; report: ReportResult } | { kind: 'job'; job: ReportJob };
