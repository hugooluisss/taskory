import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OAuthClient } from "./oauth-client.entity";

@Entity("oauth_authorization_requests")
export class OAuthAuthorizationRequest {
  @ManyToOne(() => OAuthClient, { onDelete: "CASCADE" })
  @JoinColumn({ name: "clientId", referencedColumnName: "id" })
  client?: OAuthClient;

  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() clientId!: string;
  @Column() redirectUri!: string;
  @Column() codeChallenge!: string;
  @Column({ type: "text", nullable: true }) state!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "datetime", nullable: true }) decidedAt!: Date | null;
}
