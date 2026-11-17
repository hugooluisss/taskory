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

@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : {};
    const suppliedCode =
      typeof body === "object" && body !== null && "code" in body
        ? String(body.code)
        : undefined;
    let code = suppliedCode;
    if (!code && statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      code = ERROR_CODES.TOO_MANY_REQUESTS;
    } else if (!code && statusCode === HttpStatus.UNAUTHORIZED) {
      code = ERROR_CODES.UNAUTHORIZED;
    } else if (!code && statusCode === HttpStatus.NOT_FOUND) {
      code = ERROR_CODES.NOT_FOUND;
    } else if (!code && statusCode === HttpStatus.BAD_REQUEST) {
      code = ERROR_CODES.VALIDATION_ERROR;
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
    response.status(statusCode).json({ statusCode, code, message });
  }
}
