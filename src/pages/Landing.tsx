import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Building,
  Check,
  DollarSign,
  FileText,
  Globe,
  LayoutGrid,
  Layers,
  Menu,
  Pill,
  ChevronRight,
  BarChart3,
  Clock3,
  Scissors,
  ShoppingBag,
  Star,
  Shield,
  Sparkles,
  PieChart as PieChartIcon,
  TrendingUp,
  Utensils,
  Users,
  X,
  MoreHorizontal,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { usePricing } from "@/contexts/PricingContext";

const businessKeys = [
  { id: "salon", icon: Scissors },
  { id: "pharmacy", icon: Pill },
  { id: "restaurant", icon: Utensils },
  { id: "market", icon: ShoppingBag },
  { id: "boutique", icon: Building },
] as const;

const LANGUAGE_CODES = ["en", "fr", "es", "ht"] as const;
const PIE_COLORS = ["#8b5cf6", "#22d3ee", "#14b8a6"];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const { detectedRegionName, detectedCountry, availableCountries, setCountryPreference, priceForPlan, formatPrice, isLoading } =
    usePricing();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const starterPrice = priceForPlan("Starter") || priceForPlan("Basic");
  const proPrice = priceForPlan("Pro");
  const enterprisePrice = priceForPlan("Enterprise") || priceForPlan("Premium");

  const countryCount = availableCountries.length || 31;

  const priceChartData = useMemo(
    () => [
      {
        name: "Starter",
        value: starterPrice?.monthly_price ?? 0,
      },
      {
        name: "Pro",
        value: proPrice?.monthly_price ?? 0,
      },
      {
        name: "Enterprise",
        value: enterprisePrice?.monthly_price ?? 0,
      },
    ],
    [enterprisePrice?.monthly_price, proPrice?.monthly_price, starterPrice?.monthly_price]
  );

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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.25),transparent_38%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),linear-gradient(180deg,#050816_0%,#09041a_45%,#0a0815_100%)] text-white">
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:44px_44px]" />

      <nav className="sticky top-0 z-50 border-b border-white/8 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link to="/" className="relative z-10">
            <Logo size="md" />
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-white/75 md:flex">
            <a href="#solutions" className="transition-colors hover:text-white">
              {t("nav.solutions")}
            </a>
            <a href="#features" className="transition-colors hover:text-white">
              {t("nav.features")}
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              {t("nav.pricing")}
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {LANGUAGE_CODES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                    i18n.language.startsWith(lang)
                      ? "bg-white text-slate-950"
                      : "text-white/60 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <Link to="/auth/login">
              <Button variant="ghost" className="rounded-full text-white/80 hover:bg-white/8 hover:text-white">
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
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white md:hidden"
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
              className="border-t border-white/8 bg-slate-950/95 px-5 py-4 md:hidden"
            >
              <div className="flex flex-col gap-4">
                <a href="#solutions" onClick={() => setIsMobileMenuOpen(false)} className="text-white/80">
                  {t("nav.solutions")}
                </a>
                <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-white/80">
                  {t("nav.features")}
                </a>
                <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-white/80">
                  {t("nav.pricing")}
                </a>
                <div className="flex gap-2 pt-2">
                  {LANGUAGE_CODES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        changeLanguage(lang);
                        setIsMobileMenuOpen(false);
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase text-white/80"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <Link to="/auth/login" className="flex-1">
                    <Button variant="outline" className="w-full rounded-full border-white/10 bg-transparent text-white">
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
        <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white/80">
              <Zap className="h-4 w-4 text-cyan-300" />
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

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68 sm:text-xl">
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
                  className="h-12 rounded-full border-white/12 bg-white/5 px-7 text-base font-semibold text-white hover:bg-white/10"
                >
                  {t("hero.demo")}
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                {countryCount} countries
              </div>
              <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                {businessKeys.length} verticals
              </div>
              <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                Starter from {latestPriceLabel}
              </div>
            </div>

            <p className="mt-8 flex items-center gap-2 text-sm text-white/55">
              <Sparkles className="h-4 w-4 text-cyan-300" />
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

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white/75">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                  {t("hero.badge", { count: countryCount })}
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/70">
                    Full chart
                  </button>
                  <button className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/70">
                    Decorations
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    <span className="h-2 w-2 rounded-full bg-violet-300" />
                    <span className="h-2 w-2 rounded-full bg-fuchsia-300" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[56px_1.35fr_0.9fr]">
                <div className="hidden flex-col items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 py-4 text-white/55 xl:flex">
                  <div className="rounded-2xl bg-cyan-400/15 p-2 text-cyan-300">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl p-2 hover:bg-white/8">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl p-2 hover:bg-white/8">
                    <PieChartIcon className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl p-2 hover:bg-white/8">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl p-2 hover:bg-white/8">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/7 to-white/4 p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white/55">Sales Performance</p>
                        <p className="text-2xl font-bold tracking-tight">
                          {starterPrice ? formatPrice(starterPrice.monthly_price, starterPrice.currency_code) : "—"}
                        </p>
                        <p className="text-xs text-white/45">Starter plan, detected market</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs font-medium text-white/70">
                        All month
                      </div>
                    </div>

                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={priceChartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="priceGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.58} />
                              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                          <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} width={32} />
                          <Tooltip
                            cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                            contentStyle={{
                              background: "rgba(2, 6, 23, 0.95)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 16,
                              color: "#fff",
                            }}
                            labelStyle={{ color: "#cbd5e1" }}
                            formatter={(value: number) =>
                              starterPrice ? [formatPrice(value, starterPrice.currency_code), "Monthly price"] : [value, "Monthly price"]
                            }
                          />
                          <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={3} fill="url(#priceGlow)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { title: "Gross profit", value: latestPriceLabel, icon: DollarSign },
                      { title: "Active customers", value: `${countryCount * 413}`, icon: Users },
                    ].map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.title} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-medium text-white/55">{card.title}</p>
                            <Icon className="h-4 w-4 text-cyan-300" />
                          </div>
                          <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                          <div className="mt-2 h-1.5 rounded-full bg-white/8">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: "72%" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/55">Revenue by category</p>
                        <p className="text-xl font-semibold">Live distribution</p>
                      </div>
                      <PieChartIcon className="h-5 w-5 text-cyan-300" />
                    </div>

                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={coverageData}
                            dataKey="value"
                            innerRadius={42}
                            outerRadius={62}
                            paddingAngle={4}
                          >
                            {coverageData.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "rgba(2, 6, 23, 0.95)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 16,
                              color: "#fff",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 pt-2">
                      {coverageData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="text-sm font-medium text-white/80">{item.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/55">Top products</p>
                        <p className="text-lg font-semibold">Team hours</p>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-white/40" />
                    </div>

                    <div className="space-y-3">
                      {visibleCountries.map((country, index) => (
                        <div key={country.country_code} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-white/85">{country.country_name}</p>
                            <p className="text-xs text-white/45">{country.currency_code}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">{36 - index * 4} hrs</p>
                            <div className="mt-1 h-1.5 w-24 rounded-full bg-white/8">
                              <div
                                className="h-1.5 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
                                style={{ width: `${92 - index * 14}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3">
                        <p className="text-xs uppercase tracking-wider text-white/45">Avg ticket</p>
                        <p className="mt-1 text-lg font-bold">{latestPriceLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3">
                        <p className="text-xs uppercase tracking-wider text-white/45">Open branches</p>
                        <p className="mt-1 text-lg font-bold">{businessKeys.length + 2}</p>
                      </div>
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
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Solutions</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Built for every business vertical</h2>
            </div>
            <a href="#pricing" className="hidden items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white md:flex">
              Explore pricing <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {businessKeys.map((business) => {
              const Icon = business.icon;
              return (
                <motion.div
                  key={business.id}
                  whileHover={{ y: -4 }}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10 backdrop-blur-sm"
                >
                  <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{t(`businesses.${business.id}.name`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{t(`businesses.${business.id}.desc`)}</p>
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
                desc: "Salon, pharmacy, restaurant, market and boutique all in one product.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">{t("pricing.title")}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("pricing.subtitle")}</h2>
            <p className="mt-3 text-sm text-white/55">
              {isLoading ? "Loading country pricing..." : `${countryCount} countries loaded for ${detectedRegionName}`}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              { key: "starter", title: t("pricing.starter"), price: starterPrice, features: ["1 business", "3 staff", "Standard POS"] },
              { key: "pro", title: t("pricing.pro"), price: proPrice, features: ["2 businesses", "10 staff", "Advanced analytics"] },
              { key: "enterprise", title: t("pricing.enterprise"), price: enterprisePrice, features: ["Unlimited businesses", "Unlimited staff", "Priority support"] },
            ].map((plan, index) => {
              const featured = plan.key === "pro";
              return (
                <div
                  key={plan.key}
                  className={`relative overflow-hidden rounded-[1.75rem] border p-7 shadow-xl shadow-black/10 ${
                    featured
                      ? "border-cyan-400/30 bg-gradient-to-br from-violet-500/18 to-cyan-500/16"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {featured && (
                    <div className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-950">
                      <Star className="h-3.5 w-3.5" />
                      Most popular
                    </div>
                  )}
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/50">{plan.title}</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-4xl font-black">
                      {plan.price ? formatPrice(plan.price.monthly_price, plan.price.currency_code) : "—"}
                    </span>
                    <span className="pb-1 text-sm text-white/50">{t("pricing.monthly")}</span>
                  </div>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3 text-sm text-white/70">
                        <Check className="h-4 w-4 text-cyan-300" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <Link to="/auth/register" className="mt-8 block">
                    <Button
                      className={`h-12 w-full rounded-full font-semibold ${
                        featured
                          ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
                          : "border border-white/12 bg-white/5 text-white hover:bg-white/10"
                      }`}
                      variant={featured ? "default" : "outline"}
                    >
                      {t("pricing.getStarted")}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-violet-500/18 via-slate-950/60 to-cyan-500/18 px-7 py-8 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Get started</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  Launch Wesd Systems with your real pricing and real country coverage.
                </h2>
                <p className="mt-3 text-white/65">
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
                    className="h-12 rounded-full border-white/12 bg-white/5 px-6 font-semibold text-white hover:bg-white/10"
                  >
                    {t("nav.signIn")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
