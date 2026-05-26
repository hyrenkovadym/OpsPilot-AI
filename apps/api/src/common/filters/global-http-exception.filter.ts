import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getRequestId } from '../context/request-context';
import { safeErrorMessage } from '../logging/structured-log.util';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';
import { RequestWithContext } from '../types/request-with-context.type';

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
  requestId: string | null;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType<'http' | 'ws' | 'rpc'>() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithContext>();
    const response = ctx.getResponse<Response>();

    const statusCode = this.resolveStatusCode(exception);
    const message = this.resolveMessage(exception, statusCode);
    const requestId =
      request.requestId ??
      this.extractHeaderRequestId(request) ??
      getRequestId() ??
      null;

    if (requestId) {
      response.setHeader(REQUEST_ID_HEADER, requestId);
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.status(statusCode).json(body);
  }

  private resolveStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (
      typeof exception === 'object' &&
      exception !== null &&
      typeof (exception as { statusCode?: unknown }).statusCode === 'number'
    ) {
      return (exception as { statusCode: number }).statusCode;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null) {
        const message = (response as { message?: string | string[] }).message;
        if (Array.isArray(message)) {
          return message.join(', ');
        }
        if (typeof message === 'string') {
          return message;
        }
      }
      return exception.message;
    }

    if (
      typeof exception === 'object' &&
      exception !== null &&
      typeof (exception as { message?: unknown }).message === 'string'
    ) {
      return (exception as { message: string }).message;
    }

    if (statusCode >= 500) {
      return 'Internal server error';
    }

    return safeErrorMessage(exception, 'Request failed');
  }

  private extractHeaderRequestId(request: Request): string | null {
    const raw = request.header(REQUEST_ID_HEADER);
    if (!raw) {
      return null;
    }
    return raw.trim() || null;
  }
}
