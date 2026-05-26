import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithContext } from '../types/request-with-context.type';
import {
  RATE_LIMIT_METADATA_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';

interface BucketEntry {
  count: number;
  resetAtMs: number;
}

class RateLimitExceededError extends Error {
  readonly statusCode = 429;

  constructor() {
    super('Too many requests. Please try again later.');
    this.name = 'RateLimitExceededError';
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, BucketEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const identifier = request.user?.sub ?? request.ip ?? 'unknown';
    const routeKey = request.originalUrl ?? request.url ?? 'unknown-route';
    const key = `${request.method}:${routeKey}:${identifier}`;

    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAtMs <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAtMs: now + options.durationSeconds * 1000,
      });
      return true;
    }

    if (current.count >= options.points) {
      throw new RateLimitExceededError();
    }

    current.count += 1;
    this.buckets.set(key, current);
    return true;
  }
}
