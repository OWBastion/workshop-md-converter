export function buildCacheKey(pathname: string, acceptVariant: string, rendererVersion: string): string {
  return `${pathname}::${acceptVariant}::${rendererVersion}`;
}
