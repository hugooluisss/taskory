import { Provider } from "@nestjs/common";
import { ReportGenerator } from "@taskory/llm";

export const REPORT_GENERATOR = Symbol("REPORT_GENERATOR");

export const reportGeneratorProvider: Provider = {
  provide: REPORT_GENERATOR,
  useFactory: () => new ReportGenerator(),
};
