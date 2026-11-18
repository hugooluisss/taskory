export interface Activity {
  id?: string;
  date: string;
  title: string;
  description?: string | null;
  referenceUrls?: string[];
  tags?: string[];
  project?: string | null;
}

export interface ReportOptions {
  activities: Activity[];
  from: string;
  to: string;
  language: "es" | "en";
  style?: "summary" | "detailed";
  projects?: string[];
}
