import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export type ReportRunStatus = "completed" | "failed";

@Entity("report_runs")
@Index("report_runs_user_created", ["userId", "createdAt"])
export class ReportRun {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "userId",
    foreignKeyConstraintName: "FK_report_runs_user",
  })
  user?: User;
  @Column() userId!: string;
  @Column({ type: "text", nullable: true }) jobId!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @Column({ type: "date" }) from!: string;
  @Column({ type: "date" }) to!: string;
  @Column({ type: "json" }) projectIds!: string[];
  @Column() language!: "es" | "en";
  @Column() style!: "summary" | "detailed" | "custom";
  @Column() provider!: string;
  @Column() model!: string;
  @Column({ type: "integer" }) promptTokens!: number;
  @Column({ type: "integer" }) completionTokens!: number;
  @Column({ type: "integer" }) totalTokens!: number;
  @Column({ type: "integer" }) costMicros!: number;
  @Column({ type: "integer" }) activityCount!: number;
  @Column() status!: ReportRunStatus;
}
