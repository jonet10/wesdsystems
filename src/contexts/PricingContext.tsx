import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  CountryRegion,
  PlanPrice,
  detectCountryFromIP,
  detectCountryFromLocale,
  detectCountryFromTimezone,
  formatCurrency,
} from "@/lib/pricing";

const STORAGE_REGION_KEY = "wesd_region_preference";
const PLAN_ALIASES: Record<string, string[]> = {
  starter: ["starter", "basic", "démarreur", "demarreur", "start-up"],
  pro: ["pro", "professionnel"],
  enterprise: ["enterprise", "premium", "entreprise"],
};

const FALLBACK_PRICING: Record<string, Record<string, { monthly: number; yearly: number; currency: string }>> = {
  HT: {
    starter: { monthly: 1500, yearly: 15000, currency: "HTG" },
    pro: { monthly: 3000, yearly: 30000, currency: "HTG" },
    enterprise: { monthly: 5000, yearly: 50000, currency: "HTG" },
  },
  DO: {
    starter: { monthly: 900, yearly: 9000, currency: "DOP" },
    pro: { monthly: 2500, yearly: 25000, currency: "DOP" },
    enterprise: { monthly: 4500, yearly: 45000, currency: "DOP" },
  },
  FR: {
    starter: { monthly: 9, yearly: 90, currency: "EUR" },
    pro: { monthly: 29, yearly: 290, currency: "EUR" },
    enterprise: { monthly: 49, yearly: 490, currency: "EUR" },
  },
  US: {
    starter: { monthly: 12, yearly: 120, currency: "USD" },
    pro: { monthly: 39, yearly: 390, currency: "USD" },
    enterprise: { monthly: 69, yearly: 690, currency: "USD" },
  },
  CA: {
    starter: { monthly: 16, yearly: 160, currency: "CAD" },
    pro: { monthly: 49, yearly: 490, currency: "CAD" },
    enterprise: { monthly: 79, yearly: 790, currency: "CAD" },
  },
};

interface PricingContextValue {
  detectedCountry: string;
  detectedRegionName: string;
  availableCountries: CountryRegion[];
  prices: PlanPrice[];
  isLoading: boolean;
  setCountryPreference: (countryCode: string) => void;
  priceForPlan: (planName: string) => PlanPrice | null;
  formatPrice: (amount: number, currencyCode: string) => string;
}

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [countries, setCountries] = useState<CountryRegion[]>([]);
  const [prices, setPrices] = useState<PlanPrice[]>([]);
  const [detectedCountry, setDetectedCountry] = useState("US");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const localPref = localStorage.getItem(STORAGE_REGION_KEY);
    if (localPref) setDetectedCountry(localPref);
  }, []);

  useEffect(() => {
    const loadPricing = async () => {
      const [countryResp, priceResp] = await Promise.all([
        supabase.from("countries").select("country_code, country_name, currency_code, timezone, locale, enabled"),
        supabase.from("subscription_plan_prices").select("country_code, currency_code, monthly_price, yearly_price, promotion_label, promotion_percent, enabled, subscription_plans(name)"),
      ]);

      if (countryResp.data) {
        setCountries(countryResp.data as CountryRegion[]);
      }

      if (priceResp.data) {
        const normalized = priceResp.data.map((row: any) => ({
          country_code: row.country_code,
          currency_code: row.currency_code,
          monthly_price: Number(row.monthly_price || 0),
          yearly_price: Number(row.yearly_price || 0),
          promotion_label: row.promotion_label,
          promotion_percent: row.promotion_percent,
          enabled: row.enabled,
          plan_name: row.subscription_plans?.name || "Starter",
        }));
        setPrices(normalized);
      }

      const userCountry = (profile as any)?.country_code as string | undefined;
      const browserCountry = detectCountryFromLocale();
      const tzCountry = detectCountryFromTimezone();
      const ipCountry = await detectCountryFromIP();

      const resolved = userCountry || localStorage.getItem(STORAGE_REGION_KEY) || browserCountry || tzCountry || ipCountry || "US";
      setDetectedCountry(resolved.toUpperCase());
      setIsLoading(false);
    };

    void loadPricing();
  }, [profile]);

  const detectedRegionName = useMemo(() => {
    return countries.find((c) => c.country_code === detectedCountry)?.country_name || detectedCountry;
  }, [countries, detectedCountry]);

  const setCountryPreference = (countryCode: string) => {
    const normalized = countryCode.toUpperCase();
    localStorage.setItem(STORAGE_REGION_KEY, normalized);
    setDetectedCountry(normalized);
  };

  const priceForPlan = (planName: string): PlanPrice | null => {
    const normalizedPlan = planName.toLowerCase();
    const aliases = Object.entries(PLAN_ALIASES).find(([, names]) => names.includes(normalizedPlan))?.[1] || [normalizedPlan];

    const plan = prices.find(
      (p) =>
        p.enabled !== false &&
        aliases.includes((p.plan_name || "").toLowerCase()) &&
        p.country_code === detectedCountry
    );
    if (plan) return plan;

    const crossCountry = prices.find(
      (p) => p.enabled !== false && aliases.includes((p.plan_name || "").toLowerCase())
    );
    if (crossCountry) return crossCountry;

    const fallbackCountry = FALLBACK_PRICING[detectedCountry] || FALLBACK_PRICING.US;
    const fallbackKey = Object.keys(PLAN_ALIASES).find((k) => PLAN_ALIASES[k].includes(normalizedPlan)) || "starter";
    const fallbackValue = fallbackCountry[fallbackKey];
    if (!fallbackValue) return null;

    return {
      plan_name: planName,
      monthly_price: fallbackValue.monthly,
      yearly_price: fallbackValue.yearly,
      currency_code: fallbackValue.currency,
      country_code: detectedCountry,
      enabled: true,
    };
  };

  const formatPrice = (amount: number, currencyCode: string): string => {
    const locale = countries.find((c) => c.country_code === detectedCountry)?.locale || "en-US";
    return formatCurrency(amount, currencyCode, locale);
  };

  return (
    <PricingContext.Provider
      value={{
        detectedCountry,
        detectedRegionName,
        availableCountries: countries.filter((c) => c.enabled !== false),
        prices,
        isLoading,
        setCountryPreference,
        priceForPlan,
        formatPrice,
      }}
    >
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used in PricingProvider");
  return ctx;
}
