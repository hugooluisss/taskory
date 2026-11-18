import { Injectable } from "@nestjs/common";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";
import { DuplicateEmailError } from "./duplicate-email.error";

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async saveCustomReportPrompt(id: string, prompt: string): Promise<void> {
    await this.users.saveCustomReportPrompt(id, prompt);
  }

  findByEmailWithHash(email: string): Promise<User | null> {
    return this.users.findByEmailWithHash(email.trim().toLowerCase());
  }

  async register(
    email: string,
    name: string,
    passwordHash: string,
  ): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.users.findByEmail(normalizedEmail)) {
      throw new DuplicateEmailError();
    }
    return this.users.create(normalizedEmail, name, passwordHash);
  }

  update(
    id: string,
    values: Partial<Pick<User, "name" | "language">>,
  ): Promise<User> {
    return this.users.update(id, values);
  }
}
