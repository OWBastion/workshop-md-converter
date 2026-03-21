export function negotiateMarkdown(request: Request, pathname: string): boolean {
  if (pathname.endsWith('.md')) return true;
  const accept = request.headers.get('accept') ?? '';
  return accept.toLowerCase().includes('text/markdown');
}
