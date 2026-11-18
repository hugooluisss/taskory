import { ReportActivity } from "./report-activity";
import { ChunkEvaluation } from "./chunk-evaluation";
import { MemoryChunk } from "./memory-chunk";
import { ReportTotals } from "./report-totals";

export interface ReportGeneratorPort {
  generate(options: {
    activities: ReportActivity[];
    from: string;
    to: string;
    projectIds?: string[];
    language: "es" | "en";
    style: "summary" | "detailed";
  }): Promise<{
    markdown: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
  hasProvider(): boolean;
  configuration(): { provider: string; model: string };
  evaluateChunk(options: {
    activities: ReportActivity[];
    language: "es" | "en";
    signal?: AbortSignal;
  }): Promise<ChunkEvaluation>;
  writeFinal(options: {
    memory: MemoryChunk[];
    totals: ReportTotals;
    from: string;
    to: string;
    projectIds?: string[];
    language: "es" | "en";
    style: "summary" | "detailed";
    signal?: AbortSignal;
  }): Promise<{
    markdown: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
}
