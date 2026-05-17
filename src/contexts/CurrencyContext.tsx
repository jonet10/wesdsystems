import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
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

interface CurrencyContextValue {
  /** The currently active currency object */
  currency: Currency;
  /** ISO 4217 code of the active currency (e.g. "USD") */
  currencyCode: string;
  /** Change the active currency and persist to localStorage */
  setCurrency: (code: string) => void;
  /** Format a number as a full monetary string (e.g. "$1,250.00") */
  format: (amount: number) => string;
  /** Format a compact monetary string without decimals (e.g. "$1,250") */
  formatCompact: (amount: number) => string;
  /** True while the initial currency has not yet been resolved */
  isLoading: boolean;
}

// ============================================================
// Context
// ============================================================

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<string>("USD");
  const [isLoading, setIsLoading] = useState(true);

  // On mount: read localStorage, then fall back to auto-detect
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CURRENCIES[saved]) {
      setCurrencyCode(saved);
    } else {
      const detected = detectCurrency();
      setCurrencyCode(detected);
    }
    setIsLoading(false);
  }, []);

  const setCurrency = useCallback((code: string) => {
    if (!CURRENCIES[code]) return;
    localStorage.setItem(STORAGE_KEY, code);
    setCurrencyCode(code);
  }, []);

  const format = useCallback(
    (amount: number) => formatAmount(amount, currencyCode),
    [currencyCode]
  );

  const formatCompact = useCallback(
    (amount: number) => formatAmountCompact(amount, currencyCode),
    [currencyCode]
  );

  const currency = CURRENCIES[currencyCode] ?? CURRENCIES.USD;

  return (
    <CurrencyContext.Provider
      value={{ currency, currencyCode, setCurrency, format, formatCompact, isLoading }}
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
