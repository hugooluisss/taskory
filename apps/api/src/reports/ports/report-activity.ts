export interface ReportActivity {
  id: string;
  date: string;
  title: string;
  description: string | null;
  referenceUrls: string[];
  tags: string[];
  projects: { id: string; name: string }[];
}
