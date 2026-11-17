export interface Highlight {
  activityId: string;
  date: string;
  title: string;
  project: string | null;
  impact: "high" | "medium";
  reason: string;
}
