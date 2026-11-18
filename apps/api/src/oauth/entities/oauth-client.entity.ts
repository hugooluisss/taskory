import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("oauth_clients")
export class OAuthClient {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() name!: string;
  @Column({ type: "json" }) redirectUris!: string[];
  @CreateDateColumn() createdAt!: Date;
}
