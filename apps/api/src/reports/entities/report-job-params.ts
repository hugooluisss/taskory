export interface ReportJobParams {
  from: string;
  to: string;
  project?: string;
  tags?: string[];
  language: "es" | "en";
  provider?: string;
  model?: string;
  style: "summary" | "detailed";
}
