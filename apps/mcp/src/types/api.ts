export interface ApiErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
}

export interface Activity {
  id: string;
  date: string;
  title: string;
  description: string | null;
  referenceUrls: string[];
  tags: string[];
  projects: Array<{ id: string; name: string }>;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
}

export interface ActivityList {
  items: Activity[];
  total: number;
  page?: number;
  limit?: number;
}

export interface ReportResult {
  id: string;
  markdown: string;
  provider: string;
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  activityCount: number;
  shareUrl: string;
  shareExpiresAt: string;
}

export interface ReportStyles {
  styles: Array<{
    id: "summary" | "detailed";
    prompt: { es: string; en: string };
  }>;
  customPrompt: string | null;
}

export interface ReportJob {
  id: string;
  status: string;
  progress: { done: number; total: number };
  shareUrl?: string;
  shareExpiresAt?: string;
  markdown?: string;
  provider?: string;
  model?: string;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  activityCount?: number;
  error?: { code: string; chunk?: number };
  [key: string]: unknown;
}

export interface ReportSummary {
  id: string;
  status: string;
  from: string;
  to: string;
  language: string;
  style: string;
  projects: Array<{ id: string; name: string }>;
  activityCount: number;
  provider: string | null;
  model: string | null;
  totalTokens: number;
  costUsd: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface ReportList {
  items: ReportSummary[];
  total: number;
  page: number;
  limit: number;
}
