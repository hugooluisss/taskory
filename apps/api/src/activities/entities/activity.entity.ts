import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinTable,
  ManyToMany,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";

@Entity("activities")
export class Activity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() userId!: string;
  @Column({ type: "date" }) date!: string;
  @Column() title!: string;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @Column({ type: "json" }) referenceUrls!: string[];
  @Column({ type: "json" }) tags!: string[];
  @ManyToMany(() => Project)
  @JoinTable({
    name: "activity_projects",
    joinColumn: {
      name: "activityId",
      referencedColumnName: "id",
      foreignKeyConstraintName: "FK_activity_projects_activity",
    },
    inverseJoinColumn: {
      name: "projectId",
      referencedColumnName: "id",
      foreignKeyConstraintName: "FK_activity_projects_project",
    },
  })
  projects!: Project[];
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
