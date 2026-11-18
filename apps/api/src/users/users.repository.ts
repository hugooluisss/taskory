import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { DuplicateEmailError } from "./duplicate-email.error";

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  findByEmailWithHash(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.email = :email", { email })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  create(email: string, name: string, passwordHash: string): Promise<User> {
    return this.users
      .save(this.users.create({ email, name, passwordHash }))
      .catch((error) => {
        if (
          error instanceof QueryFailedError &&
          (error.driverError as { code?: string; message?: string }).code ===
            "ER_DUP_ENTRY" &&
          (error.driverError as { message?: string }).message?.includes(
            "users.email",
          )
        ) {
          throw new DuplicateEmailError();
        }
        throw error;
      });
  }

  async update(
    id: string,
    values: Partial<Pick<User, "name" | "language">>,
  ): Promise<User> {
    await this.users.update({ id }, values);
    const user = await this.findById(id);
    if (!user) {
      throw new Error("User not found after update");
    }
    return user;
  }
}
