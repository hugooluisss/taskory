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
  project: string | null;
}

export interface ActivityList {
  items: Activity[];
  total: number;
  page?: number;
  limit?: number;
}

export interface ReportResult {
  markdown: string;
  provider: string;
  model: string;
  activityCount: number;
}

export interface ReportJob {
  id: string;
  status: string;
  progress: { done: number; total: number };
  markdown?: string;
  error?: { code: string; chunk?: number };
}
