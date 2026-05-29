import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Star, Scissors, Pill, Utensils, ShoppingBag, Building, ChevronRight, Globe, Zap, Shield, BarChart3, Users, Layers, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePricing } from "@/contexts/PricingContext";

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
  const { detectedRegionName, detectedCountry, availableCountries, setCountryPreference, priceForPlan, formatPrice } = usePricing();
  const [activeTab, setActiveTab] = useState("salon");
  const [currentImage, setCurrentImage] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Image Carousel Auto-play
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const activeBiz = businessKeys.find(b => b.id === activeTab) || businessKeys[0];
  const ActiveIcon = activeBiz.icon;
  const starterPrice = priceForPlan("Starter") || priceForPlan("Basic");
  const proPrice = priceForPlan("Pro");
  const enterprisePrice = priceForPlan("Enterprise") || priceForPlan("Premium");

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white font-sans selection:bg-purple-500/20 selection:text-purple-100 overflow-x-hidden">
      
      {/* ── Animated Background Elements ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Gradient Orbs */}
        <motion.div 
          animate={{ 
            x: [0, 100, -100, 0],
            y: [0, -50, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 100, 0],
            y: [0, 50, -50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            x: [0, 80, -80, 0],
            y: [0, 100, -100, 0]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 right-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"
        />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[length:50px_50px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-purple-500/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Logo />
          </motion.div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-purple-200">
            <a href="#solutions" className="hover:text-purple-400 transition-colors relative group">{t('nav.solutions')}<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 group-hover:w-full transition-all duration-300" /></a>
            <a href="#features" className="hover:text-purple-400 transition-colors relative group">{t('nav.features')}<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 group-hover:w-full transition-all duration-300" /></a>
            <a href="#pricing" className="hover:text-purple-400 transition-colors relative group">{t('nav.pricing')}<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 group-hover:w-full transition-all duration-300" /></a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1 border-r border-purple-500/20 pr-4">
              {['en', 'fr', 'es', 'ht'].map((lang) => (
                <button 
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`text-xs font-bold uppercase px-2 py-1 rounded-md transition-all ${i18n.language.startsWith(lang) ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50' : 'text-purple-400/60 hover:text-purple-300'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <Link to="/auth/login"><Button variant="ghost" className="text-purple-300 font-semibold hover:text-purple-100 hover:bg-purple-500/10">{t('nav.signIn')}</Button></Link>
            <Link to="/auth/register"><Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-semibold rounded-full px-6 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all">{t('nav.startTrial')}</Button></Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2 text-purple-300" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
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
              className="md:hidden bg-slate-900/80 backdrop-blur-md border-b border-purple-500/20 px-6 py-4 overflow-hidden"
            >
              <div className="flex flex-col gap-4">
                <a href="#solutions" className="text-purple-300 font-medium hover:text-purple-100 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.solutions')}</a>
                <a href="#features" className="text-purple-300 font-medium hover:text-purple-100 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.features')}</a>
                <a href="#pricing" className="text-purple-300 font-medium hover:text-purple-100 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.pricing')}</a>
                <div className="flex items-center gap-2 pt-2 border-t border-purple-500/20">
                  {['en', 'fr', 'es', 'ht'].map((lang) => (
                    <button key={lang} onClick={() => { changeLanguage(lang); setIsMobileMenuOpen(false); }} className="text-xs font-bold uppercase bg-purple-500/20 px-3 py-1.5 rounded-md text-purple-300">{lang}</button>
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Link to="/auth/login" className="w-full"><Button variant="outline" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10">{t('nav.signIn')}</Button></Link>
                  <Link to="/auth/register" className="w-full"><Button className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white">{t('nav.startTrial')}</Button></Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden min-h-screen flex items-center z-10">
        <div className="relative z-20 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left Content */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 text-xs font-semibold mb-8 backdrop-blur-sm hover:bg-purple-500/20 transition-colors"
            >
              <motion.span 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="h-3.5 w-3.5" />
              </motion.span>
              {t('hero.badge')}
            </motion.div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              {t('hero.title1')} <br />
              <motion.span 
                className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                {t('hero.title2')}
              </motion.span>
            </h1>

            {/* Subtitle */}
            <motion.p 
              className="text-lg md:text-xl text-purple-200/80 mb-10 leading-relaxed max-w-lg text-balance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              {t('hero.subtitle')}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <Link to="/auth/register">
                <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-semibold px-8 h-12 rounded-full shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 w-full sm:w-auto text-base transition-all hover:scale-105 active:scale-95 group">
                  {t('hero.cta')} <motion.span className="inline-block group-hover:translate-x-1 transition-transform"><ArrowRight className="h-4 w-4 ml-2" /></motion.span>
                </Button>
              </Link>
              <Link to="/auth/login">
                <Button className="border border-purple-400/50 text-purple-300 font-semibold h-12 px-8 rounded-full w-full sm:w-auto hover:bg-purple-500/10 hover:border-purple-400 transition-all bg-purple-500/5 backdrop-blur-sm">
                  {t('hero.demo')}
                </Button>
              </Link>
            </motion.div>

            {/* Bottom Text */}
            <motion.p 
              className="mt-8 text-xs text-purple-300/60 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              ✨ {t('hero.noCreditCard')}
            </motion.p>
          </motion.div>

          {/* Right Visual Element */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotateY: -20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block h-96 md:h-[600px]"
          >
            {/* Floating Dashboard Card */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden border border-purple-400/20 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 backdrop-blur-xl shadow-2xl shadow-purple-500/20">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(168,85,247,0.1)_1px,transparent_1px),linear-gradient(-45deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[length:40px_40px]" />
              
              {/* Dashboard Content */}
              <div className="relative p-8 h-full flex flex-col justify-between">
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 bg-gradient-to-r from-purple-400/30 to-cyan-400/30 rounded-full" />
                    <div className="flex gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-2 w-2 rounded-full bg-purple-400/20" />
                      ))}
                    </div>
                  </div>
                  <div className="h-2 w-32 bg-gradient-to-r from-purple-400/20 to-cyan-400/20 rounded-full" />
                </div>

                {/* Stats */}
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <motion.div 
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-purple-400/5 border border-purple-400/10 hover:border-purple-400/20 transition-colors group cursor-pointer"
                      whileHover={{ x: 4 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-cyan-500/30 group-hover:from-purple-500/50 group-hover:to-cyan-500/50 transition-colors" />
                        <div className="space-y-1">
                          <div className="h-2 w-16 bg-purple-400/30 rounded-full" />
                          <div className="h-1.5 w-12 bg-purple-400/20 rounded-full" />
                        </div>
                      </div>
                      <div className="h-4 w-8 bg-gradient-to-r from-purple-400/30 to-cyan-400/30 rounded-full" />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Animated Border */}
              <motion.div 
                className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-cyan-500/0 to-purple-500/0 pointer-events-none"
                animate={{
                  backgroundImage: [
                    'linear-gradient(90deg, rgba(168,85,247,0) 0%, rgba(34,211,238,0) 50%, rgba(168,85,247,0) 100%)',
                    'linear-gradient(90deg, rgba(168,85,247,0.3) 0%, rgba(34,211,238,0.3) 50%, rgba(168,85,247,0.3) 100%)',
                    'linear-gradient(90deg, rgba(168,85,247,0) 0%, rgba(34,211,238,0) 50%, rgba(168,85,247,0) 100%)',
                  ]
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </div>

            {/* Floating Elements */}
            <motion.div 
              className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none"
              animate={{ 
                y: [0, 20, 0],
                x: [0, 10, 0]
              }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            <motion.div 
              className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl pointer-events-none"
              animate={{ 
                y: [0, -20, 0],
                x: [0, -10, 0]
              }}
              transition={{ duration: 7, repeat: Infinity }}
            />
          </motion.div>
        </div>
      </section>

      {/* ── Solutions Tabs ── */}
      <section id="solutions" className="relative py-32 overflow-hidden z-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.02)_1px,transparent_1px)] bg-[length:50px_50px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Section Header */}
          <div className="text-center mb-16">
            <motion.h2 
              className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">every business</span>
            </motion.h2>
            <motion.p 
              className="text-lg text-purple-200/70 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
            >
              Switch between verticals instantly. One login, every tool you need.
            </motion.p>
          </div>
          
          {/* Business Tabs */}
          <motion.div 
            className="flex flex-wrap justify-center gap-3 mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            viewport={{ once: true }}
          >
            {businessKeys.map((b, idx) => {
              const Icon = b.icon;
              const isSelected = activeTab === b.id;
              return (
                <motion.button 
                  key={b.id} 
                  onClick={() => setActiveTab(b.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                    isSelected 
                    ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/40" 
                    : "bg-purple-500/10 text-purple-300 border border-purple-400/30 hover:border-purple-400/60 hover:bg-purple-500/20"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="h-4 w-4" />
                  {t(`businesses.${b.id}.name`)}
                </motion.button>
              );
            })}
          </motion.div>

          {/* Business Content */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab} 
              initial={{ opacity: 0, y: 20, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -20, scale: 0.95 }} 
              transition={{ duration: 0.4 }}
              className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 backdrop-blur-xl rounded-3xl border border-purple-400/20 p-8 md:p-16 max-w-5xl mx-auto overflow-hidden relative"
            >
              {/* Animated Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(168,85,247,0.05)_1px,transparent_1px),linear-gradient(-45deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[length:30px_30px]" />
              
              <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                {/* Left Content */}
                <div className="text-left">
                  <motion.div 
                    className={`inline-flex p-4 rounded-2xl mb-6 ${activeBiz.color}`}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ActiveIcon className="h-8 w-8" />
                  </motion.div>
                  <h3 className="text-4xl font-bold text-white mb-4">{t(`businesses.${activeTab}.name`)}</h3>
                  <p className="text-lg text-purple-200/80 leading-relaxed mb-10">{t(`businesses.${activeTab}.desc`)}</p>
                  <Link to="/auth/register">
                    <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-semibold rounded-full h-12 px-8 text-sm shadow-lg shadow-purple-500/40 group">
                      Try module <motion.span className="inline-block group-hover:translate-x-1 transition-transform"><ChevronRight className="h-4 w-4 ml-1" /></motion.span>
                    </Button>
                  </Link>
                </div>
                
                {/* Right Visual */}
                <motion.div 
                  className="relative h-96 rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 backdrop-blur-sm p-6 overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(168,85,247,0.1)_1px,transparent_1px),linear-gradient(-45deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
                  
                  {/* Content Skeleton */}
                  <div className="relative z-10 space-y-4 h-full flex flex-col">
                    <motion.div 
                      className="h-8 w-1/3 bg-gradient-to-r from-purple-400/30 to-cyan-400/30 rounded-lg"
                      animate={{ backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    {[1, 2, 3].map((i) => (
                      <motion.div 
                        key={i}
                        className="flex-1 p-4 bg-purple-400/5 rounded-xl border border-purple-400/10 hover:border-purple-400/30 transition-colors group cursor-pointer relative overflow-hidden"
                        whileHover={{ x: 8, backgroundColor: 'rgba(168,85,247,0.1)' }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.3 }}
                      >
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500/40 to-cyan-500/40 group-hover:from-purple-500/60 group-hover:to-cyan-500/60 transition-colors" />
                          <div className="space-y-2 flex-1">
                            <div className="h-2 w-24 bg-purple-400/30 rounded-full" />
                            <div className="h-1.5 w-16 bg-purple-400/20 rounded-full" />
                          </div>
                        </div>
                        {/* Hover Glow */}
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-cyan-500/0 rounded-xl"
                          whileHover={{ background: 'linear-gradient(90deg, rgba(168,85,247,0.1) 0%, rgba(34,211,238,0.1) 100%)' }}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Corner Accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Pricing (Geo-detected) ── */}
      <section id="pricing" className="relative py-32 overflow-hidden z-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.02)_1px,transparent_1px)] bg-[length:50px_50px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Section Header */}
          <div className="text-center mb-20">
            <motion.h2 
              className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              Pricing for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">every scale</span>
            </motion.h2>
            <motion.p 
              className="text-lg text-purple-200/70 max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
            >
              {t('pricing.subtitle')}
            </motion.p>
            
            {/* Region Selector */}
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-400/30 text-purple-300 px-4 py-2 rounded-full text-sm font-semibold">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity }}>
                  <Globe className="w-4 h-4" />
                </motion.span>
                {t('pricing.region')}: {detectedRegionName}
              </div>
              <select
                value={detectedCountry}
                onChange={(e) => setCountryPreference(e.target.value)}
                className="rounded-full border border-purple-400/30 bg-purple-500/5 px-6 py-2 text-sm font-medium text-purple-300 backdrop-blur-sm hover:border-purple-400/60 transition-colors cursor-pointer"
              >
                {availableCountries.length > 0 ? (
                  availableCountries
                    .sort((a, b) => a.country_name.localeCompare(b.country_name))
                    .map((country) => (
                      <option key={country.country_code} value={country.country_code} className="bg-slate-900">
                        {country.country_name}
                      </option>
                    ))
                ) : (
                  <>
                    <option value="HT" className="bg-slate-900">Haïti</option>
                    <option value="DO" className="bg-slate-900">République Dominicaine</option>
                    <option value="FR" className="bg-slate-900">France</option>
                    <option value="US" className="bg-slate-900">États-Unis</option>
                    <option value="CA" className="bg-slate-900">Canada</option>
                  </>
                )}
              </select>
            </motion.div>
          </div>
          
          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border border-purple-400/20 hover:border-purple-400/40 transition-all hover:shadow-lg hover:shadow-purple-500/10 flex flex-col group"
            >
              <h3 className="text-xl font-bold text-white mb-2">{t('pricing.starter')}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  {starterPrice ? formatPrice(starterPrice.monthly_price, starterPrice.currency_code) : "—"}
                </span>
                <span className="text-purple-300/60 font-medium text-sm">{t('pricing.monthly')}</span>
              </div>
              <ul className="space-y-3 mb-10 flex-1">
                {["1 Business", "Up to 3 staff", "Standard POS", "Email support"].map((f, i) => (
                  <motion.li 
                    key={i} 
                    className="flex items-center gap-3 text-purple-200/80"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Check className="h-5 w-5 text-cyan-400 shrink-0"/> {f}
                  </motion.li>
                ))}
              </ul>
              <Link to="/auth/register"><Button className="w-full rounded-full h-12 font-semibold text-base border border-purple-400/30 text-purple-300 hover:bg-purple-500/10 transition-colors">{t('pricing.getStarted')}</Button></Link>
            </motion.div>

            {/* Pro Plan - Featured */}
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gradient-to-br from-purple-600/20 to-cyan-600/20 border border-purple-400/50 shadow-2xl shadow-purple-500/30 flex flex-col group relative overflow-hidden md:scale-105 z-10"
            >
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(168,85,247,0.1)_1px,transparent_1px),linear-gradient(-45deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[length:30px_30px]" />
              
              {/* Featured Badge */}
              <motion.div 
                className="absolute -top-4 right-6 bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ⭐ {t('pricing.mostPopular')}
              </motion.div>

              <h3 className="text-xl font-bold text-white mb-2 relative z-10">{t('pricing.pro')}</h3>
              <div className="flex items-baseline gap-1 mb-8 relative z-10">
                <span className="text-4xl font-extrabold bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent">
                  {proPrice ? formatPrice(proPrice.monthly_price, proPrice.currency_code) : "—"}
                </span>
                <span className="text-purple-300/60 font-medium text-sm">{t('pricing.monthly')}</span>
              </div>
              <ul className="space-y-3 mb-10 flex-1 relative z-10">
                {["2 Businesses", "Up to 15 staff", "Advanced analytics", "Priority support"].map((f, i) => (
                  <motion.li 
                    key={i} 
                    className="flex items-center gap-3 text-purple-100"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Check className="h-5 w-5 text-cyan-300 shrink-0"/> {f}
                  </motion.li>
                ))}
              </ul>
              <Link to="/auth/register" className="relative z-10"><Button className="w-full rounded-full h-12 font-semibold text-base bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-lg shadow-purple-500/40 transition-all">{t('pricing.getStarted')}</Button></Link>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border border-purple-400/20 hover:border-purple-400/40 transition-all hover:shadow-lg hover:shadow-purple-500/10 flex flex-col group"
            >
              <h3 className="text-xl font-bold text-white mb-2">{t('pricing.enterprise')}</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  {enterprisePrice ? formatPrice(enterprisePrice.monthly_price, enterprisePrice.currency_code) : "—"}
                </span>
                <span className="text-purple-300/60 font-medium text-sm">{t('pricing.monthly')}</span>
              </div>
              <ul className="space-y-3 mb-10 flex-1">
                {["Unlimited Businesses", "Unlimited staff", "Custom API access", "24/7 Phone support"].map((f, i) => (
                  <motion.li 
                    key={i} 
                    className="flex items-center gap-3 text-purple-200/80"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Check className="h-5 w-5 text-cyan-400 shrink-0"/> {f}
                  </motion.li>
                ))}
              </ul>
              <Link to="/auth/register"><Button className="w-full rounded-full h-12 font-semibold text-base border border-purple-400/30 text-purple-300 hover:bg-purple-500/10 transition-colors">{t('pricing.getStarted')}</Button></Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="relative py-32 overflow-hidden z-10">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
              Powerful features, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">zero complexity</span>
            </h2>
            <p className="text-lg text-purple-200/70 max-w-2xl mx-auto">Everything you need to run your business, delivered in one intuitive platform.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-400/20 hover:border-purple-400/40 transition-all hover:shadow-lg hover:shadow-purple-500/10 group cursor-pointer"
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <motion.div 
                    className="inline-flex p-3 rounded-xl bg-gradient-to-br from-purple-600/30 to-cyan-600/30 mb-4"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: idx * 0.2 }}
                  >
                    <Icon className="h-6 w-6 text-cyan-300" />
                  </motion.div>
                  <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-purple-200/70">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="relative py-32 overflow-hidden z-10">
        <motion.div 
          className="absolute inset-0 opacity-50 pointer-events-none"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
          }}
          transition={{ duration: 10, repeat: Infinity }}
        >
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        </motion.div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.h2 
            className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            Ready to transform your business?
          </motion.h2>
          <motion.p 
            className="text-lg text-purple-200/70 mb-10 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
          >
            Join thousands of businesses already using WesdSystems to streamline operations and grow faster.
          </motion.p>
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Link to="/auth/register">
              <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-semibold px-8 h-12 rounded-full shadow-lg shadow-purple-500/40 transition-all group">
                Get Started Free <motion.span className="inline-block group-hover:translate-x-1 transition-transform"><ArrowRight className="h-4 w-4 ml-2" /></motion.span>
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button className="border border-purple-400/30 text-purple-300 font-semibold h-12 px-8 rounded-full hover:bg-purple-500/10 transition-all">
                View Demo
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative py-16 border-t border-purple-500/10 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <Logo />
              <p className="text-sm mt-4 text-purple-200/60">The modern ERP & POS platform for every type of business, anywhere in the world.</p>
            </div>
            <div><h4 className="font-bold text-white mb-4">Product</h4><ul className="space-y-2 text-sm text-purple-200/60 hover:text-purple-200 transition-colors"><li className="cursor-pointer">POS</li><li className="cursor-pointer">Analytics</li><li className="cursor-pointer">Inventory</li></ul></div>
            <div><h4 className="font-bold text-white mb-4">Company</h4><ul className="space-y-2 text-sm text-purple-200/60 hover:text-purple-200 transition-colors"><li className="cursor-pointer">About</li><li className="cursor-pointer">Careers</li><li className="cursor-pointer">Contact</li></ul></div>
            <div><h4 className="font-bold text-white mb-4">Legal</h4><ul className="space-y-2 text-sm text-purple-200/60 hover:text-purple-200 transition-colors"><li className="cursor-pointer">Privacy Policy</li><li className="cursor-pointer">Terms of Service</li></ul></div>
          </div>
          <div className="pt-8 border-t border-purple-500/10 text-center text-sm text-purple-300/40">
            © 2026 Wesd Systems. All rights reserved. | Built with ✨ for the future.
          </div>
        </div>
      </footer>
    </div>
  );
}
