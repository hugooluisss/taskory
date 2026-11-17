import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("api_keys")
@Index(["keyHash"], { unique: true })
export class ApiKey {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() userId!: string;
  @Column() name!: string;
  @Column() prefix!: string;
  @Column() keyHash!: string;
  @Column({ type: "datetime", nullable: true }) lastUsedAt!: Date | null;
  @Column({ type: "datetime", nullable: true }) revokedAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
}
