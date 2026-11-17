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
import { OAuthClient } from "./oauth-client.entity";

@Entity("oauth_authorizations")
@Index(["userId", "id"], { unique: true })
export class OAuthAuthorization {
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId", referencedColumnName: "id" })
  user?: User;

  @ManyToOne(() => OAuthClient, { onDelete: "CASCADE" })
  @JoinColumn({ name: "clientId", referencedColumnName: "id" })
  client?: OAuthClient;

  @PrimaryGeneratedColumn("uuid")
  id!: string;
  @Column()
  userId!: string;
  @Column()
  clientId!: string;
  @Column()
  resource!: string;
  @CreateDateColumn()
  createdAt!: Date;
  @Column({ type: "datetime", nullable: true })
  lastUsedAt!: Date | null;
  @Column({ type: "datetime", nullable: true })
  revokedAt!: Date | null;
}
