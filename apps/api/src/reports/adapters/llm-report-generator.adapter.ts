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

  hasProvider(): boolean {
    return this.generator.hasProvider();
  }

  configuration() {
    return this.generator.configuration();
  }

  private async translate<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ReportCancelledError) {
        throw new ReportGenerationError("CANCELLED", usage(error), {
          cause: error,
        });
      }
      if (error instanceof InvalidLlmOutputError) {
        throw new ReportGenerationError("INVALID_LLM_OUTPUT", usage(error), {
          cause: error,
        });
      }
      if (
        error instanceof LlmUnavailableError ||
        error instanceof UnknownProviderError
      ) {
        throw new ReportGenerationError("LLM_UNAVAILABLE", usage(error), {
          cause: error,
        });
      }
      throw error;
    }
  }
}

function usage(error: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (typeof error !== "object" || error === null)
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const value = (candidate: unknown) =>
    Number.isInteger(candidate) && Number(candidate) >= 0
      ? Number(candidate)
      : 0;
  return {
    promptTokens: value((error as { promptTokens?: unknown }).promptTokens),
    completionTokens: value(
      (error as { completionTokens?: unknown }).completionTokens,
    ),
    totalTokens: value((error as { totalTokens?: unknown }).totalTokens),
  };
}

export function createLlmReportGeneratorAdapter(): ReportGeneratorPort {
  return new LlmReportGeneratorAdapter(new ReportGenerator());
}
