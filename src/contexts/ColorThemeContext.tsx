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
      // Map 'auto_parts' to 'auto_parts' (or any specific mapping if needed)
      // The store uses 'salon', 'pharmacie', 'restaurant', 'market', 'boutique', 'auto_parts'
      // We fall back to 'minuit' if it's not a known theme, but since we have themes for most, we just use it directly.
      setActiveBusiness(business || "minuit");
    };

    updateActiveBusiness();

    window.addEventListener("glowup-store-update", updateActiveBusiness);
    return () => {
      window.removeEventListener("glowup-store-update", updateActiveBusiness);
    };
  }, []);

  // The effective theme is the manual one, or the active business theme, or minuit.
  const colorTheme = manualTheme || activeBusiness || "minuit";

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
