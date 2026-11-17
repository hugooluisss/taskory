import { QueryFailedError } from "typeorm";

export class OAuthPersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OAuthPersistenceError";
  }
}

export function translateConstraint(error: unknown): never {
  if (error instanceof QueryFailedError) {
    throw new OAuthPersistenceError("OAuth persistence constraint failed", {
      cause: error,
    });
  }
  throw error;
}
