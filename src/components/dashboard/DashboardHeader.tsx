import { useState, useEffect } from "react";
import { Bell, Search, ChevronDown, LogOut, Settings, User, Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { glowupStore } from "@/lib/store";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_LIST } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  userAvatar?: string;
  userRole?: string;
}

const languages = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ht', label: 'Kreyòl', flag: '🇭🇹' },
];

export const DashboardHeader = ({ 
  title, 
  subtitle, 
  userName = "Utilisateur", 
  userAvatar,
  userRole = "employee"
}: DashboardHeaderProps) => {
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id: string; title: string; read: boolean}>>([]);
  
  const { currency, setCurrency } = useCurrency();
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase();
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    // Subscribe to real-time notifications via Supabase
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [payload.new as any, ...prev]);
        }
      )
      .subscribe();
    
    // Load initial notifications
    const loadNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setNotifications(data);
    };
    loadNotifications();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleMarkAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', supabase.auth.user()?.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const currentLang = languages.find(l => i18n.language.startsWith(l.code)) || languages[0];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 
                      border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
                      px-6 shadow-sm">
      
      {/* Page Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        
        {/* Search (desktop) */}
        <div className="hidden md:flex relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-8 w-48 lg:w-64 h-9"
            onKeyDown={(e) => {
              if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                // Open command palette
              }
            }}
          />
          <kbd className="hidden lg:inline-flex absolute right-2 top-1.5 h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">Basculer le thème</span>
        </Button>

        {/* Language Selector */}
        <DropdownMenu open={showLangDropdown} onOpenChange={setShowLangDropdown}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 gap-1 px-2">
              <span className="text-lg">{currentLang.flag}</span>
              <span className="hidden sm:inline text-sm">{currentLang.code.toUpperCase()}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => {
                  i18n.changeLanguage(lang.code);
                  setShowLangDropdown(false);
                }}
                className={cn(i18n.language.startsWith(lang.code) && "bg-accent")}
              >
                <span className="mr-2">{lang.flag}</span>
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Currency Selector */}
        <DropdownMenu open={showCurrencyDropdown} onOpenChange={setShowCurrencyDropdown}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 gap-1 px-2">
              <span className="text-sm font-medium">{currency.code}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {CURRENCY_LIST.slice(0, 8).map((curr) => (
              <DropdownMenuItem
                key={curr.code}
                onClick={() => {
                  setCurrency(curr.code);
                  setShowCurrencyDropdown(false);
                }}
                className={cn(currency === curr.code && "bg-accent font-medium")}
              >
                {curr.code} - {curr.symbol}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                  Tout lire
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Aucune notification</p>
              ) : (
                notifications.map((notif) => (
                  <DropdownMenuItem 
                    key={notif.id} 
                    className={cn("py-3 px-4 cursor-default", !notif.read && "bg-accent/50")}
                  >
                    <div>
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(notif.id).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/salon/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/salon/employees")}>
              <User className="mr-2 h-4 w-4" />
              Mon profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};