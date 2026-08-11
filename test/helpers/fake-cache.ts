import { vi } from 'vitest';

/**
 * In-memory stand-in for the Workers Cache API (`caches.open` / `caches.default`).
 * Keys are the request URL strings, values are cloned responses.
 */
export class FakeCache {
  private entries = new Map<string, Response>();

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(keyOf(input));
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(keyOf(input), response.clone());
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(keyOf(input));
  }

  get size(): number {
    return this.entries.size;
  }
}

function keyOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

export function stubCaches(fake: FakeCache): void {
  vi.stubGlobal('caches', {
    default: fake,
    open: async () => fake,
  });
}

/**
 * Fake `ExecutionContext` that records `waitUntil` promises so tests can
 * deterministically drain cache writes before asserting on them.
 */
export function makeCtx(): {
  ctx: { waitUntil(promise: Promise<unknown>): void };
  flush(): Promise<void>;
} {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
    },
    flush: async () => {
      await Promise.all(pending.splice(0));
    },
  };
}
