import type { ReportOptions } from "./report-options";
import { buildReportStyleInstruction, fixedReportRules, type ReportStyle } from "./report-styles";
import { projectData } from "./report-options";
export function buildReportPrompt(options: ReportOptions): {
  system: string;
  prompt: string;
} {
  const es = options.language === "es";
  const language = options.language;
  const system = es
    ? [
        "Redacta informes claros de actividad laboral.",
        "Responde únicamente en Markdown y en español.",
      ].join(" ")
    : [
        "Write clear work activity reports.",
        "Respond only in Markdown and English.",
      ].join(" ");
  const instruction = buildReportStyleInstruction((options.style ?? "summary") as ReportStyle, language, options.customPrompt);
  const activityJson = JSON.stringify({ projects: projectData(options.projects), activities: options.activities }, null, 2).replaceAll(
    "<",
    "\\u003c",
  );
  const prompt = [
    instruction,
    fixedReportRules(language),
    es ? `Periodo solicitado: ${options.from} a ${options.to}. Proyectos incluidos: ${options.projects?.map(({name}) => name).join(", ") || "todos"}.` : `Requested period: ${options.from} to ${options.to}. Projects included: ${options.projects?.map(({name}) => name).join(", ") || "all"}.`,
    "<activity_json>",
    activityJson,
    "</activity_json>",
  ].join("\n");
  return { system, prompt };
}
