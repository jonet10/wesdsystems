import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Star, Scissors, Pill, Utensils, ShoppingBag, Building, ChevronRight, Globe, Zap, Shield, BarChart3, Users, Layers, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// Define the businesses for the solutions section
const businessKeys = [
  { id: "salon", icon: Scissors, color: "bg-blue-50 text-blue-600" },
  { id: "pharmacy", icon: Pill, color: "bg-emerald-50 text-emerald-600" },
  { id: "restaurant", icon: Utensils, color: "bg-orange-50 text-orange-600" },
  { id: "market", icon: ShoppingBag, color: "bg-cyan-50 text-cyan-600" },
  { id: "boutique", icon: Building, color: "bg-purple-50 text-purple-600" },
];

const features = [
  { icon: Zap, title: "Lightning-fast POS", desc: "Process transactions in under 3 seconds on any device." },
  { icon: Users, title: "Team & Role Management", desc: "Granular permissions for owners, managers, and staff." },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Live revenue, top products, and employee performance." },
  { icon: Globe, title: "Multi-currency", desc: "USD, EUR, HTG, CAD, and more — auto-detected." },
  { icon: Shield, title: "Secure & Private", desc: "End-to-end encrypted data with automatic cloud backups." },
  { icon: Layers, title: "Multi-business", desc: "Switch between business types instantly from one dashboard." },
];

const images = ["/images/1.jpg", "/images/2.jpg", "/images/3.png", "/images/4.jpg"];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("salon");
  const [currentImage, setCurrentImage] = useState(0);
  const [localCurrency, setLocalCurrency] = useState("USD");
  const [localPrice, setLocalPrice] = useState({ starter: 39, pro: 79, enterprise: 139 });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-detect pricing based on timezone
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Port-au-Prince") || tz.includes("Haiti")) {
      setLocalCurrency("HTG");
      setLocalPrice({ starter: 1000, pro: 2500, enterprise: 5000 });
    } else if (tz.includes("Toronto") || tz.includes("Vancouver") || tz.includes("Montreal")) {
      setLocalCurrency("CAD");
      setLocalPrice({ starter: 49, pro: 99, enterprise: 179 });
    } else if (tz.includes("Europe") || tz.includes("Paris") || tz.includes("Madrid")) {
      setLocalCurrency("EUR");
      setLocalPrice({ starter: 35, pro: 75, enterprise: 129 });
    } else {
      setLocalCurrency("USD");
      setLocalPrice({ starter: 39, pro: 79, enterprise: 139 });
    }
  }, []);

  // Image Carousel Auto-play
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const activeBiz = businessKeys.find(b => b.id === activeTab) || businessKeys[0];
  const ActiveIcon = activeBiz.icon;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#solutions" className="hover:text-gray-900 transition-colors">{t('nav.solutions')}</a>
            <a href="#features" className="hover:text-gray-900 transition-colors">{t('nav.features')}</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">{t('nav.pricing')}</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
              {['en', 'fr', 'es', 'ht'].map((lang) => (
                <button 
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`text-xs font-bold uppercase px-2 py-1 rounded-md transition-colors ${i18n.language.startsWith(lang) ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <Link to="/auth/login"><Button variant="ghost" className="text-gray-700 font-semibold">{t('nav.signIn')}</Button></Link>
            <Link to="/auth/register"><Button className="bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-full px-5 shadow-md hover:shadow-lg transition-all">{t('nav.startTrial')}</Button></Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2 text-gray-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-b border-gray-100 px-6 py-4 overflow-hidden"
            >
              <div className="flex flex-col gap-4">
                <a href="#solutions" className="text-gray-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.solutions')}</a>
                <a href="#features" className="text-gray-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.features')}</a>
                <a href="#pricing" className="text-gray-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.pricing')}</a>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {['en', 'fr', 'es', 'ht'].map((lang) => (
                    <button key={lang} onClick={() => { changeLanguage(lang); setIsMobileMenuOpen(false); }} className="text-xs font-bold uppercase bg-gray-50 px-3 py-1.5 rounded-md">{lang}</button>
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Link to="/auth/login" className="w-full"><Button variant="outline" className="w-full">{t('nav.signIn')}</Button></Link>
                  <Link to="/auth/register" className="w-full"><Button className="w-full bg-gray-900 text-white">{t('nav.startTrial')}</Button></Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden min-h-screen flex items-center">
        {/* Animated Background GIF */}
        <div className="absolute inset-0 z-0">
          <img src="/images/Background.gif" alt="Background Animation" className="w-full h-full object-cover" />
        </div>
        {/* Lighter overlay so the animated background remains clearly visible */}
        <div className="absolute inset-0 z-10 bg-white/10 backdrop-blur-0" />
        
        <div className="absolute top-0 right-0 z-10 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-blue-50/20 rounded-full blur-3xl" />
        <div className="relative z-20 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100/80 border border-gray-200 text-gray-700 text-xs font-semibold mb-8 backdrop-blur-sm">
              <Globe className="h-3.5 w-3.5" />
              {t('hero.badge')}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6 leading-[1.1]">
              {t('hero.title1')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500">
                {t('hero.title2')}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-500 mb-10 leading-relaxed max-w-lg text-balance">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth/register">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 h-12 rounded-full shadow-lg shadow-blue-600/20 w-full sm:w-auto text-base transition-all hover:scale-105 active:scale-95">
                  {t('hero.cta')} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/auth/login">
                <Button variant="outline" className="border-gray-200 text-gray-700 font-semibold h-12 px-8 rounded-full w-full sm:w-auto hover:bg-gray-50 transition-all">
                  {t('hero.demo')}
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-xs text-gray-400 font-medium">{t('hero.noCreditCard')}</p>
          </motion.div>

          {/* Hero Carousel */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl shadow-gray-200/50 border border-gray-100/50 bg-gray-50 group"
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImage}
                src={images[currentImage]}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full object-cover"
                alt="Wesd Systems Preview"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-60" />
            
            {/* Carousel Indicators */}
            <div className="absolute bottom-6 inset-x-0 flex justify-center gap-2 z-10">
              {images.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={() => setCurrentImage(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImage ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Solutions Tabs ── */}
      <section id="solutions" className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">Built for every type of business</h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">Switch between verticals instantly. One login, every tool you need.</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {businessKeys.map(b => {
              const Icon = b.icon;
              const isSelected = activeTab === b.id;
              return (
                <button 
                  key={b.id} 
                  onClick={() => setActiveTab(b.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                    isSelected 
                    ? "bg-gray-900 text-white shadow-md shadow-gray-900/10" 
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? "text-white" : ""}`} />
                  {t(`businesses.${b.id}.name`)}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              transition={{ duration: 0.3 }}
              className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 p-8 md:p-12 max-w-5xl mx-auto overflow-hidden relative"
            >
              <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                <div className="text-left">
                  <div className={`inline-flex p-4 rounded-2xl mb-6 ${activeBiz.color}`}>
                    <ActiveIcon className="h-8 w-8" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">{t(`businesses.${activeTab}.name`)}</h3>
                  <p className="text-lg text-gray-500 leading-relaxed mb-8">{t(`businesses.${activeTab}.desc`)}</p>
                  <Link to="/auth/register">
                    <Button className="bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-full h-12 px-8 text-sm group">
                      Try module <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
                
                {/* Abstract UI representation */}
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 shadow-inner relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><ActiveIcon className="w-32 h-32" /></div>
                  <div className="space-y-4 relative z-10">
                    <div className="h-8 w-1/3 bg-gray-200 rounded-lg animate-pulse" />
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${activeBiz.color} opacity-20`} />
                          <div className="space-y-2">
                            <div className="h-3 w-24 bg-gray-200 rounded-full" />
                            <div className="h-2 w-16 bg-gray-100 rounded-full" />
                          </div>
                        </div>
                        <div className="h-4 w-12 bg-gray-200 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Pricing (Geo-detected) ── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">{t('pricing.title')}</h2>
            <p className="text-lg text-gray-500 mb-6">{t('pricing.subtitle')}</p>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
              <Globe className="w-4 h-4" /> Detected Region: {localCurrency}
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="p-8 rounded-3xl bg-white border border-gray-200 hover:shadow-xl transition-shadow flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('pricing.starter')}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold text-gray-900">{localPrice.starter} {localCurrency}</span>
                <span className="text-gray-500 font-medium">{t('pricing.monthly')}</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {["1 Business", "Up to 3 staff", "Standard POS", "Email support"].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-600">
                    <Check className="h-5 w-5 text-gray-900 shrink-0"/> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/register"><Button variant="outline" className="w-full rounded-full h-12 font-semibold text-base">{t('pricing.getStarted')}</Button></Link>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl bg-gray-900 text-white shadow-2xl relative flex flex-col scale-105 z-10 border border-gray-800">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                {t('pricing.mostPopular')}
              </div>
              <h3 className="text-xl font-bold mb-2">{t('pricing.pro')}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold">{localPrice.pro} {localCurrency}</span>
                <span className="text-gray-400 font-medium">{t('pricing.monthly')}</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {["2 Businesses", "Up to 15 staff", "Advanced analytics", "Priority support"].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <Check className="h-5 w-5 text-blue-400 shrink-0"/> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/register"><Button className="w-full rounded-full h-12 font-semibold text-base bg-blue-600 hover:bg-blue-500 text-white">{t('pricing.getStarted')}</Button></Link>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl bg-white border border-gray-200 hover:shadow-xl transition-shadow flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('pricing.enterprise')}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold text-gray-900">{localPrice.enterprise} {localCurrency}</span>
                <span className="text-gray-500 font-medium">{t('pricing.monthly')}</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {["Unlimited Businesses", "Unlimited staff", "Custom API access", "24/7 Phone support"].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-600">
                    <Check className="h-5 w-5 text-gray-900 shrink-0"/> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/register"><Button variant="outline" className="w-full rounded-full h-12 font-semibold text-base">{t('pricing.getStarted')}</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-50 py-16 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
          <div>
            <Logo />
            <p className="text-sm mt-4 text-gray-500">The modern ERP & POS platform for every type of business, anywhere in the world.</p>
          </div>
          <div><h4 className="font-bold text-gray-900 mb-4">Product</h4><ul className="space-y-2 text-sm text-gray-500"><li>POS</li><li>Analytics</li><li>Inventory</li></ul></div>
          <div><h4 className="font-bold text-gray-900 mb-4">Company</h4><ul className="space-y-2 text-sm text-gray-500"><li>About</li><li>Careers</li><li>Contact</li></ul></div>
          <div><h4 className="font-bold text-gray-900 mb-4">Legal</h4><ul className="space-y-2 text-sm text-gray-500"><li>Privacy Policy</li><li>Terms of Service</li></ul></div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
          © 2026 Wesd Systems. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
