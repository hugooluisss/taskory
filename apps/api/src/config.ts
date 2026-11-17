import { getPublicUrl } from "./oauth/public-url";

export function validateConfig(): void {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  getPublicUrl();
}
