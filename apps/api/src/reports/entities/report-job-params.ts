export interface ReportJobParams {
  from: string;
  to: string;
  projects?: string[];
  tags?: string[];
  language: "es" | "en";
  style: "summary" | "detailed";
}
