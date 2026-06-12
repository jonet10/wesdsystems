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
  UserCog,
  ArrowLeftRight,
  Smartphone,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { glowupStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeEmployeeRole } from "@/lib/employee-role";
import { PERMISSIONS, filterMenuByPermissions, getSalonEmployeePermissions, type Permission } from "@/config/permissions";

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
  role?: "all" | "salon_admin" | "employee" | "partner";
  permission?: Permission;
}

interface DashboardSidebarProps {
  role: "super_admin" | "salon_admin" | "employee" | "partner";
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
}

const superAdminItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin", role: "all" },
  { icon: Building2, label: "Établissements", path: "/admin/salons", role: "all" },
  { icon: CreditCard, label: "Abonnements", path: "/admin/subscriptions", role: "all" },
  { icon: Workflow, label: "Modules", path: "/admin/modules", role: "all" },
  { icon: Handshake, label: "Partenaires", path: "/admin/partners", role: "all" },
  { icon: Bell, label: "Demandes partenaires", path: "/admin/partners/applications", role: "all" },
  { icon: Smartphone, label: "Paiements manuels", path: "/admin/manual-payments", role: "all" },
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

export const DashboardSidebar = ({ role, mobileOpen, onMobileToggle }: DashboardSidebarProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(isMobile);
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const { user, profile, isAuthenticated, employeeSession, autoPartsStaffSession } = useAuth();

  useEffect(() => {
    const biz = glowupStore.getActiveBusiness();
    if (profile?.business_type && profile.business_type !== biz) {
      glowupStore.setActiveBusiness(profile.business_type as any);
    }
  }, [profile?.business_type]);

  useEffect(() => {
    const handleUpdate = () => setActiveBiz(glowupStore.getActiveBusiness());
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const getBusinessAdminItems = (): SidebarItem[] => {
    switch (activeBiz) {
      case "pharmacie":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/pharmacie", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: FileText, label: "Ordonnances", path: "/pharmacie/appointments", permission: PERMISSIONS.APPOINTMENTS_VIEW },
          { icon: Users, label: "Patients", path: "/pharmacie/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, label: "Pharmaciens", path: "/pharmacie/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Pill, label: "Stock Médicaments", path: "/pharmacie/services", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Settings, label: "Configuration", path: "/pharmacie/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "restaurant":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/bar", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Utensils, label: "POS Commandes", path: "/bar/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Users, label: "Clients", path: "/salon/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, label: "Personnel", path: "/salon/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, label: "Carte & Cuisine", path: "/salon/services", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Settings, label: "Configuration", path: "/salon/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "bar":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/bar", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Beer, label: "POS Bar", path: "/bar/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Package, label: "Double Inventaire", path: "/bar/inventory", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Utensils, label: "Recettes Cocktails", path: "/bar/cocktails", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Users, label: "Clients", path: "/salon/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, label: "Personnel", path: "/salon/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Settings, label: "Configuration", path: "/salon/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "salon":
      default:
        return [
          { icon: LayoutDashboard, label: "Dashboard", path: "/salon", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Calendar, label: "Rendez-vous", path: "/salon/appointments", permission: PERMISSIONS.APPOINTMENTS_VIEW },
          { icon: Scissors, label: "Services", path: "/salon/services", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Users, label: "Clients", path: "/salon/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, label: "Employés", path: "/salon/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Package, label: "Inventaire", path: "/salon/inventory", permission: PERMISSIONS.STOCK_MANAGE },
          { icon: ShoppingBag, label: "Produits", path: "/salon/products", permission: PERMISSIONS.PRODUCTS_MANAGE },
          { icon: ShoppingBag, label: "POS / Caisse", path: "/salon/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Gift, label: "Promotions", path: "/salon/promotions", permission: PERMISSIONS.PROMOTIONS_MANAGE },
          { icon: Receipt, label: "Dépenses", path: "/salon/expenses", permission: PERMISSIONS.EXPENSES_MANAGE },
          { icon: TrendingUp, label: "Rapports", path: "/salon/reports", permission: PERMISSIONS.REPORTS_VIEW },
          { icon: BarChart3, label: "Analytics", path: "/salon/sales-analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
          { icon: Settings, label: "Paramètres", path: "/salon/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "market":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/market", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: ShoppingBag, label: "Caisse POS", path: "/market/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Users, label: "Clients", path: "/market/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, label: "Équipe", path: "/market/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, label: "Inventaire", path: "/market/inventory", permission: PERMISSIONS.STOCK_VIEW },
          { icon: BarChart3, label: "Analytics", path: "/market/sales-analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
          { icon: Settings, label: "Configuration", path: "/market/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "boutique":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/boutique", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: ShoppingBag, label: "Caisse POS", path: "/boutique/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Users, label: "Clients", path: "/boutique/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, label: "Équipe", path: "/boutique/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, label: "Inventaire", path: "/boutique/inventory", permission: PERMISSIONS.STOCK_VIEW },
          { icon: BarChart3, label: "Analytics", path: "/boutique/sales-analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
          { icon: Settings, label: "Configuration", path: "/boutique/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "auto_parts":
        return [
          { icon: LayoutDashboard, label: "Dashboard", path: "/auto-parts", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Package, label: "Produits", path: "/auto-parts/products", role: "all", permission: PERMISSIONS.PRODUCTS_READ },
          { icon: Layers, label: "Catégories", path: "/auto-parts/categories", role: "all", permission: PERMISSIONS.CATEGORIES_MANAGE },
          { icon: Truck, label: "Marques", path: "/auto-parts/brands", role: "all", permission: PERMISSIONS.BRANDS_MANAGE },
          { icon: Wrench, label: "Modèles", path: "/auto-parts/models", role: "all", permission: PERMISSIONS.MODELS_MANAGE },
          { icon: Users, label: "Clients", path: "/auto-parts/clients", role: "all", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Truck, label: "Fournisseurs", path: "/auto-parts/suppliers", role: "all", permission: PERMISSIONS.SUPPLIERS_MANAGE },
          { icon: ShoppingBag, label: "POS / Caisse", path: "/auto-parts/pos", role: "all", permission: PERMISSIONS.POS_VIEW },
          { icon: FileText, label: "Factures", path: "/auto-parts/invoices", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: FileText, label: "Devis", path: "/auto-parts/quotes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: FileText, label: "B. Livraison", path: "/auto-parts/delivery-notes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Package, label: "Achats", path: "/auto-parts/purchases", role: "all", permission: PERMISSIONS.PURCHASES_MANAGE },
          { icon: ArrowLeftRight, label: "Retours", path: "/auto-parts/returns", role: "all", permission: PERMISSIONS.RETURNS_MANAGE },
          { icon: UserCog, label: "Employés", path: "/auto-parts/staff", role: "salon_admin", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, label: "Stock", path: "/auto-parts/stock-movements", role: "all", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Workflow, label: "Compatibilités", path: "/auto-parts/compatibilities", role: "all", permission: PERMISSIONS.COMPATIBILITIES_MANAGE },
          { icon: TrendingUp, label: "Rapports", path: "/auto-parts/reports", role: "salon_admin", permission: PERMISSIONS.REPORTS_VIEW },
          { icon: Settings, label: "Paramètres", path: "/auto-parts/settings", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
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

  const rawItems = role === "super_admin"
    ? superAdminItems
    : role === "partner"
    ? partnerItems
    : role === "salon_admin"
    ? getBusinessAdminItems()
    : employeeSpecificItems.filter(i => !i.role || i.role === "all" || i.role === "employee");

  // Staff/employee session takes precedence over Supabase profile for menu filtering
  const autoPartsAdminItems: SidebarItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/auto-parts", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: Package, label: "Produits", path: "/auto-parts/products", role: "all", permission: PERMISSIONS.PRODUCTS_READ },
    { icon: Layers, label: "Catégories", path: "/auto-parts/categories", role: "all", permission: PERMISSIONS.CATEGORIES_MANAGE },
    { icon: Truck, label: "Marques", path: "/auto-parts/brands", role: "all", permission: PERMISSIONS.BRANDS_MANAGE },
    { icon: Wrench, label: "Modèles", path: "/auto-parts/models", role: "all", permission: PERMISSIONS.MODELS_MANAGE },
    { icon: Users, label: "Clients", path: "/auto-parts/clients", role: "all", permission: PERMISSIONS.CLIENTS_READ },
    { icon: Truck, label: "Fournisseurs", path: "/auto-parts/suppliers", role: "all", permission: PERMISSIONS.SUPPLIERS_MANAGE },
    { icon: ShoppingBag, label: "POS / Caisse", path: "/auto-parts/pos", role: "all", permission: PERMISSIONS.POS_VIEW },
    { icon: FileText, label: "Factures", path: "/auto-parts/invoices", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: FileText, label: "Devis", path: "/auto-parts/quotes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: FileText, label: "B. Livraison", path: "/auto-parts/delivery-notes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: Package, label: "Achats", path: "/auto-parts/purchases", role: "all", permission: PERMISSIONS.PURCHASES_MANAGE },
    { icon: ArrowLeftRight, label: "Retours", path: "/auto-parts/returns", role: "all", permission: PERMISSIONS.RETURNS_MANAGE },
    { icon: UserCog, label: "Employés", path: "/auto-parts/staff", role: "salon_admin", permission: PERMISSIONS.STAFF_MANAGE },
    { icon: Layers, label: "Stock", path: "/auto-parts/stock-movements", role: "all", permission: PERMISSIONS.STOCK_VIEW },
    { icon: Workflow, label: "Compatibilités", path: "/auto-parts/compatibilities", role: "all", permission: PERMISSIONS.COMPATIBILITIES_MANAGE },
    { icon: TrendingUp, label: "Rapports", path: "/auto-parts/reports", role: "salon_admin", permission: PERMISSIONS.REPORTS_VIEW },
    { icon: Settings, label: "Paramètres", path: "/auto-parts/settings", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
  ];
  const items = (() => {
    // Staff session without Supabase Auth → show filtered menu for cashier
    if (autoPartsStaffSession && !profile && !isAuthenticated) {
      const filtered = filterMenuByPermissions(autoPartsAdminItems, autoPartsStaffSession.permissions);
      console.log("[Sidebar] autoPartsStaffSession permissions:", autoPartsStaffSession.permissions, "filtered items:", filtered.map(i => i.label));
      return filtered;
    }
    // Employee session without Supabase Auth → show filtered menu
    if (employeeSession && !profile && !isAuthenticated && role === "salon_admin") {
      const empRole = normalizeEmployeeRole(employeeSession.role);
      const empPerms = empRole ? getSalonEmployeePermissions(empRole) : null;
      if (empPerms) {
        const filtered = filterMenuByPermissions(getBusinessAdminItems(), empPerms);
        console.log("[Sidebar] employeeSession permissions:", empPerms, "filtered items:", filtered.map(i => i.label));
        return filtered;
      }
    }
    return rawItems;
  })();

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
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={onMobileToggle}
        />
      )}
      <motion.aside
        initial={false}
        animate={
          isMobile
            ? { x: mobileOpen ? 0 : -300, width: 256 }
            : { width: collapsed ? 72 : 256 }
        }
        className={
          "h-screen flex-shrink-0 bg-background/80 backdrop-blur-xl border-r border-purple-500/10 " +
          "flex flex-col transition-all duration-300 ease-in-out shadow-2xl shadow-purple-950/20 " +
          (isMobile
            ? "fixed left-0 top-0 z-40"
            : "relative z-40")
        }
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-purple-500/10">
          {!isMobile && (
            <motion.div
              animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
              className="overflow-hidden whitespace-nowrap"
            >
              <Logo className="h-7" />
            </motion.div>
          )}
          {isMobile ? (
            <div className="flex items-center justify-between w-full">
              <Logo className="h-7" />
              <Button variant="ghost" size="icon" onClick={onMobileToggle} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 ml-auto"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavItem key={`${item.path}-${item.label}`} item={item} />
          ))}
        </nav>

        {/* Footer (desktop only) */}
        {!isMobile && collapsed && (
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
        {!isMobile && !collapsed && (
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
    </>
  );
};
