import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OAuthAuthorization } from "./oauth-authorization.entity";

@Entity("oauth_authorization_codes")
@Index(["codeHash"], { unique: true })
export class OAuthAuthorizationCode {
  @ManyToOne(() => OAuthAuthorization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorizationId", referencedColumnName: "id" })
  authorization?: OAuthAuthorization;

  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() authorizationId!: string;
  @Column() codeHash!: string;
  @Column() codeChallenge!: string;
  @Column() redirectUri!: string;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "datetime", nullable: true }) usedAt!: Date | null;
}
