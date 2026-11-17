import { Controller, Get, NotFoundException, Req } from "@nestjs/common";
import type { Request } from "express";
import { getMcpPath, getMcpResource, getPublicUrl } from "./public-url";

@Controller()
export class OAuthMetadataController {
  @Get("/.well-known/oauth-authorization-server")
  authorizationServer() {
    const issuer = getPublicUrl();
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["taskory"],
      authorization_response_iss_parameter_supported: true,
    };
  }

  @Get("/.well-known/oauth-protected-resource")
  protectedResourceAlias() {
    return this.resourceMetadata();
  }

  @Get("/.well-known/oauth-protected-resource/{*path}")
  protectedResource(@Req() request: Request) {
    if (
      request.path !== `/.well-known/oauth-protected-resource${getMcpPath()}`
    ) {
      throw new NotFoundException();
    }
    return this.resourceMetadata();
  }

  private resourceMetadata() {
    const issuer = getPublicUrl();
    return {
      resource: getMcpResource(),
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
    };
  }
}
