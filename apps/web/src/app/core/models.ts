export type Language = 'es' | 'en';

export interface User {
  id: string;
  email: string;
  name: string;
  language: Language;
}

export interface Activity {
  id: string;
  date: string;
  title: string;
  description: string | null;
  referenceUrls: string[];
  tags: string[];
  projects: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ActivityFilters {
  from?: string;
  to?: string;
  projectIds?: string[];
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export type ActivityInput = Pick<Activity, 'date' | 'title'> &
  Partial<Pick<Activity, 'description' | 'referenceUrls' | 'tags'>> & { projectIds?: string[] };

export interface Project {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ReportRequest {
  from: string;
  to: string;
  projectIds?: string[];
  tags?: string[];
  language: Language;
  style?: ReportStyle;
  customPrompt?: string;
}

export type ReportStyle = 'summary' | 'detailed' | 'custom';

export interface ReportStyles {
  styles: { id: 'summary' | 'detailed'; prompt: Record<Language, string> }[];
  customPrompt: string | null;
}

export interface ReportResult {
  id?: string;
  shareUrl?: string;
  shareExpiresAt?: string;
  markdown: string;
  provider: string;
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  activityCount: number;
}

export type ReportJob =
  | { id: string; status: 'queued' | 'running'; progress: { done: number; total: number } }
  | {
      id: string;
      status: 'completed';
      progress: { done: number; total: number };
      markdown: string;
      provider: string;
      model: string;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      costUsd: number;
      activityCount: number;
    }
  | {
      id: string;
      status: 'failed';
      progress: { done: number; total: number };
      error: { code: string; message: string; chunk?: number };
    };

export interface RetryReportJob {
  id: string;
  status: 'queued' | 'running';
  progress: { done: number; total: number };
}

export interface ReportSummary {
  id: string;
  status: ReportJob['status'];
  from: string;
  to: string;
  language: Language;
  style: ReportStyle;
  projects: { id: string; name: string }[];
  activityCount: number;
  provider: string | null;
  model: string | null;
  totalTokens: number;
  costUsd: number;
  createdAt: string;
  finishedAt: string | null;
}
export interface ReportDetail extends ReportSummary {
  promptTokens: number;
  completionTokens: number;
  markdown: string | null;
  progress: { done: number; total: number };
  shareExpiresAt: string | null;
  customPrompt?: string;
  error?: { code: string; chunk: number | null; message: string };
  shareUrl?: string;
}
export interface SharedReport {
  period: { from: string; to: string };
  language: Language;
  projects: string[];
  activities: {
    date: string;
    title: string;
    description: string | null;
    projects: string[];
    tags: string[];
    referenceUrls: string[];
  }[];
}

export interface ConnectedApp {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ConsentRequest {
  clientName: string;
  clientId: string;
  redirectUri: string;
  redirectHost: string;
  scope: string;
  accessDescription: string;
  expiresAt: string;
}

export interface ApiError {
  code: string;
  status: number;
}
