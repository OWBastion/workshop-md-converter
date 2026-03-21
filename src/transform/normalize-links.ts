function ensureMarkdownPath(pathname: string): string {
  if (!pathname.startsWith('/wiki/articles/')) return pathname;
  return pathname.endsWith('.md') ? pathname : `${pathname}.md`;
}

function toProxyArticleUrl(target: URL, publicBaseUrl: string): string {
  const proxy = new URL(publicBaseUrl);
  const path = ensureMarkdownPath(target.pathname);
  return `${proxy.origin}${path}${target.search}${target.hash}`;
}

function mapLinkTarget(target: string, publicBaseUrl: string): string {
  const trimmed = target.trim();

  if (trimmed.startsWith('/wiki/articles/')) {
    const parsed = new URL(trimmed, publicBaseUrl);
    return toProxyArticleUrl(parsed, publicBaseUrl);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const isWorkshopHost = parsed.hostname === 'workshop.codes' || parsed.hostname === 'www.workshop.codes';
    if (isWorkshopHost && parsed.pathname.startsWith('/wiki/articles/')) {
      return toProxyArticleUrl(parsed, publicBaseUrl);
    }
  }

  return target;
}

export function normalizeLinks(markdown: string, publicBaseUrl: string): string {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_whole: string, text: string, target: string) => {
    const mapped = mapLinkTarget(target, publicBaseUrl);
    return `[${text}](${mapped})`;
  });
}
