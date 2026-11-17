import { Highlight } from "./highlight";

export interface MemoryChunk {
  chunkIndex: number;
  dateFrom: string;
  dateTo: string;
  activityCount: number;
  summary: string;
  highlights: Highlight[];
}
