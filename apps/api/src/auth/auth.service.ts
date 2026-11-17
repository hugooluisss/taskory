import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { AUTH_TOKEN_EXPIRY } from "./auth.constants";
import { PublicUser } from "./public-user";
import { ERROR_CODES } from "../common/errors/error-codes";
import { ApiException } from "../common/errors/api-exception";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { DuplicateEmailError } from "../users/duplicate-email.error";

@Injectable()
export class AuthService {
  constructor(private readonly profiles: UsersService) {}

  async register(
    email: string,
    name: string,
    password: string,
  ): Promise<{ token: string; user: PublicUser }> {
    let user: User;
    try {
      user = await this.profiles.register(
        email,
        name,
        await bcrypt.hash(password, 12),
      );
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ApiException(409, ERROR_CODES.EMAIL_TAKEN);
      }
      throw error;
    }
    return { token: this.sign(user.id), user: this.publicUser(user) };
  }
  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: PublicUser }> {
    const user = await this.profiles.findByEmailWithHash(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiException(401, ERROR_CODES.INVALID_CREDENTIALS);
    }
    return { token: this.sign(user.id), user: this.publicUser(user) };
  }

  async authenticate(token: string): Promise<PublicUser> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.secret(), {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
      }
      throw error;
    }
    if (!payload.sub) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    const user = await this.profiles.findById(payload.sub);
    if (!user) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    return this.publicUser(user);
  }

  async profile(id: string): Promise<PublicUser> {
    const user = await this.profiles.findById(id);
    if (!user) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    return this.publicUser(user);
  }

  async updateProfile(
    id: string,
    values: Partial<Pick<User, "name" | "language">>,
  ): Promise<PublicUser> {
    const user = await this.profiles.update(id, values);
    return this.publicUser(user);
  }

  private sign(id: string): string {
    return jwt.sign({}, this.secret(), {
      algorithm: "HS256",
      subject: id,
      expiresIn: AUTH_TOKEN_EXPIRY,
    });
  }

  private secret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is required");
    }
    return secret;
  }

  private publicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      language: user.language,
    };
  }
}
