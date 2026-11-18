export interface ReportJobParams {
  projects?: { id: string; name: string; description: string | null }[];
  from: string;
  to: string;
  projectIds?: string[];
  tags?: string[];
  language: "es" | "en";
  style: "summary" | "detailed" | "custom";
  customPrompt?: string;
}
