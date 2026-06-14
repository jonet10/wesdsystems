import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ArrowRight,
  Building,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  GraduationCap,
  LayoutGrid,
  Layers,
  LineChart,
  MapPin,
  Menu,
  Pill,
  PieChart as PieChartIcon,
  Scissors,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Utensils,
  Users,
  Wallet,
  X,
  MoreHorizontal,
  Moon,
  Zap,
  Sun,
  MessageCircle,
  Smartphone,
} from "lucide-react";

import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { Logo } from "@/components/brand/Logo";
import { CommunityActivitySection } from "@/components/home/CommunityActivitySection";
import { Button } from "@/components/ui/button";
import { usePricing } from "@/contexts/PricingContext";

const businessKeys = [
  { id: "salon", icon: Scissors },
  { id: "pharmacy", icon: Pill },
  { id: "restaurant", icon: Utensils },
  { id: "market", icon: ShoppingBag },
  { id: "boutique", icon: Building },
  { id: "auto_parts", icon: Zap },
  { id: "school_payments", icon: GraduationCap },
] as const;

const LANGUAGE_CODES = ["en", "fr", "es", "ht"] as const;
const PIE_COLORS = ["#8b5cf6", "#22d3ee", "#14b8a6"];
const HERO_SLIDES = ["/images/1.jpg", "/images/2.jpg", "/images/3.png", "/images/4.jpg", "/images/5.jpg"];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { detectedRegionName, detectedCountry, availableCountries, setCountryPreference, priceForPlan, formatPrice, isLoading, availablePlans, planFeatures } =
    usePricing();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  const starterPrice = priceForPlan("Starter") || priceForPlan("Basic");
  const proPrice = priceForPlan("Pro");
  const enterprisePrice = priceForPlan("Enterprise") || priceForPlan("Premium");

  const countryCount = availableCountries.length || 31;

  const coverageData = useMemo(
    () => [
      { name: "Countries", value: countryCount },
      { name: "Verticals", value: businessKeys.length },
      { name: "Locales", value: LANGUAGE_CODES.length },
    ],
    [countryCount]
  );

  const visibleCountries = useMemo(() => {
    return [...availableCountries]
      .sort((a, b) => a.country_name.localeCompare(b.country_name))
      .slice(0, 4);
  }, [availableCountries]);

  const latestPriceLabel = starterPrice
    ? `${formatPrice(starterPrice.monthly_price, starterPrice.currency_code)} / ${t("pricing.monthly")}`
    : "—";

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isDarkMode = theme !== "light";
  const pageText = isDarkMode ? "text-white" : "text-slate-950";
  const pageMuted = isDarkMode ? "text-white/68" : "text-slate-700";
  const pageSoft = isDarkMode ? "text-white/55" : "text-slate-600";
  const panelBase = isDarkMode ? "border-white/10 bg-white/5" : "border-slate-900/10 bg-white";
  const panelCard = isDarkMode ? "border-white/10 bg-white/5 shadow-black/10" : "border-slate-900/10 bg-white shadow-slate-900/10";
  const panelSoft = isDarkMode ? "border-white/10 bg-slate-950/35" : "border-slate-900/10 bg-slate-950/5";
  const sectionAccent = isDarkMode ? "text-cyan-300/80" : "text-cyan-700";

  return (
    <div
      className={`min-h-screen overflow-x-hidden transition-colors duration-500 ${
        isDarkMode
          ? "bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.25),transparent_38%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),linear-gradient(180deg,#050816_0%,#09041a_45%,#0a0815_100%)] text-white"
          : "bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] text-slate-950"
      }`}
    >
      <div
        className={`fixed inset-0 pointer-events-none opacity-40 transition-opacity duration-500 ${
          isDarkMode
            ? "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
            : "bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)]"
        } bg-[length:44px_44px]`}
      />

      <nav
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${
          isDarkMode ? "border-white/8 bg-slate-950/70" : "border-slate-900/10 bg-white/80"
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link to="/" className="relative z-10">
            <Logo size="md" />
          </Link>

          <div className={`hidden items-center gap-8 text-sm font-medium md:flex ${pageMuted}`}>
            <a href="#solutions" className={`transition-colors ${isDarkMode ? "hover:text-white" : "hover:text-slate-950"}`}>
              {t("nav.solutions")}
            </a>
            <a href="#features" className={`transition-colors ${isDarkMode ? "hover:text-white" : "hover:text-slate-950"}`}>
              {t("nav.features")}
            </a>
            <a href="#pricing" className={`transition-colors ${isDarkMode ? "hover:text-white" : "hover:text-slate-950"}`}>
              {t("nav.pricing")}
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Passer au mode jour" : "Passer au mode nuit"}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                isDarkMode
                  ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                  : "border-slate-900/10 bg-slate-950/5 text-slate-700 hover:bg-slate-950/10 hover:text-slate-950"
              }`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className={`flex items-center gap-1 rounded-full border p-1 ${panelBase}`}>
              {LANGUAGE_CODES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                    i18n.language.startsWith(lang)
                      ? isDarkMode
                        ? "bg-white text-slate-950"
                        : "bg-slate-950 text-white"
                      : isDarkMode
                        ? "text-white/60 hover:bg-white/8 hover:text-white"
                        : "text-slate-600 hover:bg-slate-950/5 hover:text-slate-950"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <Link to="/auth/login">
              <Button
                variant="ghost"
                className={`rounded-full ${isDarkMode ? "text-white/80 hover:bg-white/8 hover:text-white" : "text-slate-700 hover:bg-slate-950/5 hover:text-slate-950"}`}
              >
                {t("nav.signIn")}
              </Button>
            </Link>
            <Link to="/auth/register">
              <Button className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-cyan-400">
                {t("nav.startTrial")}
              </Button>
            </Link>
          </div>

          <button
            className={`rounded-xl border p-2 md:hidden ${isDarkMode ? "border-white/10 bg-white/5 text-white" : "border-slate-900/10 bg-white text-slate-950"}`}
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            className={`border-t px-5 py-4 md:hidden transition-colors duration-500 ${
              isDarkMode ? "border-white/8 bg-slate-950/95" : "border-slate-900/10 bg-white/95"
            }`}
            >
              <div className="flex flex-col gap-4">
                <a
                  href="#solutions"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={isDarkMode ? "text-white/80" : "text-slate-700"}
                >
                  {t("nav.solutions")}
                </a>
                <a
                  href="#features"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={isDarkMode ? "text-white/80" : "text-slate-700"}
                >
                  {t("nav.features")}
                </a>
                <a
                  href="#pricing"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={isDarkMode ? "text-white/80" : "text-slate-700"}
                >
                  {t("nav.pricing")}
                </a>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                      isDarkMode
                        ? "border-white/10 bg-white/5 text-white/80"
                        : "border-slate-900/10 bg-slate-950/5 text-slate-700"
                    }`}
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {theme === "dark" ? "Mode jour" : "Mode nuit"}
                  </button>

                  {LANGUAGE_CODES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        changeLanguage(lang);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
                        isDarkMode
                          ? "border-white/10 bg-white/5 text-white/80"
                          : "border-slate-900/10 bg-slate-950/5 text-slate-700"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <Link to="/auth/login" className="flex-1">
                    <Button
                      variant="outline"
                      className={`w-full rounded-full ${
                        isDarkMode ? "border-white/10 bg-transparent text-white" : "border-slate-900/10 bg-white text-slate-950"
                      }`}
                    >
                      {t("nav.signIn")}
                    </Button>
                  </Link>
                  <Link to="/auth/register" className="flex-1">
                    <Button className="w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white">
                      {t("nav.startTrial")}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="relative z-10">
        <section className={`mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20 ${pageText}`}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <div className={`mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
              isDarkMode ? "border-white/10 bg-white/6 text-white/80" : "border-slate-900/10 bg-slate-950/5 text-slate-700"
            }`}>
              <Zap className={`h-4 w-4 ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`} />
              {t("hero.badge", { count: countryCount })}
            </div>

            <h1 className="text-balance text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl lg:leading-[0.95]">
              The modern
              <br />
              business
              <br />
              <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                management
              </span>{" "}
              <span className="bg-gradient-to-r from-violet-200 to-cyan-300 bg-clip-text text-transparent">platform</span>
            </h1>

            <p className={`mt-6 max-w-xl text-lg leading-8 sm:text-xl ${pageMuted}`}>
              {t("hero.subtitle")}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link to="/auth/register">
                <Button className="group h-12 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-7 text-base font-semibold text-white shadow-xl shadow-violet-500/30 hover:from-violet-500 hover:to-cyan-400">
                  {t("hero.cta")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/auth/login">
                <Button
                  variant="outline"
                  className={`h-12 rounded-full px-7 text-base font-semibold ${
                    isDarkMode
                      ? "border-white/12 bg-white/5 text-white hover:bg-white/10"
                      : "border-slate-900/10 bg-white text-slate-950 hover:bg-slate-950/5"
                  }`}
                >
                  {t("hero.demo")}
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className={`rounded-full border px-4 py-2 text-sm ${isDarkMode ? "border-white/10 bg-white/6 text-white/75" : "border-slate-900/10 bg-white text-slate-700"}`}>
                {countryCount} countries
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm ${isDarkMode ? "border-white/10 bg-white/6 text-white/75" : "border-slate-900/10 bg-white text-slate-700"}`}>
                {businessKeys.length} verticals
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm ${isDarkMode ? "border-white/10 bg-white/6 text-white/75" : "border-slate-900/10 bg-white text-slate-700"}`}>
                Starter from {latestPriceLabel}
              </div>
            </div>

            <p className={`mt-8 flex items-center gap-2 text-sm ${pageSoft}`}>
              <Sparkles className={`h-4 w-4 ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`} />
              {t("hero.noCreditCard")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2.25rem] bg-gradient-to-tr from-violet-500/20 via-cyan-400/10 to-fuchsia-500/15 blur-3xl" />

            <div
              className={`relative overflow-hidden rounded-[2rem] border p-4 shadow-2xl backdrop-blur-xl transition-colors duration-500 ${
                isDarkMode ? "border-white/10 bg-slate-950/60 shadow-black/40" : "border-slate-900/10 bg-white/75 shadow-slate-900/10"
              }`}
            >
              <div
                className={`relative overflow-hidden rounded-[1.75rem] border transition-colors duration-500 ${
                  isDarkMode
                    ? "border-white/10 bg-slate-950/55 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                    : "border-slate-900/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10" />
                <div className="relative h-[620px] sm:h-[700px]">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={HERO_SLIDES[currentSlide]}
                      src={HERO_SLIDES[currentSlide]}
                      alt={`BetMatch slide ${currentSlide + 1}`}
                      initial={{ opacity: 0, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </AnimatePresence>

                  <div
                    className={`absolute inset-0 ${
                      isDarkMode
                        ? "bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent"
                        : "bg-gradient-to-t from-white via-white/20 to-transparent"
                    }`}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-4">
                    <div className="max-w-[72%]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-cyan-300" />
                        <span className="h-2 w-2 rounded-full bg-violet-300" />
                        <span className="h-2 w-2 rounded-full bg-fuchsia-300" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {HERO_SLIDES.map((slide, index) => (
                        <button
                          key={slide}
                          type="button"
                          aria-label={`Slide ${index + 1}`}
                          onClick={() => setCurrentSlide(index)}
                          className={`h-2.5 rounded-full transition-all ${
                            index === currentSlide ? "w-8 bg-white" : "w-2.5 bg-white/35 hover:bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="solutions" className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${sectionAccent}`}>Solutions</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Built for every business vertical</h2>
            </div>
            <a
              href="#pricing"
              className={`hidden items-center gap-2 text-sm font-medium transition md:flex ${
                isDarkMode ? "text-white/70 hover:text-white" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Explore pricing <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {businessKeys.map((business) => {
              const Icon = business.icon;
              return (
                <motion.div
                  key={business.id}
                  whileHover={{ y: -4 }}
                  className={`rounded-3xl border p-5 shadow-lg backdrop-blur-sm ${panelCard}`}
                >
                  <div className={`mb-4 inline-flex rounded-2xl border p-3 ${panelSoft} ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{t(`businesses.${business.id}.name`)}</h3>
                  <p className={`mt-2 text-sm leading-6 ${pageSoft}`}>{t(`businesses.${business.id}.desc`)}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Team & role management",
                desc: "Barbers, cashiers and owners keep the right access at the right time.",
              },
              {
                icon: Globe,
                title: "Multi-country pricing",
                desc: "Prices adapt to the detected market and the selected currency.",
              },
              {
                icon: Layers,
                title: "One platform, many verticals",
                desc: "Beauty, pharmacy, restaurant, retail and service businesses all in one product.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className={`rounded-3xl border p-6 ${panelCard}`}>
                  <div className={`mb-4 inline-flex rounded-2xl border p-3 ${panelSoft} ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className={`text-xl font-semibold ${pageText}`}>{feature.title}</h3>
                  <p className={`mt-3 text-sm leading-6 ${pageSoft}`}>{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
              <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${sectionAccent}`}>{t("pricing.title")}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("pricing.subtitle")}</h2>
            <p className={`mt-3 text-sm ${pageSoft}`}>
              {isLoading ? "Loading country pricing..." : `${countryCount} countries loaded for ${detectedRegionName}`}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 items-start">
            {availablePlans.map((plan, index) => {
              const planPrice = priceForPlan(plan.name);
              const monthlyPrice = planPrice?.monthly_price ?? plan.monthly_price;
              const currencyCode = planPrice?.currency_code ?? "HTG";
              const featureList = planFeatures.get(plan.id) || [];
              const enabledFeatures = featureList.filter((f) => f.enabled);
              const isPopular = availablePlans.length > 1 && index === Math.floor(availablePlans.length / 2);
              const formattedAmount = new Intl.NumberFormat("fr-FR").format(monthlyPrice);

              const displayFeatures: { label: string }[] = [];
              if (plan.max_businesses !== null) {
                displayFeatures.push({ label: `${plan.max_businesses} entreprise${plan.max_businesses !== 1 ? "s" : ""}` });
              } else {
                displayFeatures.push({ label: "Entreprises illimitées" });
              }
              if (plan.max_branches !== null) {
                displayFeatures.push({ label: `${plan.max_branches} succursale${plan.max_branches !== 1 ? "s" : ""}` });
              } else {
                displayFeatures.push({ label: "Succursales illimitées" });
              }
              if (plan.max_staff !== null) {
                displayFeatures.push({ label: `${plan.max_staff} employé${plan.max_staff !== 1 ? "s" : ""}` });
              } else {
                displayFeatures.push({ label: "Employés illimités" });
              }
              displayFeatures.push(
                ...enabledFeatures.slice(0, 2).map((f) => ({ label: f.feature_label || f.feature_key.replace(/_/g, " ") }))
              );

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-[1.85rem] border p-8 transition-all duration-300 ${
                    isPopular
                      ? isDarkMode
                        ? "border-cyan-400/40 bg-gradient-to-b from-[#1a1a35] to-[#12112a] shadow-[0_0_50px_rgba(34,211,238,0.15)] scale-[1.02] md:scale-[1.05]"
                        : "border-cyan-500/30 bg-gradient-to-b from-white to-slate-50 shadow-[0_0_50px_rgba(34,211,238,0.2)] scale-[1.02] md:scale-[1.05]"
                      : isDarkMode
                        ? "border-white/8 bg-[#12112a] hover:border-white/15"
                        : "border-slate-900/10 bg-white hover:border-slate-900/20"
                  }`}
                >
                  {isPopular && (
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-cyan-400/30">
                      <Star className="h-3.5 w-3.5" />
                      Le plus populaire
                    </div>
                  )}

                  <p className={`text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-white/50" : "text-slate-500"}`}>
                    {plan.name}
                  </p>

                  {plan.description && (
                    <p className={`mt-2 text-xs leading-5 ${isDarkMode ? "text-white/50" : "text-slate-500"}`}>
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-6 mb-6">
                    <div className={`font-extrabold leading-none tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"} text-[3.5rem] sm:text-[4rem] lg:text-[4.5rem]`}>
                      {formattedAmount}
                    </div>
                    <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white/70" : "text-slate-600"}`}>
                      {currencyCode} / {t("pricing.monthly")}
                    </div>
                  </div>

                  <div className={`flex-1 space-y-3.5 ${isPopular ? "mb-8" : "mb-6"}`}>
                    {displayFeatures.map((feature) => (
                      <div key={feature.label} className="flex items-start gap-3 text-sm leading-6">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isDarkMode ? "text-cyan-400" : "text-cyan-600"}`} />
                        <span className={isDarkMode ? "text-white/80" : "text-slate-700"}>{feature.label}</span>
                      </div>
                    ))}
                  </div>

                  <Link to="/auth/register" className="block">
                    <Button
                      className={`h-12 w-full rounded-xl font-semibold text-sm transition-all duration-200 ${
                        isPopular
                          ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:from-violet-500 hover:to-cyan-400 hover:shadow-cyan-500/40"
                          : isDarkMode
                            ? "border border-white/12 bg-white/5 text-white hover:bg-white/10"
                            : "border border-slate-900/10 bg-white text-slate-950 hover:bg-slate-950/5"
                      }`}
                      variant={isPopular ? "default" : "outline"}
                    >
                      Commencer
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 pb-20 sm:px-6 lg:px-8">
          <div className={`rounded-[2rem] border px-7 py-8 shadow-2xl ${isDarkMode ? "border-white/10 bg-gradient-to-r from-violet-500/18 via-slate-950/60 to-cyan-500/18 shadow-black/20" : "border-slate-900/10 bg-gradient-to-r from-violet-100 via-white to-cyan-100 shadow-slate-900/10"}`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${sectionAccent}`}>Get started</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  Launch Wesd Systems with your real pricing and real country coverage.
                </h2>
                <p className={`mt-3 ${pageMuted}`}>
                  The landing page now reflects the actual data loaded from Supabase: supported countries, detected region, and plan prices.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to="/auth/register">
                  <Button className="h-12 rounded-full bg-white px-6 font-semibold text-slate-950 hover:bg-white/90">
                    {t("nav.startTrial")}
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button
                    variant="outline"
                    className={`h-12 rounded-full px-6 font-semibold ${
                      isDarkMode
                        ? "border-white/12 bg-white/5 text-white hover:bg-white/10"
                        : "border-slate-900/10 bg-white text-slate-950 hover:bg-slate-950/5"
                    }`}
                  >
                    {t("nav.signIn")}
                  </Button>
                </Link>

                {/* Android APK Download Button */}
                <a
                  href="/wesd-systems.apk"
                  download="wesd-systems.apk"
                  className={`flex h-12 items-center gap-2 rounded-full px-6 font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isDarkMode
                      ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                      : "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                  }`}
                >
                  <Smartphone className="h-5 w-5" />
                  Télécharger l'APK Android
                </a>

              </div>
            </div>
          </div>
        </section>

        <CommunityActivitySection />
      </main>

      {/* ── WhatsApp Support Floating Button ── */}
      <a
        href="https://wa.me/50931966855"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-[#25D366]/50 group"
        title="Contacter le support via WhatsApp"
      >
        <MessageCircle className="h-7 w-7 transition-transform group-hover:rotate-12" />
      </a>
    </div>
  );
}
