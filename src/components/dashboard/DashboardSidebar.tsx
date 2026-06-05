import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  Scissors,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Pill,
  Utensils,
  Beer,
  ShoppingBag,
  FileText,
  Layers,
  Package,
  BarChart3,
  Bell,
  User as UserIcon,
  Menu,
  Receipt,
  Gift,
  TrendingUp,
  ClipboardList,
  Handshake,
  BadgeDollarSign,
  QrCode,
  Megaphone,
  Wallet,
  Workflow,
  Truck,
  Wrench,
  Warehouse,
  Tag,
  Container,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { glowupStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeEmployeeRole } from "@/lib/employee-role";

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
  role?: "all" | "salon_admin" | "employee" | "partner";
}

interface DashboardSidebarProps {
  role: "super_admin" | "salon_admin" | "employee" | "partner";
}

const superAdminItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin", role: "all" },
  { icon: Building2, label: "Établissements", path: "/admin/salons", role: "all" },
  { icon: CreditCard, label: "Abonnements", path: "/admin/subscriptions", role: "all" },
  { icon: Workflow, label: "Modules", path: "/admin/modules", role: "all" },
  { icon: Handshake, label: "Partenaires", path: "/admin/partners", role: "all" },
  { icon: Bell, label: "Demandes partenaires", path: "/admin/partners/applications", role: "all" },
  { icon: Settings, label: "Paramètres", path: "/admin/settings", role: "all" },
];

const employeeItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/employee", role: "all" },
  { icon: Calendar, label: "Mon Agenda", path: "/employee/schedule", role: "all" },
];

const partnerItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/partner", role: "all" },
  { icon: Users, label: "Mes clients", path: "/partner/clients", role: "all" },
  { icon: CreditCard, label: "Mes abonnements", path: "/partner/subscriptions", role: "all" },
  { icon: BadgeDollarSign, label: "Commissions", path: "/partner/commissions", role: "all" },
  { icon: Wallet, label: "Payouts", path: "/partner/payouts", role: "all" },
  { icon: QrCode, label: "Liens referral", path: "/partner/referrals", role: "all" },
  { icon: Megaphone, label: "Marketing", path: "/partner/marketing", role: "all" },
  { icon: TrendingUp, label: "Rapports", path: "/partner/reports", role: "all" },
];

export const DashboardSidebar = ({ role }: DashboardSidebarProps) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const { user, employeeSession } = useAuth();

  useEffect(() => {
    const handleUpdate = () => setActiveBiz(glowupStore.getActiveBusiness());
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const getBusinessAdminItems = (): SidebarItem[] => {
    switch (activeBiz) {
      case "pharmacie":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/salon", role: "all" },
          { icon: FileText, label: "Ordonnances", path: "/salon/appointments", role: "all" },
          { icon: Users, label: "Patients", path: "/salon/clients", role: "all" },
          { icon: Users, label: "Pharmaciens", path: "/salon/employees", role: "salon_admin" },
          { icon: Pill, label: "Stock Médicaments", path: "/salon/services", role: "all" },
          { icon: Settings, label: "Configuration", path: "/salon/settings", role: "salon_admin" },
        ];
      case "restaurant":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/bar", role: "all" },
          { icon: Utensils, label: "POS Commandes", path: "/bar/pos", role: "all" },
          { icon: Users, label: "Clients", path: "/salon/clients", role: "all" },
          { icon: Users, label: "Personnel", path: "/salon/employees", role: "salon_admin" },
          { icon: Layers, label: "Carte & Cuisine", path: "/salon/services", role: "all" },
          { icon: Settings, label: "Configuration", path: "/salon/settings", role: "salon_admin" },
        ];
      case "bar":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/bar", role: "all" },
          { icon: Beer, label: "POS Bar", path: "/bar/pos", role: "all" },
          { icon: Package, label: "Double Inventaire", path: "/bar/inventory", role: "all" },
          { icon: Utensils, label: "Recettes Cocktails", path: "/bar/cocktails", role: "all" },
          { icon: Users, label: "Clients", path: "/salon/clients", role: "all" },
          { icon: Users, label: "Personnel", path: "/salon/employees", role: "salon_admin" },
          { icon: Settings, label: "Configuration", path: "/salon/settings", role: "salon_admin" },
        ];
      case "market":
      case "boutique":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/salon", role: "all" },
          { icon: ShoppingBag, label: "Caisse POS", path: "/salon/pos", role: "all" },
          { icon: Users, label: "Clients", path: "/salon/clients", role: "all" },
          { icon: Users, label: "Équipe", path: "/salon/employees", role: "salon_admin" },
          { icon: Layers, label: "Inventaire", path: "/salon/inventory", role: "all" },
          { icon: BarChart3, label: "Analytics", path: "/salon/sales-analytics", role: "salon_admin" },
          { icon: Settings, label: "Configuration", path: "/salon/settings", role: "salon_admin" },
        ];
      case "salon":
      default:
        return [
          { icon: LayoutDashboard, label: "Dashboard", path: "/salon", role: "all" },
          { icon: Calendar, label: "Rendez-vous", path: "/salon/appointments", role: "all" },
          { icon: Scissors, label: "Services", path: "/salon/services", role: "all" },
          { icon: Users, label: "Clients", path: "/salon/clients", role: "all" },
          { icon: Users, label: "Employés", path: "/salon/employees", role: "salon_admin" },
          { icon: Package, label: "Inventaire", path: "/salon/inventory", role: "all" },
          { icon: ShoppingBag, label: "Produits", path: "/salon/products", role: "all" },
          { icon: ShoppingBag, label: "POS / Caisse", path: "/salon/pos", role: "all" },
          { icon: Gift, label: "Promotions", path: "/salon/promotions", role: "salon_admin" },
          { icon: Receipt, label: "Dépenses", path: "/salon/expenses", role: "all" },
          { icon: TrendingUp, label: "Rapports", path: "/salon/reports", role: "salon_admin" },
          { icon: BarChart3, label: "Analytics", path: "/salon/sales-analytics", role: "salon_admin" },
          { icon: Settings, label: "Paramètres", path: "/salon/settings", role: "salon_admin" },
        ];

      case "auto_parts":
        return [
          { icon: LayoutDashboard, label: "Dashboard", path: "/auto-parts", role: "all" },
          { icon: Package, label: "Produits", path: "/auto-parts/products", role: "all" },
          { icon: Layers, label: "Catégories", path: "/auto-parts/categories", role: "all" },
          { icon: Truck, label: "Marques", path: "/auto-parts/brands", role: "all" },
          { icon: Wrench, label: "Modèles", path: "/auto-parts/models", role: "all" },
          { icon: Users, label: "Clients", path: "/auto-parts/clients", role: "all" },
          { icon: Truck, label: "Fournisseurs", path: "/auto-parts/suppliers", role: "all" },
          { icon: ShoppingBag, label: "POS / Caisse", path: "/auto-parts/pos", role: "all" },
          { icon: Package, label: "Achats", path: "/auto-parts/purchases", role: "all" },
          { icon: Layers, label: "Stock", path: "/auto-parts/stock-movements", role: "all" },
          { icon: Workflow, label: "Compatibilités", path: "/auto-parts/compatibilities", role: "all" },
          { icon: TrendingUp, label: "Rapports", path: "/auto-parts/reports", role: "salon_admin" },
          { icon: Settings, label: "Paramètres", path: "/auto-parts/settings", role: "salon_admin" },
        ];
    }
  };

  const employeeRole = normalizeEmployeeRole(employeeSession?.role);

  const employeeSpecificItems: SidebarItem[] = employeeRole === "cashier"
    ? [
        { icon: LayoutDashboard, label: "Dashboard", path: "/employee", role: "all" },
        { icon: CreditCard, label: "Caisse", path: "/employee/pos", role: "all" },
        { icon: ClipboardList, label: "Rapport du jour", path: "/employee", role: "all" },
        { icon: Calendar, label: "Mon Agenda", path: "/employee/schedule", role: "all" },
      ]
    : employeeRole === "barber"
    ? [
        { icon: LayoutDashboard, label: "Dashboard", path: "/employee", role: "all" },
        { icon: Calendar, label: "Mon Agenda", path: "/employee/schedule", role: "all" },
        { icon: Wallet, label: "Mes gains", path: "/employee", role: "all" },
      ]
    : employeeItems;

  const items = role === "super_admin"
    ? superAdminItems
    : role === "partner"
    ? partnerItems
    : role === "salon_admin"
    ? getBusinessAdminItems()
    : employeeSpecificItems.filter(i => !i.role || i.role === "all" || i.role === "employee");

  const NavItem = ({ item }: { item: SidebarItem }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    
    const content = (
        <Link
          to={item.path}
          className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group border",
          isActive 
            ? "bg-gradient-to-r from-primary/15 to-info/10 text-primary font-medium border-primary/20 shadow-glow" 
            : "text-muted-foreground border-transparent hover:bg-primary/5 hover:text-foreground hover:border-primary/10"
        )}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-sm truncate"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      className="h-screen flex-shrink-0 bg-background/80 backdrop-blur-xl border-r border-purple-500/10 
                 flex flex-col z-40 transition-all duration-300 ease-in-out shadow-2xl shadow-purple-950/20"
    >
      {/* Logo Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-purple-500/10">
        <motion.div 
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
          className="overflow-hidden whitespace-nowrap"
        >
          <Logo className="h-7" />
        </motion.div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavItem key={`${item.path}-${item.label}`} item={item} />
        ))}
      </nav>

      {/* User Mini Profile (collapsed mode) */}
      {collapsed && (
        <div className="p-3 border-t border-purple-500/10">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-full">
                <UserIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Profil</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Footer Toggle */}
      {!collapsed && (
        <div className="p-3 border-t border-purple-500/10">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-primary/10"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm">Réduire le menu</span>
          </Button>
        </div>
      )}
    </motion.aside>
  );
};
