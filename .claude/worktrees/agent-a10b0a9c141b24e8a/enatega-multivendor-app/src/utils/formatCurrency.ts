/**
 * Format a monetary amount using the currency configuration from the backend.
 *
 * Why: TND (Tunisian Dinar) uses 3 decimal places (millimes). The backend
 * exposes `currencyDecimalDigits` on the configuration object; this helper
 * respects that value rather than hard-coding 2 decimals.
 */

interface FormatOptions {
  /** Number of fractional digits. Defaults to 2 (standard); pass 3 for TND. */
  decimals?: number
  /** Currency symbol to prepend (e.g. "$", "TND", "د.ت"). */
  symbol?: string
  /** Currency label to append when the design uses a suffix. */
  suffix?: string
}

interface MoneyModelLike {
  amount?: string | null
  currency?: string | null
  scale?: number | null
}

export function formatPrice(amount: number, options: FormatOptions = {}): string {
  const { decimals = 2, symbol = '' } = options
  const formatted = amount.toFixed(decimals)
  return symbol ? `${symbol}${formatted}` : formatted
}

export function formatMoneyModel(
  money: MoneyModelLike | null | undefined,
  fallbackAmount?: number | null,
  options: FormatOptions = {}
): string {
  const { symbol = '' } = options
  const amount =
    typeof money?.amount === 'string'
      ? money.amount
      : formatPrice(fallbackAmount ?? 0, {
          decimals: money?.scale ?? options.decimals ?? 2
        })
  const suffix = money?.currency ?? options.suffix ?? ''

  return `${symbol ? `${symbol}${amount}` : amount}${suffix ? ` ${suffix}` : ''}`
}

/**
 * Build format options from the Apollo configuration object returned by the
 * `getConfiguration` / `configuration` query, which has `currencySymbol` and
 * `currencyDecimalDigits` fields.
 */
export function currencyOptions(config: {
  currencySymbol?: string
  currencyDecimalDigits?: number
} | null | undefined): FormatOptions {
  return {
    symbol: config?.currencySymbol ?? '',
    decimals: config?.currencyDecimalDigits ?? 2
  }
}
