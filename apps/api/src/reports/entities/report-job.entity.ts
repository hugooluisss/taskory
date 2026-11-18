import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ReportJobParams } from "./report-job-params";

export type ReportJobStatus = "queued" | "running" | "completed" | "failed";

@Entity("report_jobs")
@Index("report_jobs_id_user", ["id", "userId"], { unique: true })
@Index("report_jobs_active_user", ["userId"], {
  unique: true,
  where: "status IN ('queued', 'running')",
})
export class ReportJob {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() userId!: string;
  @Column() status!: ReportJobStatus;
  @Column({ type: "simple-json" }) params!: ReportJobParams;
  @Column({ type: "simple-json" }) activityIds!: string[];
  @Column() chunkSize!: number;
  @Column({ default: 0 }) progressDone!: number;
  @Column() progressTotal!: number;
  @Column({ type: "text", nullable: true }) markdown!: string | null;
  @Column({ type: "text", nullable: true }) provider!: string | null;
  @Column({ type: "text", nullable: true }) model!: string | null;
  @Column({ type: "text", nullable: true }) errorCode!: string | null;
  @Column({ type: "integer", nullable: true }) errorChunk!: number | null;
  @CreateDateColumn() createdAt!: Date;
  @Column({ type: "datetime", nullable: true }) finishedAt!: Date | null;
  @Column({ type: "integer", default: 0 }) totalTokens!: number;
  @Column({ type: "integer", default: 0 }) promptTokens!: number;
  @Column({ type: "integer", default: 0 }) completionTokens!: number;
  @Column({ type: "integer", default: 0 }) costMicros!: number;
}
