import {
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class TokenRequestDto {
  @IsDefined()
  @IsString()
  @MaxLength(32)
  grant_type!: string;

  @ValidateIf(
    (body: TokenRequestDto) => body.grant_type === "authorization_code",
  )
  @IsString()
  @MaxLength(2048)
  code?: string;

  @ValidateIf(
    (body: TokenRequestDto) => body.grant_type === "authorization_code",
  )
  @IsString()
  @MaxLength(128)
  code_verifier?: string;

  @ValidateIf(
    (body: TokenRequestDto) =>
      body.grant_type === "authorization_code" ||
      body.grant_type === "refresh_token",
  )
  @IsString()
  @MaxLength(2048)
  client_id?: string;

  @ValidateIf(
    (body: TokenRequestDto) => body.grant_type === "authorization_code",
  )
  @IsString()
  @MaxLength(2048)
  redirect_uri?: string;

  @ValidateIf((body: TokenRequestDto) => body.grant_type === "refresh_token")
  @IsString()
  @MaxLength(2048)
  refresh_token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  resource?: string;
}
