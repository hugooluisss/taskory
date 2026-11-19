import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ERROR_CODES } from "./error-codes";
import { messages } from "../i18n/messages";
import { OAuthError } from "../../oauth/oauth-error";
import { OAuthRequestNotFoundError } from "../../oauth/oauth-domain.error";

@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const path = request.path ?? request.url ?? "";
    if (path === "/oauth/token") {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
    }
    if (exception instanceof OAuthRequestNotFoundError) {
      const language = /^es(?:-|$)/i.test(
        request.headers["accept-language"] ?? "",
      )
        ? "es"
        : "en";
      response.status(404).json({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: messages[language][ERROR_CODES.NOT_FOUND],
      });
      return;
    }
    if (path.startsWith("/oauth/") || path.startsWith("/.well-known/")) {
      if (exception instanceof OAuthError) {
        response.status(exception.httpStatus).json({
          error: exception.error,
          error_description: exception.description,
        });
        return;
      }
      if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const body = exception.getResponse();
        const rawCode =
          typeof body === "object" && body !== null && "code" in body
            ? String(body.code)
            : "";
        const error =
          status === 429
            ? "rate_limit_exceeded"
            : rawCode === "invalid_client_metadata" ||
                path === "/oauth/register"
              ? "invalid_client_metadata"
              : "invalid_request";
        response.status(status).json({
          error,
          error_description: "The request is invalid.",
        });
        return;
      }
      response.status(500).json({ error: "server_error" });
      return;
    }
    const statusCode = this.statusCode(exception);
    const body =
      exception instanceof HttpException ? exception.getResponse() : {};
    const suppliedCode =
      typeof body === "object" && body !== null && "code" in body
        ? String(body.code)
        : undefined;
    let code = suppliedCode;
    if (!code && statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
      code = ERROR_CODES.PAYLOAD_TOO_LARGE;
    } else if (!code && statusCode >= 400 && statusCode < 500) {
      code =
        statusCode === HttpStatus.TOO_MANY_REQUESTS
          ? ERROR_CODES.TOO_MANY_REQUESTS
          : statusCode === HttpStatus.UNAUTHORIZED
            ? ERROR_CODES.UNAUTHORIZED
            : statusCode === HttpStatus.NOT_FOUND
              ? ERROR_CODES.NOT_FOUND
              : ERROR_CODES.VALIDATION_ERROR;
    } else if (!code) {
      code = ERROR_CODES.INTERNAL_ERROR;
    }
    const language = /^es(?:-|$)/i.test(
      request.headers["accept-language"] ?? "",
    )
      ? "es"
      : "en";
    const message =
      messages[language][code] ??
      messages[language][ERROR_CODES.INTERNAL_ERROR];
    const details =
      typeof body === "object" && body !== null && "id" in body
        ? { id: body.id }
        : {};
    response.status(statusCode).json({ statusCode, code, message, ...details });
  }

  private statusCode(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (typeof exception !== "object" || exception === null) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }
    const error = exception as { status?: unknown; statusCode?: unknown };
    const status = error.statusCode ?? error.status;
    return typeof status === "number" && status >= 400 && status < 600
      ? status
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
