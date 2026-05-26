type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error';

type StructuredLogPayload = Record<string, unknown>;

export function logStructured(
  level: StructuredLogLevel,
  event: string,
  payload: StructuredLogPayload = {},
): void {
  const row = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const line = JSON.stringify(row);
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function safeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]').slice(0, 240);
}
