// ============================================================
// Wesd Systems — Currency System
// Supports global currencies with timezone-based auto-detection
// ============================================================

export interface Currency {
  code: string;
  symbol: string;
  locale: string;
  name: string;
  flag: string;
}

export const CURRENCIES: Record<string, Currency> = {
  USD: { code: "USD", symbol: "$",    locale: "en-US", name: "US Dollar",             flag: "🇺🇸" },
  HTG: { code: "HTG", symbol: "G",    locale: "fr-HT", name: "Gourde Haïtienne",      flag: "🇭🇹" },
  EUR: { code: "EUR", symbol: "€",    locale: "fr-FR", name: "Euro",                  flag: "🇪🇺" },
  CAD: { code: "CAD", symbol: "CA$",  locale: "fr-CA", name: "Dollar Canadien",        flag: "🇨🇦" },
  DOP: { code: "DOP", symbol: "RD$",  locale: "es-DO", name: "Peso Dominicain",        flag: "🇩🇴" },
  GBP: { code: "GBP", symbol: "£",    locale: "en-GB", name: "British Pound",          flag: "🇬🇧" },
  XCD: { code: "XCD", symbol: "EC$",  locale: "en-AG", name: "East Caribbean Dollar",  flag: "🏝️" },
  BRL: { code: "BRL", symbol: "R$",   locale: "pt-BR", name: "Real Brésilien",         flag: "🇧🇷" },
  MXN: { code: "MXN", symbol: "MX$",  locale: "es-MX", name: "Peso Mexicain",          flag: "🇲🇽" },
  MAD: { code: "MAD", symbol: "DH",   locale: "fr-MA", name: "Dirham Marocain",        flag: "🇲🇦" },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

// Timezone → currency mapping for auto-detection
const TIMEZONE_CURRENCY_MAP: Record<string, string> = {
  "America/Port-au-Prince": "HTG",
  "America/New_York":       "USD",
  "America/Chicago":        "USD",
  "America/Denver":         "USD",
  "America/Los_Angeles":    "USD",
  "America/Toronto":        "CAD",
  "America/Vancouver":      "CAD",
  "America/Montreal":       "CAD",
  "America/Santo_Domingo":  "DOP",
  "America/Sao_Paulo":      "BRL",
  "America/Mexico_City":    "MXN",
  "America/Martinique":     "EUR",
  "America/Guadeloupe":     "EUR",
  "Europe/Paris":           "EUR",
  "Europe/Berlin":          "EUR",
  "Europe/Madrid":          "EUR",
  "Europe/Rome":            "EUR",
  "Europe/London":          "GBP",
  "Africa/Casablanca":      "MAD",
  "America/Antigua":        "XCD",
  "America/Dominica":       "XCD",
  "America/St_Kitts":       "XCD",
};

/**
 * Detects the user's preferred currency based on their timezone.
 * Falls back to USD if timezone is unknown.
 */
export function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_CURRENCY_MAP[tz] ?? "USD";
  } catch {
    return "USD";
  }
}

/**
 * Formats a numeric amount using the given currency code.
 * e.g. formatAmount(1250, "EUR") → "1 250,00 €"
 */
export function formatAmount(amount: number, currencyCode: string = "USD"): string {
  const currency = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Formats a compact amount for dashboard stats (no decimals for large numbers).
 * e.g. formatAmountCompact(12500, "USD") → "$12,500"
 */
export function formatAmountCompact(amount: number, currencyCode: string = "USD"): string {
  const currency = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
  }
}

export const STORAGE_KEY = "wesd_currency_preference";
