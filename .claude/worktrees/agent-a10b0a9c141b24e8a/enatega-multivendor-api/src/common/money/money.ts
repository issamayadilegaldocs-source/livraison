import { BadRequestException } from '@nestjs/common';

export type RoundingMode = 'HALF_EVEN';

export interface MoneyCurrency {
  currency?: string;
  scale?: number;
}

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_SCALE = 2;
const MAX_SCALE = 6;

export class Money {
  private constructor(
    readonly currency: string,
    readonly scale: number,
    private readonly minor: bigint,
  ) {}

  static fromDecimal(
    amount: number | string,
    currencyConfig: MoneyCurrency = {},
    rounding: RoundingMode = 'HALF_EVEN',
  ): Money {
    if (rounding !== 'HALF_EVEN') throw new BadRequestException('Unsupported rounding mode');
    const currency = this.normalizeCurrency(currencyConfig.currency);
    const scale = this.normalizeScale(currencyConfig.scale);
    return new Money(currency, scale, decimalToMinor(amount, scale));
  }

  static ofMinor(minor: number | bigint, currencyConfig: MoneyCurrency = {}): Money {
    const currency = this.normalizeCurrency(currencyConfig.currency);
    const scale = this.normalizeScale(currencyConfig.scale);
    const value = typeof minor === 'bigint' ? minor : BigInt(minor);
    return new Money(currency, scale, value);
  }

  static normalizeScale(scale: unknown): number {
    const value = Number(scale ?? DEFAULT_SCALE);
    if (!Number.isInteger(value) || value < 0 || value > MAX_SCALE)
      throw new BadRequestException('Invalid currency scale');
    return value;
  }

  private static normalizeCurrency(currency: unknown): string {
    const value = String(currency ?? DEFAULT_CURRENCY).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(value)) throw new BadRequestException('Invalid currency code');
    return value;
  }

  add(other: Money): Money {
    this.requireSameCurrency(other);
    return new Money(this.currency, this.scale, this.minor + other.minor);
  }

  subtract(other: Money): Money {
    this.requireSameCurrency(other);
    return new Money(this.currency, this.scale, this.minor - other.minor);
  }

  multiply(rate: number | string, rounding: RoundingMode = 'HALF_EVEN'): Money {
    if (rounding !== 'HALF_EVEN') throw new BadRequestException('Unsupported rounding mode');
    const rateScale = 12;
    const rateMinor = decimalToMinor(rate, rateScale);
    const divisor = 10n ** BigInt(rateScale);
    return new Money(this.currency, this.scale, divideHalfEven(this.minor * rateMinor, divisor));
  }

  compare(other: Money): number {
    this.requireSameCurrency(other);
    if (this.minor === other.minor) return 0;
    return this.minor > other.minor ? 1 : -1;
  }

  isZero(): boolean {
    return this.minor === 0n;
  }

  toMinor(): bigint {
    return this.minor;
  }

  toSafeMinorNumber(): number {
    const value = Number(this.minor);
    if (!Number.isSafeInteger(value)) throw new BadRequestException('Money amount exceeds safe range');
    return value;
  }

  toNumber(): number {
    return this.toSafeMinorNumber() / 10 ** this.scale;
  }

  toDecimalString(): string {
    const sign = this.minor < 0n ? '-' : '';
    const abs = this.minor < 0n ? -this.minor : this.minor;
    if (this.scale === 0) return `${sign}${abs.toString()}`;
    const padded = abs.toString().padStart(this.scale + 1, '0');
    const whole = padded.slice(0, -this.scale);
    const fraction = padded.slice(-this.scale);
    return `${sign}${whole}.${fraction}`;
  }

  private requireSameCurrency(other: Money): void {
    if (this.currency !== other.currency || this.scale !== other.scale)
      throw new BadRequestException('Money currency mismatch');
  }
}

function decimalToMinor(amount: number | string, scale: number): bigint {
  if (typeof amount === 'number' && !Number.isFinite(amount))
    throw new BadRequestException('Invalid money amount');

  const normalized = normalizeDecimalString(String(amount).trim());
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) throw new BadRequestException('Invalid money amount');

  const negative = normalized.startsWith('-');
  const unsigned = normalized.replace(/^[+-]/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0';
  const decimalPlaces = fraction.length;

  let minor: bigint;
  if (decimalPlaces <= scale) {
    minor = BigInt(digits.padEnd(digits.length + scale - decimalPlaces, '0'));
  } else {
    const keepLength = digits.length - (decimalPlaces - scale);
    const keptDigits = keepLength > 0 ? digits.slice(0, keepLength) : '0';
    const discarded = keepLength > 0 ? digits.slice(keepLength) : digits.padStart(digits.length - keepLength, '0');
    minor = BigInt(keptDigits || '0');
    if (shouldRoundHalfEven(minor, discarded)) minor += 1n;
  }

  return negative ? -minor : minor;
}

function shouldRoundHalfEven(current: bigint, discarded: string): boolean {
  const first = discarded[0] ?? '0';
  if (first > '5') return true;
  if (first < '5') return false;
  if ([...discarded.slice(1)].some((digit) => digit !== '0')) return true;
  return current % 2n !== 0n;
}

function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new BadRequestException('Invalid money divisor');
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  let quotient = abs / denominator;
  const remainder = abs % denominator;
  const doubled = remainder * 2n;
  if (doubled > denominator || (doubled === denominator && quotient % 2n !== 0n)) quotient += 1n;
  return negative ? -quotient : quotient;
}

function normalizeDecimalString(input: string): string {
  if (!/[eE]/.test(input)) return input;
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) throw new BadRequestException('Invalid money amount');
  return numeric.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 20,
  });
}
