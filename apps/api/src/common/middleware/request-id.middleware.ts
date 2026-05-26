import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import {
  runWithRequestContext,
  type RequestContext,
} from '../context/request-context';
import { RequestWithContext } from '../types/request-with-context.type';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = this.resolveRequestId(incoming);
    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const context: RequestContext = { requestId };
    runWithRequestContext(context, () => next());
  }

  private resolveRequestId(incoming?: string): string {
    if (typeof incoming !== 'string') {
      return randomUUID();
    }

    const trimmed = incoming.trim();
    if (!trimmed || trimmed.length > 128) {
      return randomUUID();
    }

    return trimmed;
  }
}
