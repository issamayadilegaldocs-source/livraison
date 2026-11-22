import { FieldMiddleware, MiddlewareContext, NextFn } from '@nestjs/graphql';

/**
 * Global fallback for `id` fields: Mongoose `.lean()` documents carry `_id`
 * but not the `id` virtual, so code-first models exposing both fields resolve
 * `id` to null. Apollo InMemoryCache on the clients normalizes entities by
 * `id` BEFORE `_id`, so a null `id` collapses every object of a type into a
 * single cache entry (e.g. `Order:null`) — lists render duplicated data and
 * mutation/subscription updates (which select `_id` only) never reach the
 * rendered rows. When a selected `id` resolves null-ish, mirror the source's
 * `_id` instead.
 */
export const idFallbackMiddleware: FieldMiddleware = async (
  ctx: MiddlewareContext,
  next: NextFn,
) => {
  const value = await next();
  if (value == null && ctx.info.fieldName === 'id') {
    const fallback = (ctx.source as { _id?: unknown } | undefined)?._id;
    if (fallback != null) return String(fallback);
  }
  return value;
};
