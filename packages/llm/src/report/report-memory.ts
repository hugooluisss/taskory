export type Highlight = {
  activityId: string;
  date: string;
  title: string;
  project: string | null;
  impact: "high" | "medium";
  reason: string;
};

export type ChunkEvaluation = {
  summary: string;
  highlights: Highlight[];
  provider: string;
  model: string;
};

export type MemoryChunk = {
  chunkIndex: number;
  dateFrom: string;
  dateTo: string;
  activityCount: number;
  summary: string;
  highlights: Highlight[];
  droppedHighlights?: number;
};

export type ReportTotals = {
  byProject: Record<string, number>;
  byDay: Record<string, number>;
};
