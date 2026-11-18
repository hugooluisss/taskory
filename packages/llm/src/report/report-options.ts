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
  style?: "summary" | "detailed" | "custom";
  customPrompt?: string;
  projects?: ReportProject[];
}

export interface ReportProject { id: string; name: string; description: string | null }

export function projectData(projects?: ReportProject[]) {
  return projects?.map(({ id, name, description }) => ({
    id,
    name,
    ...(description?.trim() ? { description: description.trim() } : {}),
  }));
}
