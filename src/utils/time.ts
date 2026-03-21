export function toHttpDate(dateText?: string): string | undefined {
  if (!dateText) return undefined;
  const t = Date.parse(dateText);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toUTCString();
}
