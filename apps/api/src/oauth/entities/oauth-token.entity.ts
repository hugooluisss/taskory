import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OAuthAuthorization } from "./oauth-authorization.entity";
import { OAuthAuthorizationCode } from "./oauth-authorization-code.entity";

export type OAuthTokenKind = "access" | "refresh";

@Entity("oauth_tokens")
@Index(["tokenHash"], { unique: true })
export class OAuthToken {
  @ManyToOne(() => OAuthAuthorization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorizationId", referencedColumnName: "id" })
  authorization?: OAuthAuthorization;

  @ManyToOne(() => OAuthAuthorizationCode, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "codeId", referencedColumnName: "id" })
  code?: OAuthAuthorizationCode | null;

  @ManyToOne(() => OAuthToken, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "parentTokenId", referencedColumnName: "id" })
  parentToken?: OAuthToken | null;

  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() authorizationId!: string;
  @Column() kind!: OAuthTokenKind;
  @Column() tokenHash!: string;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "datetime", nullable: true }) revokedAt!: Date | null;
  @Column({ type: "datetime", nullable: true }) rotatedAt!: Date | null;
  @Column({ type: "text", nullable: true }) parentTokenId!: string | null;
  @Column({ type: "text", nullable: true }) codeId!: string | null;
  @Column({ type: "datetime", nullable: true }) lastUsedAt!: Date | null;
}
