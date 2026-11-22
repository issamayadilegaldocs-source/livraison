// Currencies that use an Arabic-script symbol. For these we show the ISO code
// in Roman letters by default and only fall back to the Arabic glyph when the
// active locale is Arabic. Every other currency keeps its configured symbol.
export const ARABIC_CURRENCY_SYMBOLS: Record<string, string> = {
  TND: "د.ت", // Tunisian Dinar
  DZD: "د.ج", // Algerian Dinar
  MAD: "د.م.", // Moroccan Dirham
  AED: "د.إ", // UAE Dirham
  SAR: "ر.س", // Saudi Riyal
  QAR: "ر.ق", // Qatari Riyal
  KWD: "د.ك", // Kuwaiti Dinar
  BHD: "د.ب", // Bahraini Dinar
  OMR: "ر.ع.", // Omani Rial
  JOD: "د.ا", // Jordanian Dinar
  LBP: "ل.ل", // Lebanese Pound
  IQD: "ع.د", // Iraqi Dinar
  LYD: "ل.د", // Libyan Dinar
  SYP: "ل.س", // Syrian Pound
  SDG: "ج.س", // Sudanese Pound
  YER: "﷼", // Yemeni Rial
  EGP: "ج.م", // Egyptian Pound
  AFN: "؋", // Afghan Afghani
};

const isArabicLocale = (locale?: string): boolean =>
  (locale ?? "").toLowerCase().startsWith("ar");

/**
 * Resolve the currency symbol to display.
 * - Arabic-script currencies: ISO code (Roman) by default, Arabic glyph in `ar` locale.
 * - All other currencies: the configured symbol, unchanged.
 */
export const localizedCurrencySymbol = (
  currencyCode?: string,
  configuredSymbol?: string,
  locale?: string
): string => {
  const code = (currencyCode ?? "").toUpperCase();
  if (code && code in ARABIC_CURRENCY_SYMBOLS) {
    return isArabicLocale(locale) ? ARABIC_CURRENCY_SYMBOLS[code] : code;
  }
  return configuredSymbol ?? "";
};
