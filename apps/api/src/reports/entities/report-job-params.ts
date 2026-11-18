export interface ReportJobParams {
  from: string;
  to: string;
  projectIds?: string[];
  tags?: string[];
  language: "es" | "en";
  style: "summary" | "detailed";
}
