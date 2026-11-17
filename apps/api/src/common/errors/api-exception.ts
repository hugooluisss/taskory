import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super({ code, ...details }, status);
  }
}
