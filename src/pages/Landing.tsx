import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Star, Scissors, Pill, Utensils, ShoppingBag, Building, ChevronRight, Globe, Zap, Shield, BarChart3, Users, Layers } from "lucide-react";

const businesses = [
  { id: "salon", icon: Scissors, name: "Beauty & Barber", color: "bg-blue-50 text-blue-600", desc: "Appointments, staff commissions, client history, smart scheduling." },
  { id: "pharmacy", icon: Pill, name: "Pharmacy", color: "bg-emerald-50 text-emerald-600", desc: "Prescription tracking, expiry alerts, patient files, fast POS." },
  { id: "restaurant", icon: Utensils, name: "Restaurant & Bar", color: "bg-orange-50 text-orange-600", desc: "Table management, kitchen display, order tracking, split billing." },
  { id: "market", icon: ShoppingBag, name: "Grocery & Market", color: "bg-cyan-50 text-cyan-600", desc: "High-volume POS, barcode scanning, supplier orders, inventory." },
  { id: "boutique", icon: Building, name: "Boutique & Retail", color: "bg-purple-50 text-purple-600", desc: "Product variants, loyalty CRM, promotions, custom receipts." },
];

const features = [
  { icon: Zap, title: "Lightning-fast POS", desc: "Process transactions in under 3 seconds on any device — tablet, phone, or desktop." },
  { icon: Users, title: "Team & Role Management", desc: "Granular permissions for owners, managers, cashiers, and staff." },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Live revenue, top products, and employee performance at a glance." },
  { icon: Globe, title: "Multi-currency", desc: "USD, EUR, HTG, CAD, GBP and more — auto-detected from your location." },
  { icon: Shield, title: "Secure & Private", desc: "End-to-end encrypted data with automatic cloud backups every hour." },
  { icon: Layers, title: "Multi-business", desc: "Switch between business types instantly from one unified dashboard." },
];

const plans = [
  { name: "Starter", price: 39, desc: "For solo operators", features: ["1 business type", "Up to 3 staff", "Standard POS", "Email support"], popular: false },
  { name: "Professional", price: 79, desc: "For growing businesses", features: ["2 business types", "Up to 15 staff", "Advanced analytics", "SMS alerts", "Priority support"], popular: true },
  { name: "Enterprise", price: 139, desc: "For multi-location chains", features: ["Unlimited businesses", "Unlimited staff", "Custom reports & API", "Dedicated onboarding", "24/7 VIP support"], popular: false },
];

const testimonials = [
  { name: "Sophie Martin", role: "Owner, Élégance Studio — Paris, France", text: "Wesd Systems replaced 3 separate tools. Our booking revenue is up 28% since we switched.", avatar: "SM" },
  { name: "James Okafor", role: "Manager, FreshMart — Lagos, Nigeria", text: "The POS handles our 400+ daily transactions without a single hiccup. Incredible reliability.", avatar: "JO" },
  { name: "Maria Gonzalez", role: "Director, Salud Pharma — Miami, USA", text: "Expiry tracking alone saved us thousands in wasted inventory in the first quarter.", avatar: "MG" },
];

export default function Landing() {
  const [activeTab, setActiveTab] = useState("salon");
  const active = businesses.find(b => b.id === activeTab) || businesses[0];
  const ActiveIcon = active.icon;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
            <a href="#solutions" className="hover:text-blue-600 transition-colors">Solutions</a>
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth/login"><Button variant="ghost" className="text-gray-700 font-semibold text-sm">Sign in</Button></Link>
            <Link to="/auth/register"><Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 h-9 rounded-lg shadow-sm">Start free trial</Button></Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
              <Globe className="h-3.5 w-3.5" />
              Used by businesses in 40+ countries
            </div>
            <h1 className="display-2xl text-gray-900 mb-6 text-balance">
              The modern business
              <span className="block text-blue-600">management platform</span>
            </h1>
            <p className="text-xl text-gray-500 mb-10 text-balance leading-relaxed max-w-2xl mx-auto">
              One platform to run your salon, pharmacy, restaurant, grocery store, or boutique — with real-time POS, analytics, and team management built in.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth/register">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 h-11 rounded-lg shadow-sm btn-glow w-full sm:w-auto">
                  Start 14-day free trial <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/auth/login">
                <Button variant="outline" className="border-gray-200 text-gray-700 font-semibold h-11 rounded-lg w-full sm:w-auto hover:bg-gray-50">
                  View demo dashboard
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-400 font-medium">No credit card required · Cancel anytime · Setup in 5 minutes</p>
          </div>

          {/* Dashboard preview */}
          <div className="mt-16 relative">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden max-w-4xl mx-auto">
              <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex items-center gap-2">
                <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400"/><span className="w-3 h-3 rounded-full bg-yellow-400"/><span className="w-3 h-3 rounded-full bg-green-400"/></div>
                <div className="flex-1 mx-4 bg-white border border-gray-200 rounded-md px-3 py-1 text-xs text-gray-400 text-center">app.wesdsystems.com</div>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today's Revenue", value: "$3,240", trend: "+18%", color: "text-green-600 bg-green-50" },
                  { label: "Transactions", value: "142", trend: "+9%", color: "text-blue-600 bg-blue-50" },
                  { label: "Active Staff", value: "8", trend: "Online", color: "text-purple-600 bg-purple-50" },
                  { label: "Client Satisfaction", value: "4.9★", trend: "Excellent", color: "text-amber-600 bg-amber-50" },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{s.trend}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6 space-y-2">
                {["Sarah K. — Haircut & Color — $85 — ✓ Completed", "Table 4 — Grilled Salmon + 2 Drinks — $62 — ⏳ In Progress", "Amoxicillin 500mg × 20 — Patient #441 — $18 — ✓ Dispensed"].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-xs text-gray-600 font-medium border border-gray-100">{row}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Solutions Tabs ── */}
      <section id="solutions" className="py-24 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="display-md text-gray-900 mb-4">Built for every type of business</h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">Switch between verticals instantly. One login, every tool you need.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {businesses.map(b => {
              const Icon = b.icon;
              return (
                <button key={b.id} onClick={() => setActiveTab(b.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${activeTab === b.id ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
                  <Icon className="h-4 w-4" />{b.name}
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-card p-8 md:p-10 flex flex-col md:flex-row gap-10 items-center">
              <div className="flex-1 text-left">
                <div className={`inline-flex p-3 rounded-xl mb-4 ${active.color}`}><ActiveIcon className="h-7 w-7" /></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{active.name} Management</h3>
                <p className="text-gray-500 leading-relaxed mb-6">{active.desc}</p>
                <Link to="/auth/register">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg h-10 px-5 text-sm">
                    Try {active.name} module <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100 p-5 w-full">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{active.name} — Live Activity</div>
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 mb-2 last:mb-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"/>
                      <span className="text-sm font-medium text-gray-700">Sample entry {i}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">${(i * 45).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="display-md text-gray-900 mb-4">Everything your business needs</h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">From solo operators to enterprise chains, Wesd Systems scales with you.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="group p-6 rounded-xl border border-gray-100 bg-white hover:border-blue-100 hover:shadow-md transition-all duration-200 text-left">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="display-md text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-500">No setup fees. No hidden charges. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((p, i) => (
              <div key={i} className={`relative p-7 rounded-2xl flex flex-col text-left ${p.popular ? "bg-blue-600 text-white shadow-xl" : "bg-white border border-gray-200"}`}>
                {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>}
                <div className="mb-6">
                  <h3 className={`text-lg font-bold mb-1 ${p.popular ? "text-white" : "text-gray-900"}`}>{p.name}</h3>
                  <p className={`text-xs font-medium mb-4 ${p.popular ? "text-blue-200" : "text-gray-400"}`}>{p.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${p.popular ? "text-white" : "text-gray-900"}`}>${p.price}</span>
                    <span className={`text-sm ${p.popular ? "text-blue-200" : "text-gray-400"}`}>/mo USD</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${p.popular ? "bg-blue-500" : "bg-green-50 border border-green-200"}`}>
                        <Check className={`h-2.5 w-2.5 ${p.popular ? "text-white" : "text-green-600"}`}/>
                      </div>
                      <span className={p.popular ? "text-blue-100" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth/register">
                  <Button className={`w-full font-semibold rounded-lg h-10 text-sm ${p.popular ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                    Get started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="display-md text-gray-900 mb-4">Trusted by businesses worldwide</h2>
            <div className="flex items-center justify-center gap-1 mb-2">{[...Array(5)].map((_,i) => <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400"/>)}</div>
            <p className="text-gray-500 text-sm font-medium">Rated 4.9/5 · 2,000+ businesses · 40+ countries</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 bg-gray-50 rounded-xl border border-gray-100 text-left">
                <div className="flex mb-3">{[...Array(5)].map((_,j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400"/>)}</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{t.avatar}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400 font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-blue-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="display-lg text-white mb-4 text-balance">Ready to grow your business?</h2>
          <p className="text-blue-200 text-lg mb-8">Join 2,000+ businesses managing their operations with Wesd Systems.</p>
          <Link to="/auth/register">
            <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold h-12 px-8 rounded-lg text-base shadow-lg">
              Start free — no card needed <ArrowRight className="h-5 w-5 ml-2"/>
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 text-gray-400 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-10 text-left">
            <div>
              <Logo />
              <p className="text-sm mt-4 leading-relaxed text-gray-500">The modern ERP & POS platform for every type of business, anywhere in the world.</p>
            </div>
            {[
              { title: "Product", links: ["Salon & Barber", "Pharmacy", "Restaurant", "Grocery", "Boutique"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Press"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Security", "Support"] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">{col.title}</h4>
                <ul className="space-y-2.5">{col.links.map((l, j) => <li key={j}><a href="#" className="text-sm hover:text-white transition-colors">{l}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-xs text-gray-600">
            © 2026 Wesd Systems. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
