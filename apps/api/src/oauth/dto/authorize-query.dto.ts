import { IsOptional, IsString, MaxLength } from "class-validator";

export class AuthorizeQueryDto {
  @IsString()
  @MaxLength(32)
  response_type!: string;

  @IsString()
  @MaxLength(2048)
  client_id!: string;

  @IsString()
  @MaxLength(2048)
  redirect_uri!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code_challenge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code_challenge_method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  scope?: string;
}
