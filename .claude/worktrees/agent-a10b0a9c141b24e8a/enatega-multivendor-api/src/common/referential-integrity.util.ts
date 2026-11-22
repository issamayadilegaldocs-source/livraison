import { ConflictException } from '@nestjs/common';

/**
 * A dependent record group blocking a delete (e.g. `{ count: 2, label:
 * 'restaurants' }`). `label` is the plural noun; it is singularised
 * automatically when `count === 1`.
 */
export interface Dependent {
  count: number;
  label: string;
}

function singularize(label: string): string {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`;
  return label.replace(/s$/, '');
}

function describe({ count, label }: Dependent): string {
  return `${count} ${count === 1 ? singularize(label) : label}`;
}

/**
 * Referential-integrity guard. Prevents deleting a record while other records
 * still depend on it (e.g. a vendor that still owns restaurants, a category
 * that still holds products). Throws HTTP 409 Conflict when any dependent group
 * is non-empty; the message is shown verbatim to the user by the admin/mobile
 * error toasts, so keep it human-readable.
 *
 * @example
 *   assertNoDependents('vendor', { count: restaurantCount, label: 'restaurants' });
 *   assertNoDependents('zone',
 *     { count: restCount, label: 'restaurants' },
 *     { count: riderCount, label: 'riders' },
 *   );
 */
export function assertNoDependents(
  entity: string,
  ...dependents: Dependent[]
): void {
  const active = dependents.filter((d) => d.count > 0);
  if (active.length === 0) return;

  const phrase = active.map(describe).join(' and ');
  const isPlural = active.length > 1 || active[0].count > 1;

  throw new ConflictException(
    `Cannot delete this ${entity} because ${phrase} ${isPlural ? 'are' : 'is'} still attached to it. ` +
      `Please remove or reassign ${isPlural ? 'them' : 'it'} first.`,
  );
}
