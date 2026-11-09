import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { THEMES } from "./src/config/themes.config";

/**
 * Convertit une couleur hexadécimale (#RRGGBB / #RGB) en canaux "R G B".
 * Ces canaux sont exposés dans des variables `--*-rgb` afin que Tailwind
 * puisse appliquer les modificateurs d'opacité (bg-primary/10, border-primary/20…).
 */
function hexToRgbChannels(hex: string): string {
  const value = hex.replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return "0 0 0";
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        // Nouvelles couleurs basées sur thèmes.config.ts.
        // Les variables `--*-rgb` (canaux "R G B") permettent à Tailwind
        // d'appliquer les opacités : bg-primary/10, bg-card/80, etc.
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          light: "rgb(var(--primary-light-rgb) / <alpha-value>)",
          dark: "rgb(var(--primary-dark-rgb) / <alpha-value>)",
          fg: "var(--primary-fg)",
          foreground: "var(--primary-fg)", // Alias pour compatibilité
        },
        "bg-base": "rgb(var(--bg-base-rgb) / <alpha-value>)",
        "bg-surface": "rgb(var(--bg-surface-rgb) / <alpha-value>)",
        "bg-elevated": "rgb(var(--bg-elevated-rgb) / <alpha-value>)",

        // Anciennes couleurs conservées pour la compatibilité
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "rgb(var(--primary-rgb) / <alpha-value>)", // Pointé sur la nouvelle variable
        background: "rgb(var(--bg-base-rgb) / <alpha-value>)", // Pointé sur la nouvelle variable
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--bg-elevated-rgb) / <alpha-value>)", // Pointé sur la nouvelle variable
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--bg-surface-rgb) / <alpha-value>)", // Pointé sur la nouvelle variable
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "rgb(var(--bg-base-rgb) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          primary: "rgb(var(--primary-rgb) / <alpha-value>)",
          "primary-foreground": "var(--primary-fg)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          ring: "rgb(var(--primary-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'glow': 'var(--shadow-glow)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'elevated': '0 10px 40px -10px rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.5s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(function ({ addBase }) {
      const themesBase: Record<string, any> = {};
      Object.entries(THEMES).forEach(([key, config]) => {
        // LIGHT MODE
        // `html[data-theme]` a une spécificité supérieure à `:root` : le thème
        // choisi gagne donc aussi en mode clair (avant, :root écrasait le thème
        // et --primary devenait une valeur HSL invalide).
        themesBase[`html[data-theme="${key}"], [data-theme="${key}"]`] = {
          "--primary": config.light.primary,
          "--primary-rgb": hexToRgbChannels(config.light.primary),
          "--primary-light": config.light.primaryLight,
          "--primary-light-rgb": hexToRgbChannels(config.light.primaryLight),
          "--primary-dark": config.light.primaryDark,
          "--primary-dark-rgb": hexToRgbChannels(config.light.primaryDark),
          "--primary-fg": config.light.primaryFg,
          "--ring": config.light.primary,
          "--bg-base": config.light.bgBase,
          "--bg-base-rgb": hexToRgbChannels(config.light.bgBase),
          "--bg-surface": config.light.bgSurface,
          "--bg-surface-rgb": hexToRgbChannels(config.light.bgSurface),
          "--bg-elevated": config.light.bgElevated,
          "--bg-elevated-rgb": hexToRgbChannels(config.light.bgElevated),
          "--page-background-start": config.light.bgBase,
          "--page-background-mid": config.light.bgElevated,
          "--page-background-end": config.light.bgBase,
          "--sidebar-background": config.light.bgBase,
        };

        // DARK MODE
        // Cible à la fois .dark combiné sur le même élément, ou enfant de .dark
        themesBase[`[data-theme="${key}"].dark, .dark [data-theme="${key}"], html.dark[data-theme="${key}"], [data-theme="${key}"][class*="dark"]`] = {
          "--primary": config.dark.primary,
          "--primary-rgb": hexToRgbChannels(config.dark.primary),
          "--primary-light": config.dark.primaryLight,
          "--primary-light-rgb": hexToRgbChannels(config.dark.primaryLight),
          "--primary-dark": config.dark.primaryDark,
          "--primary-dark-rgb": hexToRgbChannels(config.dark.primaryDark),
          "--primary-fg": config.dark.primaryFg,
          "--ring": config.dark.primary,
          "--bg-base": config.dark.bgBase,
          "--bg-base-rgb": hexToRgbChannels(config.dark.bgBase),
          "--bg-surface": config.dark.bgSurface,
          "--bg-surface-rgb": hexToRgbChannels(config.dark.bgSurface),
          "--bg-elevated": config.dark.bgElevated,
          "--bg-elevated-rgb": hexToRgbChannels(config.dark.bgElevated),
          "--page-background-start": config.dark.bgBase,
          "--page-background-mid": config.dark.bgSurface,
          "--page-background-end": config.dark.bgBase,
          "--sidebar-background": config.dark.bgBase,
        };
      });
      addBase(themesBase);
    }),
  ],
} satisfies Config;
