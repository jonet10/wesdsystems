import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import {
  Currency,
  CURRENCIES,
  detectCurrency,
  formatAmount,
  formatAmountCompact,
  STORAGE_KEY,
} from "@/lib/currency";

// ============================================================
// Context Types
// ============================================================

export interface DBCurrency extends Currency {
  exchange_rate: number;
  is_default: boolean;
  enabled: boolean;
}

interface CurrencyContextValue {
  /** The currently active currency object (either from DB or Static) */
  currency: DBCurrency | Currency;
  /** ISO 4217 code of the active currency (e.g. "USD") */
  currencyCode: string;
  /** Change the active currency and persist to localStorage & Profile */
  setCurrency: (code: string) => Promise<void>;
  /** Format a number as a full monetary string (e.g. "$1,250.00") */
  format: (amount: number) => string;
  /** Format a compact monetary string without decimals (e.g. "$1,250") */
  formatCompact: (amount: number) => string;
  /** True while the initial currency has not yet been resolved */
  isLoading: boolean;
  /** List of all available currencies */
  availableCurrencies: (DBCurrency | Currency)[];
}

// ============================================================
// Context
// ============================================================

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, profile } = useAuth();

  // Local storage override
  const [localCode, setLocalCode] = useState<string | null>(localStorage.getItem(STORAGE_KEY));

  // Business settings
  const [businessCode, setBusinessCode] = useState<string | null>(null);

  // Fetch currencies from DB if authenticated
  const { data: dbCurrencies, isLoading: isCurrenciesLoading } = useSupabaseQuery<DBCurrency>(
    ['currencies'], 'currencies', '*', { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (isAuthenticated && profile?.business_id) {
      const fetchBusinessSettings = async () => {
        const { data } = await supabase
          .from('businesses')
          .select('currency_code')
          .eq('id', profile.business_id)
          .maybeSingle();
        if (data?.currency_code) {
          setBusinessCode(data.currency_code);
        }
      };
      fetchBusinessSettings();
    }
  }, [isAuthenticated, profile]);

  const availableCurrencies = useMemo(() => {
    if (dbCurrencies && dbCurrencies.length > 0) return dbCurrencies;
    return Object.values(CURRENCIES);
  }, [dbCurrencies]);

  const currencyCode = useMemo(() => {
    // Priority 1: Explicit user override (local or profile)
    if (localCode) return localCode;
    if (profile?.currency_preference) return profile.currency_preference;

    // Priority 2: Business level setting
    if (businessCode) return businessCode;

    // Priority 3: Geo-detection via IP / Browser
    const geoCode = detectCurrency();

    // Priority 4: Platform default from DB
    const defaultDb = dbCurrencies?.find(c => c.is_default);
    if (defaultDb) {
      if (dbCurrencies?.some(c => c.code === geoCode && c.enabled)) {
        return geoCode;
      }
      return defaultDb.code;
    }

    return geoCode;
  }, [localCode, profile, businessCode, dbCurrencies]);

  const currency = useMemo(() => {
    return availableCurrencies.find(c => c.code === currencyCode) || CURRENCIES["EUR"];
  }, [availableCurrencies, currencyCode]);

  const setCurrency = useCallback(async (code: string) => {
    // Verify it exists in available currencies
    if (!availableCurrencies.some(c => c.code === code) && !CURRENCIES[code]) return;
    
    // Save locally
    localStorage.setItem(STORAGE_KEY, code);
    setLocalCode(code);

    // Save to profile if authenticated
    if (isAuthenticated && profile?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ currency_preference: code })
          .eq('id', profile.id);
      } catch (err) {
        console.error("Erreur mise à jour de la devise:", err);
      }
    }
  }, [availableCurrencies, isAuthenticated, profile]);

  const format = useCallback(
    (amount: number) => {
      try {
        return new Intl.NumberFormat(currency.locale, {
          style: "currency",
          currency: currency.code,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return formatAmount(amount, currency.code);
      }
    },
    [currency]
  );

  const formatCompact = useCallback(
    (amount: number) => {
      try {
        return new Intl.NumberFormat(currency.locale, {
          style: "currency",
          currency: currency.code,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);
      } catch {
        return formatAmountCompact(amount, currency.code);
      }
    },
    [currency]
  );

  return (
    <CurrencyContext.Provider
      value={{ 
        currency, 
        currencyCode, 
        setCurrency, 
        format, 
        formatCompact, 
        isLoading: isCurrenciesLoading,
        availableCurrencies
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used inside <CurrencyProvider>");
  }
  return ctx;
}
