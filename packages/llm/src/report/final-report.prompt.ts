import type { MemoryChunk, ReportTotals } from "./report-memory";
import { buildReportStyleInstruction, fixedReportRules, type ReportStyle } from "./report-styles";
import { projectData } from "./report-options";

export function buildFinalReportPrompt(options: {
  memory: MemoryChunk[];
  totals: ReportTotals;
  from: string;
  to: string;
  projects?: import("./report-options").ReportProject[];
  language: "es" | "en";
  style: ReportStyle;
  customPrompt?: string;
}): { system: string; prompt: string } {
  const spanish = options.language === "es";
  const data = JSON.stringify(
    {
      memory: options.memory,
      totals: options.totals,
      projects: projectData(options.projects),
    },
    null,
    2,
  ).replaceAll("<", "\\u003c");
  const system = spanish
    ? "Redacta informes claros de actividad laboral. Responde únicamente en Markdown y en español."
    : "Write clear work activity reports. Respond only in Markdown and English.";
  const instruction = buildReportStyleInstruction(options.style, options.language, options.customPrompt);
  return {
    system,
    prompt: [
      "TASK: FINAL_REPORT",
      instruction,
      fixedReportRules(options.language),
      spanish ? `Periodo solicitado: ${options.from} a ${options.to}. Proyectos seleccionados: ${options.projects?.map(({name}) => name).join(", ") || "todos"}.` : `Requested period: ${options.from} to ${options.to}. Selected projects: ${options.projects?.map(({name}) => name).join(", ") || "all"}.`,
      "<memory_json>",
      data,
      "</memory_json>",
    ].join("\n"),
  };
}
