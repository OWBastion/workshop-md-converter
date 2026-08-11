import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/utils/hash';

describe('sha256Hex', () => {
  it('produces a stable 64-character lowercase hex digest', async () => {
    const digest = await sha256Hex('hello world');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(await sha256Hex('hello world'));
  });

  it('changes when the input changes', async () => {
    expect(await sha256Hex('a')).not.toBe(await sha256Hex('b'));
    expect(await sha256Hex('hello world')).not.toBe(await sha256Hex('hello world!'));
  });
});
