export function isJsonBypass(pathname: string): boolean {
  return pathname.endsWith('.json');
}
