import { ReportActivity } from "./report-activity";
import { ChunkEvaluation } from "./chunk-evaluation";
import { MemoryChunk } from "./memory-chunk";
import { ReportTotals } from "./report-totals";

export interface ReportGeneratorPort {
  generate(options: {
    activities: ReportActivity[];
    from: string;
    to: string;
    projects?: string[];
    language: "es" | "en";
    provider?: string;
    model?: string;
    style: "summary" | "detailed";
  }): Promise<{ markdown: string; provider: string; model: string }>;
  hasProvider(id?: string): boolean;
  listProviders(): Promise<
    { id: string; defaultModel: string; available: boolean }[]
  >;
  evaluateChunk(options: {
    activities: ReportActivity[];
    language: "es" | "en";
    provider?: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<ChunkEvaluation>;
  writeFinal(options: {
    memory: MemoryChunk[];
    totals: ReportTotals;
    from: string;
    to: string;
    projects?: string[];
    language: "es" | "en";
    style: "summary" | "detailed";
    provider?: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{ markdown: string; provider: string; model: string }>;
}
