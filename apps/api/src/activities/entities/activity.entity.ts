import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("activities")
export class Activity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() userId!: string;
  @Column({ type: "date" }) date!: string;
  @Column() title!: string;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @Column({ type: "simple-json" }) referenceUrls!: string[];
  @Column({ type: "simple-json" }) tags!: string[];
  @Column({ type: "text", nullable: true }) project!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
