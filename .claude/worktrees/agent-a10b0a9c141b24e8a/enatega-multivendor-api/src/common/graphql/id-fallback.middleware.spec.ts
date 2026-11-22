import { idFallbackMiddleware } from './id-fallback.middleware';

describe('idFallbackMiddleware', () => {
  const ctx = (fieldName: string, source: unknown) =>
    ({ info: { fieldName }, source }) as never;

  it('mirrors _id when a selected id resolves null', async () => {
    await expect(
      idFallbackMiddleware(ctx('id', { _id: 'abc123' }), async () => null),
    ).resolves.toBe('abc123');
  });

  it('stringifies ObjectId-like _id values', async () => {
    const objectIdLike = { toString: () => '6a4e03c56e15b4e415258cf3' };
    await expect(
      idFallbackMiddleware(ctx('id', { _id: objectIdLike }), async () => undefined),
    ).resolves.toBe('6a4e03c56e15b4e415258cf3');
  });

  it('keeps a real id value untouched', async () => {
    await expect(
      idFallbackMiddleware(ctx('id', { _id: 'abc' }), async () => 'explicit'),
    ).resolves.toBe('explicit');
  });

  it('leaves non-id fields and sources without _id alone', async () => {
    await expect(
      idFallbackMiddleware(ctx('title', { _id: 'abc' }), async () => null),
    ).resolves.toBeNull();
    await expect(
      idFallbackMiddleware(ctx('id', {}), async () => null),
    ).resolves.toBeNull();
    await expect(
      idFallbackMiddleware(ctx('id', undefined), async () => null),
    ).resolves.toBeNull();
  });
});
