import {
  InvalidLlmOutputError,
  LlmUnavailableError,
  ReportCancelledError,
  ReportGenerator,
  UnknownProviderError,
} from "@taskory/llm";
import { ReportGenerationError } from "../ports/report-generation-error";
import { ReportGeneratorPort } from "../ports/report-generator.port";

export class LlmReportGeneratorAdapter implements ReportGeneratorPort {
  constructor(private readonly generator: ReportGenerator) {}

  generate(options: Parameters<ReportGeneratorPort["generate"]>[0]) {
    return this.translate(() =>
      this.generator.generate({
        ...options,
        style: options.style ?? "summary",
      }),
    );
  }

  evaluateChunk(options: Parameters<ReportGeneratorPort["evaluateChunk"]>[0]) {
    return this.translate(() => this.generator.evaluateChunk(options));
  }

  writeFinal(options: Parameters<ReportGeneratorPort["writeFinal"]>[0]) {
    return this.translate(() =>
      this.generator.writeFinal({
        ...options,
        style: options.style ?? "summary",
      }),
    );
  }

  hasProvider(id?: string): boolean {
    return this.generator.hasProvider(id);
  }

  listProviders() {
    return this.generator.listProviders();
  }

  private async translate<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ReportCancelledError) {
        throw new ReportGenerationError("CANCELLED", { cause: error });
      }
      if (error instanceof InvalidLlmOutputError) {
        throw new ReportGenerationError("INVALID_LLM_OUTPUT", { cause: error });
      }
      if (
        error instanceof LlmUnavailableError ||
        error instanceof UnknownProviderError
      ) {
        throw new ReportGenerationError("LLM_UNAVAILABLE", { cause: error });
      }
      throw error;
    }
  }
}

export function createLlmReportGeneratorAdapter(): ReportGeneratorPort {
  return new LlmReportGeneratorAdapter(new ReportGenerator());
}
