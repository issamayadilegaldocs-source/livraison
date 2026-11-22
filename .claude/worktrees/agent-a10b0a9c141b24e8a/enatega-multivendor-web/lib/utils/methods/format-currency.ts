/**
 * Format a monetary amount respecting the backend currency configuration.
 *
 * Why: TND (Tunisian Dinar) uses 3 decimal places (millimes). The backend
 * exposes `currencyDecimalDigits` on the configuration object; using this
 * helper instead of hard-coded `.toFixed(2)` ensures correct rendering for
 * any currency the admin configures.
 */

interface FormatOptions {
  /** Fractional digits — defaults to 2; pass 3 for TND. */
  decimals?: number
  /** Currency symbol to prepend (e.g. "$", "TND"). */
  symbol?: string
}

/**
 * Canonical money read shape exposed by the backend `Money` GraphQL type.
 * `amount` is a pre-rounded decimal string at the currency's scale, and
 * `minorUnits` is the integer minor-unit count serialized as a string so large
 * millime counts never lose precision through GraphQL `Int`.
 */
export interface IMoneyModel {
  currency?: string | null
  amount?: string | null
  scale?: number | null
  minorUnits?: string | null
}

export function formatPrice(amount: number, options: FormatOptions = {}): string {
  const { decimals = 2, symbol = '' } = options
  const formatted = amount.toFixed(decimals)
  return symbol ? `${symbol}${formatted}` : formatted
}

/**
 * Format a backend `Money` value, preferring the server-computed decimal string
 * (scale-correct, no `toFixed` re-rounding) and falling back to the legacy
 * numeric field only when the `*Money` companion is absent (older cached/API
 * responses). Keeps the web convention of prepending the configured symbol.
 */
export function formatMoneyModel(
  money: IMoneyModel | null | undefined,
  fallbackAmount: number | null | undefined,
  options: FormatOptions = {}
): string {
  const { decimals = 2, symbol = '' } = options
  const amount =
    typeof money?.amount === 'string' && money.amount.length > 0
      ? money.amount
      : (fallbackAmount ?? 0).toFixed(money?.scale ?? decimals)
  return symbol ? `${symbol}${amount}` : amount
}

/**
 * Build FormatOptions from the Apollo configuration object, which has
 * `currencySymbol` and `currencyDecimalDigits` fields.
 */
export function currencyOptions(config: {
  currencySymbol?: string | null
  currencyDecimalDigits?: number | null
} | null | undefined): FormatOptions {
  return {
    symbol: config?.currencySymbol ?? '',
    decimals: config?.currencyDecimalDigits ?? 2
  }
}
