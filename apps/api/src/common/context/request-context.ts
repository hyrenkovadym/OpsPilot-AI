import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return requestContextStore.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}
