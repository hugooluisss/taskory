export interface ReportJobParams {
  from: string;
  to: string;
  projects?: string[];
  tags?: string[];
  language: "es" | "en";
  provider?: string;
  model?: string;
  style: "summary" | "detailed";
}
