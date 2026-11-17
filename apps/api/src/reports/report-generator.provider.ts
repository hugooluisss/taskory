import { Provider } from "@nestjs/common";
import { createLlmReportGeneratorAdapter } from "./adapters/llm-report-generator.adapter";
import { ReportGeneratorPort } from "./ports/report-generator.port";

export const REPORT_GENERATOR = Symbol("REPORT_GENERATOR");

export const reportGeneratorProvider: Provider<ReportGeneratorPort> = {
  provide: REPORT_GENERATOR,
  useFactory: createLlmReportGeneratorAdapter,
};
