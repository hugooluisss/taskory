import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Highlight } from "../ports/highlight";
import { ReportJob } from "./report-job.entity";

@Entity("report_memory")
export class ReportMemory {
  @ManyToOne(() => ReportJob, { onDelete: "CASCADE" })
  @JoinColumn([
    { name: "reportId", referencedColumnName: "id" },
    { name: "userId", referencedColumnName: "userId" },
  ])
  report?: ReportJob;

  @PrimaryColumn() reportId!: string;
  @PrimaryColumn() userId!: string;
  @PrimaryColumn() chunkIndex!: number;
  @Column({ type: "date" }) dateFrom!: string;
  @Column({ type: "date" }) dateTo!: string;
  @Column() activityCount!: number;
  @Column({ type: "text" }) summary!: string;
  @Column({ type: "simple-json" }) highlights!: Highlight[];
  @Column({ type: "simple-json" }) byProject!: Record<string, number>;
  @Column({ type: "simple-json" }) byDay!: Record<string, number>;
  @Column({ type: "integer", default: 0 }) totalTokens!: number;
  @Column({ type: "integer", default: 0 }) promptTokens!: number;
  @Column({ type: "integer", default: 0 }) completionTokens!: number;
}
