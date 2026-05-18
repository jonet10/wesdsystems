export interface CountryRegion {
  country_code: string;
  country_name: string;
  currency_code: string;
  timezone?: string | null;
  locale?: string | null;
  enabled?: boolean;
}

export interface PlanPrice {
  plan_name: string;
  monthly_price: number;
  yearly_price: number;
  currency_code: string;
  country_code: string;
  promotion_label?: string | null;
  promotion_percent?: number | null;
  enabled?: boolean;
}

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "America/Port-au-Prince": "HT",
  "America/Santo_Domingo": "DO",
  "Europe/Paris": "FR",
  "America/New_York": "US",
  "America/Toronto": "CA",
};

export function detectCountryFromLocale(): string | null {
  try {
    const locale = navigator.language || "en-US";
    const parts = locale.split("-");
    return parts[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

export function detectCountryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY_MAP[tz] ?? null;
  } catch {
    return null;
  }
}

export async function detectCountryFromIP(): Promise<string | null> {
  try {
    const resp = await fetch("https://ipapi.co/country/", { method: "GET" });
    if (!resp.ok) return null;
    const text = (await resp.text()).trim().toUpperCase();
    return text.length === 2 ? text : null;
  } catch {
    return null;
  }
}

export function formatCurrency(amount: number, currencyCode: string, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currencyCode}`;
  }
}
