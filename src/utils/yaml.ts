import YAML from 'yaml';

export function toFrontMatter(data: Record<string, unknown>): string {
  return `---\n${YAML.stringify(data).trimEnd()}\n---`;
}
