import { useState, useEffect } from "react";
import { Bell, Search, ChevronDown, Scissors, Pill, Utensils, ShoppingBag, Building } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { glowupStore } from "@/lib/store";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_LIST } from "@/lib/currency";

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

export const DashboardHeader = ({ title, subtitle, userName = "User", userAvatar }: DashboardHeaderProps) => {
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const { currency, setCurrency } = useCurrency();
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

  const currentOption = businessOptions.find(b => b.id === activeBiz) || businessOptions[0];
  const CurrentIcon = currentOption.icon;

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

        <div className="flex items-center gap-2.5 shrink-0">

          {/* ── Business Switcher ── */}
          <div className="relative">
            <button
              onClick={() => { setShowBizDropdown(!showBizDropdown); setShowCurrencyDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 transition-all duration-150"
            >
              <div className={`p-1 rounded-md ${currentOption.color}`}>
                <CurrentIcon className="h-3.5 w-3.5" />
              </div>
              <span className="hidden md:inline max-w-[120px] truncate">{currentOption.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showBizDropdown ? "rotate-180" : ""}`} />
            </button>

            {showBizDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowBizDropdown(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 shadow-elevated rounded-xl p-1.5 z-50 animate-scale-in">
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2.5 py-1.5">Activité active</p>
                  {businessOptions.map((option) => {
                    const OptIcon = option.icon;
                    const isSelected = activeBiz === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelectBusiness(option.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                          isSelected ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className={`p-1 rounded-md ${option.color}`}>
                          <OptIcon className="h-3.5 w-3.5" />
                        </div>
                        {option.label}
                        {isSelected && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Currency Switcher ── */}
          <div className="relative">
            <button
              onClick={() => { setShowCurrencyDropdown(!showCurrencyDropdown); setShowBizDropdown(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-bold text-gray-700 transition-all duration-150 tabular-nums"
            >
              <span>{currency.flag}</span>
              <span>{currency.code}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showCurrencyDropdown ? "rotate-180" : ""}`} />
            </button>

            {showCurrencyDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCurrencyDropdown(false)} />
                <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-100 shadow-elevated rounded-xl p-1.5 z-50 animate-scale-in max-h-72 overflow-y-auto scrollbar-none">
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2.5 py-1.5">Devise</p>
                  {CURRENCY_LIST.map((cur) => {
                    const isSelected = cur.code === currency.code;
                    return (
                      <button
                        key={cur.code}
                        onClick={() => { setCurrency(cur.code); setShowCurrencyDropdown(false); }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                          isSelected ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-base leading-none">{cur.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold tabular-nums">{cur.code}</span>
                            <span className="text-xs text-gray-400 truncate">— {cur.name}</span>
                          </div>
                        </div>
                        {isSelected && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Search ── */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              className="pl-8 w-44 h-9 bg-gray-50 border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:bg-white"
            />
          </div>

          {/* ── Notifications ── */}
          <button className="relative h-9 w-9 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center transition-colors">
            <Bell className="h-4 w-4 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>

          {/* ── User avatar ── */}
          <div className="flex items-center gap-2.5 pl-2.5 border-l border-gray-100">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={userAvatar} />
              <AvatarFallback className="bg-blue-600 text-white text-xs font-bold rounded-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block">
              <p className="text-xs font-bold text-gray-900 leading-tight">{userName}</p>
              <p className="text-[10px] text-gray-500 font-medium">Administrateur</p>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
