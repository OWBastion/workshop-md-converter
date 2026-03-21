export function healthRoute(pathname: string): Response | undefined {
  if (pathname !== '/healthz') return undefined;
  return new Response('ok', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
