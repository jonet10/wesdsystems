import React, { createContext, useContext, useEffect, useState } from "react";
import { glowupStore } from "@/lib/store";

export type ColorTheme = string;

interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  resetToDefault: () => void;
  isOverridden: boolean;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

const STORAGE_KEY = "wesd-color-theme";

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [manualTheme, setManualTheme] = useState<ColorTheme | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) as ColorTheme | null;
    }
    return null;
  });

  const [activeBusiness, setActiveBusiness] = useState<string>("minuit");

  // Read active business initially and on store updates
  useEffect(() => {
    const updateActiveBusiness = () => {
      const business = glowupStore.getActiveBusiness();
      const themeMap: Record<string, string> = {
        pharmacie: "pharmacie",
        salon: "cerise",
        auto_parts: "cobalt",
        restaurant: "braise",
        school: "cobalt",
        school_payments: "cobalt",
        market: "miel",
        boutique: "cerise",
      };
      const mappedTheme = business ? (themeMap[business] || business) : "minuit";
      setActiveBusiness(mappedTheme);
    };

    updateActiveBusiness();

    window.addEventListener("glowup-store-update", updateActiveBusiness);
    window.addEventListener("popstate", updateActiveBusiness);
    return () => {
      window.removeEventListener("glowup-store-update", updateActiveBusiness);
      window.removeEventListener("popstate", updateActiveBusiness);
    };
  }, []);

  // Le module pharmacie applique toujours son thème émeraude médical dédié
  const isPharmacyContext = (typeof window !== "undefined" && window.location.pathname.startsWith("/pharmacie")) || activeBusiness === "pharmacie";
  const colorTheme = isPharmacyContext ? "pharmacie" : (manualTheme || activeBusiness || "minuit");

  const setColorTheme = (theme: ColorTheme) => {
    setManualTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  };

  const resetToDefault = () => {
    setManualTheme(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorTheme);
    // Also remove the old data-color just in case
    document.documentElement.removeAttribute("data-color");
  }, [colorTheme]);

  return (
    <ColorThemeContext.Provider value={{ 
      colorTheme, 
      setColorTheme, 
      resetToDefault,
      isOverridden: manualTheme !== null 
    }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (context === undefined) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  }
  return context;
}
