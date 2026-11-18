import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("projects")
@Index("projects_user_name", ["userId", "name"], { unique: true })
export class Project {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() userId!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @Column({ default: false }) archived!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
