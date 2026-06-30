import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { THEMES } from "./src/config/themes.config";

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
        // Nouvelles couleurs basées sur thèmes.config.ts
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
          dark: "var(--primary-dark)",
          fg: "var(--primary-fg)",
          foreground: "var(--primary-fg)", // Alias pour compatibilité
        },
        "bg-base": "var(--bg-base)",
        "bg-surface": "var(--bg-surface)",
        "bg-elevated": "var(--bg-elevated)",

        // Anciennes couleurs conservées pour la compatibilité
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "var(--primary)", // Pointé sur la nouvelle variable
        background: "var(--bg-base)", // Pointé sur la nouvelle variable
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "var(--bg-elevated)", // Pointé sur la nouvelle variable
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "var(--bg-surface)", // Pointé sur la nouvelle variable
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "var(--bg-base)",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "var(--primary)",
          "primary-foreground": "var(--primary-fg)",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "var(--primary)",
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
        themesBase[`[data-theme="${key}"]`] = {
          "--primary": config.light.primary,
          "--primary-light": config.light.primaryLight,
          "--primary-dark": config.light.primaryDark,
          "--primary-fg": config.light.primaryFg,
          "--bg-base": config.light.bgBase,
          "--bg-surface": config.light.bgSurface,
          "--bg-elevated": config.light.bgElevated,
        };
        
        // DARK MODE
        // Cible à la fois .dark combiné sur le même élément, ou enfant de .dark
        themesBase[`[data-theme="${key}"].dark, .dark [data-theme="${key}"]`] = {
          "--primary": config.dark.primary,
          "--primary-light": config.dark.primaryLight,
          "--primary-dark": config.dark.primaryDark,
          "--primary-fg": config.dark.primaryFg,
          "--bg-base": config.dark.bgBase,
          "--bg-surface": config.dark.bgSurface,
          "--bg-elevated": config.dark.bgElevated,
        };
      });
      addBase(themesBase);
    }),
  ],
} satisfies Config;
