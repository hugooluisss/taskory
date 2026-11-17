import { Injectable } from "@nestjs/common";
import {
  OAUTH_CLIENT_NAME_MAX_LENGTH,
  OAUTH_REDIRECT_URIS_MAX_COUNT,
} from "./constants";
import { OAuthError } from "./oauth-error";
import { OAuthClient } from "./entities/oauth-client.entity";
import { OAuthClientsRepository } from "./oauth-clients.repository";
import { validateRedirectUri } from "./redirect-uri.validator";

@Injectable()
export class ClientRegistrationService {
  constructor(private readonly clients: OAuthClientsRepository) {}

  async register(input: {
    client_name: string;
    redirect_uris: string[];
    token_endpoint_auth_method?: string;
    grant_types?: string[];
    response_types?: string[];
  }): Promise<OAuthClient> {
    if (
      (input.token_endpoint_auth_method !== undefined &&
        input.token_endpoint_auth_method !== "none") ||
      input.grant_types?.some(
        (grant) => !["authorization_code", "refresh_token"].includes(grant),
      ) ||
      (input.response_types !== undefined &&
        (input.response_types.length !== 1 ||
          input.response_types[0] !== "code")) ||
      typeof input.client_name !== "string" ||
      input.client_name.trim().length < 1 ||
      input.client_name.length > OAUTH_CLIENT_NAME_MAX_LENGTH ||
      !Array.isArray(input.redirect_uris) ||
      input.redirect_uris.length < 1 ||
      input.redirect_uris.length > OAUTH_REDIRECT_URIS_MAX_COUNT
    ) {
      throw new OAuthError(
        "invalid_client_metadata",
        "Client metadata is invalid.",
        400,
      );
    }
    const redirectUris = new Set<string>();
    for (const uri of input.redirect_uris) {
      if (typeof uri !== "string" || !validateRedirectUri(uri).valid) {
        throw new OAuthError(
          "invalid_redirect_uri",
          "A redirect URI is invalid.",
          400,
        );
      }
      redirectUris.add(uri);
    }
    return this.clients.create({
      name: input.client_name,
      redirectUris: [...redirectUris],
    });
  }
}
