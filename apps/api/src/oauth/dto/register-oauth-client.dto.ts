import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class RegisterOauthClientDto {
  @IsString()
  client_name!: string;

  @IsArray()
  @IsString({ each: true })
  redirect_uris!: string[];

  @IsOptional()
  @IsIn(["none"])
  token_endpoint_auth_method?: string;

  @IsOptional()
  @IsArray()
  @IsIn(["authorization_code", "refresh_token"], { each: true })
  grant_types?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(["code"], { each: true })
  response_types?: string[];
}
