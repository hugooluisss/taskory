import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class OAuthCorsMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const path = request.path;
    const allowed =
      path.startsWith("/.well-known/") ||
      ["/oauth/token", "/oauth/register", "/oauth/revoke"].includes(path);
    if (!allowed) return next();
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    response.setHeader("Access-Control-Max-Age", "86400");
    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }
    next();
  }
}
