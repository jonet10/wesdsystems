import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// --- CONFIGURATION ---
const TRANSLATE_TIMEOUT_MS = 5000;
const GOOGLE_TRANSLATE_SCRIPT_URL = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

// --- MODULE SINGLETON STATE ---
let isScriptLoading = false;
let isScriptLoaded = false;
let scriptLoadPromise: Promise<void> | null = null;

const FALLBACK_LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ht", label: "Kreyòl", flag: "🇭🇹" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
] as const;

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
}

export function LanguageSelector({ compact = false, className }: LanguageSelectorProps) {
  const [useFallback, setUseFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fallback hooks
  const { i18n } = useTranslation();
  const activeLanguage = useMemo(
    () => FALLBACK_LANGUAGES.find((language) => i18n.language.startsWith(language.code)) ?? FALLBACK_LANGUAGES[0],
    [i18n.language]
  );

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadScript = () => {
      if (isScriptLoaded) return Promise.resolve();
      if (scriptLoadPromise) return scriptLoadPromise;

      isScriptLoading = true;
      scriptLoadPromise = new Promise((resolve, reject) => {
        // Expose callback for Google Translate API
        (window as any).googleTranslateElementInit = () => {
          isScriptLoaded = true;
          isScriptLoading = false;
          resolve();
        };

        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = GOOGLE_TRANSLATE_SCRIPT_URL;
        script.onerror = () => {
          isScriptLoading = false;
          reject(new Error("Failed to load Google Translate script"));
        };
        document.body.appendChild(script);
      });

      return scriptLoadPromise;
    };

    const initWidget = async () => {
      try {
        timeoutId = setTimeout(() => {
          if (isMounted && !isScriptLoaded) {
            console.warn("Google Translate loading timed out. Using fallback.");
            setUseFallback(true);
          }
        }, TRANSLATE_TIMEOUT_MS);

        await loadScript();

        if (isMounted && (window as any).google && (window as any).google.translate) {
          clearTimeout(timeoutId);
          // Clear any existing children to prevent duplicates if react re-renders
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          new (window as any).google.translate.TranslateElement(
            { pageLanguage: 'fr', autoDisplay: false },
            containerRef.current
          );
        }
      } catch (err) {
        if (isMounted) {
          console.error("Google Translate error:", err);
          setUseFallback(true);
        }
      }
    };

    initWidget();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      
      // EXPLICIT DOM CLEANUP ON UNMOUNT
      // 1. Remove classes injected by Google Translate on <html> or <body>
      document.documentElement.classList.remove("translated-ltr");
      document.documentElement.classList.remove("translated-rtl");
      document.body.classList.remove("translated-ltr");
      document.body.classList.remove("translated-rtl");
      
      // 2. Remove the injected styling that messes with top margin
      document.body.style.removeProperty("top");
      document.body.style.removeProperty("min-height");
      document.body.style.removeProperty("position");
      
      // 3. Remove stray UI elements injected by Google (banner, frames, etc.)
      const strayElements = document.querySelectorAll('.skiptranslate:not(#google_translate_element), .goog-te-menu-frame, .goog-te-spinner, #goog-gt-tt');
      strayElements.forEach(el => el.remove());
    };
  }, []);

  if (useFallback) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={compact ? "sm" : "default"} className={cn("gap-2", compact ? "h-9 px-2" : "", className)}>
            <Languages className="h-4 w-4" />
            <span className="text-sm font-medium">{activeLanguage.flag} {compact ? activeLanguage.code.toUpperCase() : activeLanguage.label}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {FALLBACK_LANGUAGES.map((language) => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => i18n.changeLanguage(language.code)}
              className={cn(i18n.language.startsWith(language.code) && "bg-accent")}
            >
              <span className="mr-2">{language.flag}</span>
              {language.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Ensure ID is passed to ref so google can target it
  return (
    <div 
      ref={containerRef} 
      id="google_translate_element" 
      className={cn("flex items-center min-h-[36px]", className)} 
    />
  );
}
