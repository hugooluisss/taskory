import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ unique: true }) email!: string;
  @Column() name!: string;
  @Column({ select: false }) passwordHash!: string;
  @Column({ default: "en" }) language!: "es" | "en";
  @Column({ type: "text", nullable: true }) customReportPrompt?: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
