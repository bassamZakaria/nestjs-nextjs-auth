import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

export enum ErrorMessage {
  InternalServerError = 'Internal server error',
}

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

const statusText = (status: number) => STATUS_CODES[status] ?? 'Error';

const messageOf = (exception: HttpException): string | string[] => {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  const { message } = response as { message?: unknown };
  const isMessage =
    typeof message === 'string' ||
    (Array.isArray(message) && message.every((m) => typeof m === 'string'));
  return isMessage ? message : statusText(exception.getStatus());
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(this.toStatus(exception)).json(this.toBody(exception));
  }

  private toStatus(exception: unknown) {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        error: statusText(statusCode),
        message: messageOf(exception),
      };
    }
    this.logger.error(exception);
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    return {
      statusCode,
      error: statusText(statusCode),
      message: ErrorMessage.InternalServerError,
    };
  }
}
