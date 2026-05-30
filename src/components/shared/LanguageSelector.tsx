import { useMemo } from "react";
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

const languages = [
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
  const { i18n } = useTranslation();
  const activeLanguage = useMemo(
    () => languages.find((language) => i18n.language.startsWith(language.code)) ?? languages[0],
    [i18n.language]
  );

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
        {languages.map((language) => (
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
