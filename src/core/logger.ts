export interface LogContext {
  traceId: string;
  route: string;
  upstreamUrl?: string;
  articleSlug?: string;
  status: number;
  cacheStatus?: string;
  transformMs?: number;
  bytesIn?: number;
  bytesOut?: number;
  tokenEstimate?: number;
  rendererVersion?: string;
}

export function logRequest(ctx: LogContext): void {
  console.log(JSON.stringify(ctx));
}
