import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Money, MoneyCurrency } from './money';

/**
 * GraphQL read surface for a money amount.
 *
 * Mirrors the canonical {@link Money} triple so clients can format from
 * `minorUnits` + `scale` instead of re-rounding a float with `toFixed(2)`.
 * `minorUnits` is serialized as a string so large millime counts never lose
 * precision through the 32-bit GraphQL `Int`.
 */
@ObjectType('Money')
export class MoneyModel {
  @Field(() => String, { description: 'ISO-4217 currency code (e.g. TND).' })
  currency!: string;

  @Field(() => Int, { description: 'Number of minor-unit fraction digits.' })
  scale!: number;

  @Field(() => String, { description: 'Canonical decimal value at currency scale.' })
  amount!: string;

  @Field(() => String, { description: 'Whole number of minor units as a string.' })
  minorUnits!: string;
}

/**
 * Builds a {@link MoneyModel} from persisted integer minor units. Returns
 * `null` when no minor amount is available so the GraphQL field stays nullable
 * and backward-compatible alongside the legacy numeric fields.
 */
export function toMoneyModel(
  minorUnits: number | bigint | null | undefined,
  config: MoneyCurrency = {},
): MoneyModel | null {
  if (minorUnits === null || minorUnits === undefined) return null;
  if (typeof minorUnits === 'number' && !Number.isFinite(minorUnits)) return null;

  const money = Money.ofMinor(minorUnits, config);
  return {
    currency: money.currency,
    scale: money.scale,
    amount: money.toDecimalString(),
    minorUnits: money.toMinor().toString(),
  };
}
