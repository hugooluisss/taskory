import { Highlight } from "./highlight";

export interface ChunkEvaluation {
  summary: string;
  highlights: Highlight[];
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
