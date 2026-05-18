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

interface PricingContextValue {
  detectedCountry: string;
  detectedRegionName: string;
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
    const plan = prices.find(
      (p) => p.enabled !== false && p.plan_name.toLowerCase() === planName.toLowerCase() && p.country_code === detectedCountry
    );
    if (plan) return plan;
    return prices.find((p) => p.enabled !== false && p.plan_name.toLowerCase() === planName.toLowerCase()) || null;
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
