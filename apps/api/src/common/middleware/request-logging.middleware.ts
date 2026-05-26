import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { logStructured } from '../logging/structured-log.util';
import { RequestWithContext } from '../types/request-with-context.type';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const startedAt = Date.now();

    res.on('finish', () => {
      logStructured('info', 'http.request.completed', {
        requestId: req.requestId ?? null,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        userId: req.user?.sub ?? null,
      });
    });

    next();
  }
}
