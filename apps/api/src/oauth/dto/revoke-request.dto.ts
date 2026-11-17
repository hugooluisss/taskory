import { IsOptional, IsString, MaxLength } from "class-validator";

export class RevokeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  token_type_hint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  client_id?: string;
}
