import { useColorTheme } from "@/contexts/ColorThemeContext";
import { THEMES } from "@/config/themes.config";
import { cn } from "@/lib/utils";
import { Check, Palette, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ThemeColorSelector() {
  const { colorTheme, setColorTheme, resetToDefault, isOverridden } = useColorTheme();
  
  const activeThemeConfig = THEMES[colorTheme] || THEMES["minuit"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 hover:bg-muted">
          <div 
            className="w-3.5 h-3.5 rounded-full shadow-sm"
            style={{ backgroundColor: activeThemeConfig.light.primary }}
          />
          <span className="hidden sm:inline text-sm font-medium">
            {activeThemeConfig.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          <span>Thèmes d'interface</span>
        </DropdownMenuLabel>
        
        {isOverridden && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={resetToDefault}
              className="text-muted-foreground flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retour au thème auto</span>
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        {Object.entries(THEMES).map(([key, themeConfig]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setColorTheme(key)}
            className={cn(
              "flex items-center justify-between cursor-pointer py-2",
              colorTheme === key && "bg-accent"
            )}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                style={{ backgroundColor: themeConfig.light.primary }}
              />
              <div className="flex flex-col">
                <span className="font-medium">{themeConfig.label}</span>
                <span className="text-xs text-muted-foreground">{themeConfig.description}</span>
              </div>
            </div>
            {colorTheme === key && <Check className="w-4 h-4 text-primary ml-2 flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
