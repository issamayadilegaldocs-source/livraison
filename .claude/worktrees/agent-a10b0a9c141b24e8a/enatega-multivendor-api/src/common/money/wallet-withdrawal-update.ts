import { MoneyCurrency } from './money';

export function buildWalletWithdrawalUpdate({
  amount,
  amountMinor,
  currencyConfig = {},
  direction,
}: {
  amount: number;
  amountMinor?: number;
  currencyConfig?: MoneyCurrency;
  direction: 'debit' | 'credit';
}) {
  const scale = currencyConfig.scale ?? 2;
  const currency = currencyConfig.currency ?? 'USD';
  const factor = 10 ** scale;
  const minor = amountMinor ?? Math.round(amount * factor);
  const currentDelta = direction === 'debit' ? -minor : minor;
  const withdrawnDelta = direction === 'debit' ? minor : -minor;

  return [
    {
      $set: {
        currentWalletAmountMinor: {
          $add: [
            {
              $ifNull: [
                '$currentWalletAmountMinor',
                { $round: [{ $multiply: [{ $ifNull: ['$currentWalletAmount', 0] }, factor] }, 0] },
              ],
            },
            currentDelta,
          ],
        },
        withdrawnWalletAmountMinor: {
          $add: [
            {
              $ifNull: [
                '$withdrawnWalletAmountMinor',
                { $round: [{ $multiply: [{ $ifNull: ['$withdrawnWalletAmount', 0] }, factor] }, 0] },
              ],
            },
            withdrawnDelta,
          ],
        },
        walletAmountCurrency: currency,
        walletAmountScale: scale,
      },
    },
    {
      $set: {
        currentWalletAmount: { $divide: ['$currentWalletAmountMinor', factor] },
        withdrawnWalletAmount: { $divide: ['$withdrawnWalletAmountMinor', factor] },
      },
    },
  ];
}
