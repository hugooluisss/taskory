import { SetMetadata } from "@nestjs/common";

export const JWT_ONLY = "jwt-only";
export const JwtOnly = () => SetMetadata(JWT_ONLY, true);
