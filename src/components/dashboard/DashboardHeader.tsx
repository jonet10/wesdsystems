import { useState, useEffect } from "react";
import { Bell, Search, ChevronDown, Scissors, Pill, Utensils, ShoppingBag, Building, LogOut, Settings, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { glowupStore } from "@/lib/store";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_LIST } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  userAvatar?: string;
}

const businessOptions = [
  { id: "salon",     label: "Salon & Barber",    icon: Scissors,   color: "text-blue-600 bg-blue-50" },
  { id: "pharmacie", label: "Pharmacie",          icon: Pill,       color: "text-emerald-600 bg-emerald-50" },
  { id: "restaurant",label: "Restaurant & Bar",   icon: Utensils,   color: "text-orange-600 bg-orange-50" },
  { id: "market",    label: "Provision / Market", icon: ShoppingBag,color: "text-cyan-600 bg-cyan-50" },
  { id: "boutique",  label: "Boutique Générale",  icon: Building,   color: "text-purple-600 bg-purple-50" },
];

const languages = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ht', label: 'Kreyòl', flag: '🇭🇹' },
];

export const DashboardHeader = ({ title, subtitle, userName = "User", userAvatar }: DashboardHeaderProps) => {
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  const { currency, setCurrency } = useCurrency();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase();

  useEffect(() => {
    const handleUpdate = () => setActiveBiz(glowupStore.getActiveBusiness());
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const handleSelectBusiness = (id: any) => {
    glowupStore.setActiveBusiness(id);
    setShowBizDropdown(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const closeAllDropdowns = () => {
    setShowBizDropdown(false);
    setShowCurrencyDropdown(false);
    setShowLangDropdown(false);
    setShowProfileDropdown(false);
  };

  const currentOption = businessOptions.find(b => b.id === activeBiz) || businessOptions[0];
  const CurrentIcon = currentOption.icon;
  const currentLang = languages.find(l => i18n.language.startsWith(l.code)) || languages[0];

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3.5 sticky top-0 z-40 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Page title */}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">

          {/* ── Business Switcher ── */}
          <div className="relative hidden md:block">
            <button
              onClick={() => { closeAllDropdowns(); setShowBizDropdown(!showBizDropdown); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 transition-all duration-150"
            >
              <div className={`p-1 rounded-md ${currentOption.color}`}>
                <CurrentIcon className="h-3.5 w-3.5" />
              </div>
              <span className="max-w-[120px] truncate">{currentOption.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showBizDropdown ? "rotate-180" : ""}`} />
            </button>

            {showBizDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 shadow-elevated rounded-xl p-1.5 z-50 animate-scale-in">
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2.5 py-1.5">Activité</p>
                  {businessOptions.map((option) => {
                    const OptIcon = option.icon;
                    const isSelected = activeBiz === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelectBusiness(option.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                          isSelected ? "bg-gray-900 text-white font-semibold" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className={`p-1 rounded-md ${isSelected ? "bg-white/20" : option.color}`}>
                          <OptIcon className="h-3.5 w-3.5" />
                        </div>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Language Switcher ── */}
          <div className="relative">
            <button
              onClick={() => { closeAllDropdowns(); setShowLangDropdown(!showLangDropdown); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-bold text-gray-700 transition-all duration-150"
            >
              <span>{currentLang.flag}</span>
              <span className="hidden sm:inline uppercase text-xs">{currentLang.code}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showLangDropdown ? "rotate-180" : ""}`} />
            </button>

            {showLangDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 shadow-elevated rounded-xl p-1.5 z-50 animate-scale-in">
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2.5 py-1.5">Langue</p>
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { i18n.changeLanguage(l.code); closeAllDropdowns(); }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                        i18n.language.startsWith(l.code) ? "bg-gray-100 text-gray-900 font-semibold" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Currency Switcher ── */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => { closeAllDropdowns(); setShowCurrencyDropdown(!showCurrencyDropdown); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-bold text-gray-700 transition-all duration-150 tabular-nums"
            >
              <span>{currency.flag}</span>
              <span>{currency.code}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showCurrencyDropdown ? "rotate-180" : ""}`} />
            </button>

            {showCurrencyDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
                <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-100 shadow-elevated rounded-xl p-1.5 z-50 animate-scale-in max-h-72 overflow-y-auto scrollbar-none">
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2.5 py-1.5">Devise</p>
                  {CURRENCY_LIST.map((cur) => {
                    const isSelected = cur.code === currency.code;
                    return (
                      <button
                        key={cur.code}
                        onClick={() => { setCurrency(cur.code); closeAllDropdowns(); }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                          isSelected ? "bg-gray-900 text-white font-semibold" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-base leading-none">{cur.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold tabular-nums">{cur.code}</span>
                            <span className={`text-xs truncate ${isSelected ? "text-gray-300" : "text-gray-400"}`}>— {cur.name}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block" />

          {/* ── User Profile Dropdown ── */}
          <div className="relative">
            <button 
              onClick={() => { closeAllDropdowns(); setShowProfileDropdown(!showProfileDropdown); }}
              className="flex items-center gap-2.5 p-1 pr-2 rounded-full hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
            >
              <Avatar className="h-8 w-8 rounded-full border border-gray-100">
                <AvatarImage src={userAvatar} />
                <AvatarFallback className="bg-gray-900 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden md:block" />
            </button>

            {showProfileDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 shadow-elevated rounded-xl p-1.5 z-50 animate-scale-in">
                  <div className="px-3 py-2.5 border-b border-gray-100 mb-1.5">
                    <p className="text-sm font-bold text-gray-900 leading-tight">{userName}</p>
                    <p className="text-xs text-gray-500 font-medium">Administrateur</p>
                  </div>
                  
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <User className="h-4 w-4 text-gray-400" /> Mon Profil
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Settings className="h-4 w-4 text-gray-400" /> Paramètres
                  </button>
                  
                  <div className="h-px bg-gray-100 my-1.5" />
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
