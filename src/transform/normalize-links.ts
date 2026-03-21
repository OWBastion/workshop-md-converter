export function normalizeLinks(markdown: string, baseUrl: string): string {
  return markdown.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, (_, text: string, path: string) => {
    return `[${text}](${new URL(path, baseUrl).toString()})`;
  });
}
