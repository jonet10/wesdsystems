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
  ShoppingCart,
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
  UserPlus,
  DollarSign,
  BookOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  label?: string;
  labelKey?: string;
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
  { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/admin", role: "all" },
  { icon: Building2, labelKey: "sidebar.branches", path: "/admin/salons", role: "all" },
  { icon: CreditCard, labelKey: "sidebar.subscriptions", path: "/admin/subscriptions", role: "all" },
  { icon: Workflow, labelKey: "sidebar.modules", path: "/admin/modules", role: "all" },
  { icon: Handshake, labelKey: "sidebar.partners", path: "/admin/partners", role: "all" },
  { icon: Bell, labelKey: "sidebar.partnerApps", path: "/admin/partners/applications", role: "all" },
  { icon: Smartphone, labelKey: "sidebar.manualPayments", path: "/admin/manual-payments", role: "all" },
  { icon: Settings, labelKey: "sidebar.settings", path: "/admin/settings", role: "all" },
];

const employeeItems: SidebarItem[] = [
  { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/employee", role: "all" },
  { icon: Calendar, labelKey: "sidebar.schedule", path: "/employee/schedule", role: "all" },
];

const partnerItems: SidebarItem[] = [
  { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/partner", role: "all" },
  { icon: Users, labelKey: "sidebar.clients", path: "/partner/clients", role: "all" },
  { icon: CreditCard, labelKey: "sidebar.subscriptions", path: "/partner/subscriptions", role: "all" },
  { icon: BadgeDollarSign, labelKey: "sidebar.commissions", path: "/partner/commissions", role: "all" },
  { icon: Wallet, labelKey: "sidebar.payouts", path: "/partner/payouts", role: "all" },
  { icon: QrCode, labelKey: "sidebar.referrals", path: "/partner/referrals", role: "all" },
  { icon: Megaphone, labelKey: "sidebar.marketing", path: "/partner/marketing", role: "all" },
  { icon: TrendingUp, labelKey: "sidebar.reports", path: "/partner/reports", role: "all" },
];

export const DashboardSidebar = ({ role, mobileOpen, onMobileToggle }: DashboardSidebarProps) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(isMobile);
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const { user, profile, isAuthenticated, employeeSession, autoPartsStaffSession } = useAuth();


  useEffect(() => {
    const handleUpdate = () => setActiveBiz(glowupStore.getActiveBusiness());
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const getBusinessAdminItems = (): SidebarItem[] => {
    switch (activeBiz) {
      case "pharmacie":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/pharmacie", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Receipt, labelKey: "sidebar.pos", path: "/pharmacie/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Pill, labelKey: "sidebar.products", path: "/pharmacie/products", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Layers, labelKey: "sidebar.categories", path: "/pharmacie/categories", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Container, labelKey: "sidebar.batches", path: "/pharmacie/batches", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Truck, labelKey: "sidebar.suppliers", path: "/pharmacie/suppliers", permission: PERMISSIONS.STOCK_VIEW },
          { icon: ShoppingCart, labelKey: "sidebar.purchases", path: "/pharmacie/purchases", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Warehouse, labelKey: "sidebar.stock", path: "/pharmacie/stock", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Users, labelKey: "sidebar.patients", path: "/pharmacie/patients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: FileText, labelKey: "sidebar.prescriptions", path: "/pharmacie/prescriptions", permission: PERMISSIONS.APPOINTMENTS_VIEW },
          { icon: CreditCard, labelKey: "sidebar.credits", path: "/pharmacie/credits", permission: PERMISSIONS.FINANCE_VIEW },
          { icon: Wallet, labelKey: "sidebar.registers", path: "/pharmacie/registers", permission: PERMISSIONS.FINANCE_VIEW },
          { icon: TrendingUp, labelKey: "sidebar.reports", path: "/pharmacie/reports", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Settings, labelKey: "sidebar.settings", path: "/pharmacie/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "restaurant":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/bar", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Utensils, labelKey: "sidebar.pos", path: "/bar/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Users, labelKey: "sidebar.clients", path: "/salon/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, labelKey: "sidebar.staff", path: "/salon/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, labelKey: "sidebar.menu", path: "/salon/services", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Settings, labelKey: "sidebar.settings", path: "/salon/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "bar":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/bar", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Beer, labelKey: "sidebar.barPos", path: "/bar/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Package, labelKey: "sidebar.doubleInventory", path: "/bar/inventory", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Utensils, labelKey: "sidebar.cocktails", path: "/bar/cocktails", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Users, labelKey: "sidebar.clients", path: "/salon/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, labelKey: "sidebar.staff", path: "/salon/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Settings, labelKey: "sidebar.settings", path: "/salon/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "salon":
      default:
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/salon", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Calendar, labelKey: "sidebar.appointments", path: "/salon/appointments", permission: PERMISSIONS.APPOINTMENTS_VIEW },
          { icon: Scissors, labelKey: "sidebar.services", path: "/salon/services", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Users, labelKey: "sidebar.clients", path: "/salon/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, labelKey: "sidebar.employees", path: "/salon/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Package, labelKey: "sidebar.inventory", path: "/salon/inventory", permission: PERMISSIONS.STOCK_MANAGE },
          { icon: ShoppingBag, labelKey: "sidebar.products", path: "/salon/products", permission: PERMISSIONS.PRODUCTS_MANAGE },
          { icon: ShoppingBag, labelKey: "sidebar.pos", path: "/salon/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Gift, labelKey: "sidebar.promotions", path: "/salon/promotions", permission: PERMISSIONS.PROMOTIONS_MANAGE },
          { icon: Receipt, labelKey: "sidebar.expenses", path: "/salon/expenses", permission: PERMISSIONS.EXPENSES_MANAGE },
          { icon: TrendingUp, labelKey: "sidebar.reports", path: "/salon/reports", permission: PERMISSIONS.REPORTS_VIEW },
          { icon: BarChart3, labelKey: "sidebar.analytics", path: "/salon/sales-analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
          { icon: Building2, labelKey: "sidebar.branches", path: "/salon/branches", permission: PERMISSIONS.SETTINGS_MANAGE },
          { icon: Settings, labelKey: "sidebar.settings", path: "/salon/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "market":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/market", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: ShoppingBag, labelKey: "sidebar.pos", path: "/market/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Users, labelKey: "sidebar.clients", path: "/market/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, labelKey: "sidebar.staff", path: "/market/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, labelKey: "sidebar.inventory", path: "/market/inventory", permission: PERMISSIONS.STOCK_VIEW },
          { icon: BarChart3, labelKey: "sidebar.analytics", path: "/market/sales-analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
          { icon: Settings, labelKey: "sidebar.settings", path: "/market/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "boutique":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/boutique", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: ShoppingBag, labelKey: "sidebar.pos", path: "/boutique/pos", permission: PERMISSIONS.POS_VIEW },
          { icon: Users, labelKey: "sidebar.clients", path: "/boutique/clients", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Users, labelKey: "sidebar.staff", path: "/boutique/employees", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, labelKey: "sidebar.inventory", path: "/boutique/inventory", permission: PERMISSIONS.STOCK_VIEW },
          { icon: BarChart3, labelKey: "sidebar.analytics", path: "/boutique/sales-analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
          { icon: Settings, labelKey: "sidebar.settings", path: "/boutique/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "auto_parts":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/auto-parts", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Package, labelKey: "sidebar.products", path: "/auto-parts/products", role: "all", permission: PERMISSIONS.PRODUCTS_READ },
          { icon: Layers, labelKey: "sidebar.categories", path: "/auto-parts/categories", role: "all", permission: PERMISSIONS.CATEGORIES_MANAGE },
          { icon: Truck, labelKey: "sidebar.brands", path: "/auto-parts/brands", role: "all", permission: PERMISSIONS.BRANDS_MANAGE },
          { icon: Wrench, labelKey: "sidebar.models", path: "/auto-parts/models", role: "all", permission: PERMISSIONS.MODELS_MANAGE },
          { icon: Users, labelKey: "sidebar.clients", path: "/auto-parts/clients", role: "all", permission: PERMISSIONS.CLIENTS_READ },
          { icon: Truck, labelKey: "sidebar.suppliers", path: "/auto-parts/suppliers", role: "all", permission: PERMISSIONS.SUPPLIERS_MANAGE },
          { icon: ShoppingBag, labelKey: "sidebar.pos", path: "/auto-parts/pos", role: "all", permission: PERMISSIONS.POS_VIEW },
          { icon: FileText, labelKey: "sidebar.invoices", path: "/auto-parts/invoices", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: FileText, labelKey: "sidebar.quotes", path: "/auto-parts/quotes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: FileText, labelKey: "sidebar.deliveryNotes", path: "/auto-parts/delivery-notes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Package, labelKey: "sidebar.purchases", path: "/auto-parts/purchases", role: "all", permission: PERMISSIONS.PURCHASES_MANAGE },
          { icon: ArrowLeftRight, labelKey: "sidebar.returns", path: "/auto-parts/returns", role: "all", permission: PERMISSIONS.RETURNS_MANAGE },
          { icon: UserCog, labelKey: "sidebar.employees", path: "/auto-parts/staff", role: "salon_admin", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: Layers, labelKey: "sidebar.stock", path: "/auto-parts/stock-movements", role: "all", permission: PERMISSIONS.STOCK_VIEW },
          { icon: Workflow, labelKey: "sidebar.compatibilities", path: "/auto-parts/compatibilities", role: "all", permission: PERMISSIONS.COMPATIBILITIES_MANAGE },
          { icon: TrendingUp, labelKey: "sidebar.reports", path: "/auto-parts/reports", role: "salon_admin", permission: PERMISSIONS.REPORTS_VIEW },
          { icon: Building2, labelKey: "sidebar.branches", path: "/auto-parts/branches", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
          { icon: Settings, labelKey: "sidebar.settings", path: "/auto-parts/settings", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
      case "school":
      case "school_payments":
        return [
          { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/school", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: Users, labelKey: "sidebar.students", path: "/school/students", role: "all", permission: PERMISSIONS.CLIENTS_READ },
          { icon: UserPlus, labelKey: "sidebar.enrollments", path: "/school/enrollments", role: "all", permission: PERMISSIONS.CLIENTS_MANAGE },
          { icon: Layers, labelKey: "sidebar.classes", path: "/school/classes", role: "all", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: Calendar, labelKey: "sidebar.academicYears", path: "/school/academic-years", role: "all", permission: PERMISSIONS.SETTINGS_MANAGE },
          { icon: UserIcon, labelKey: "sidebar.parents", path: "/school/parents", role: "all", permission: PERMISSIONS.CLIENTS_READ },
          { icon: UserCog, labelKey: "sidebar.teachers", path: "/school/teachers", role: "all", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: BadgeDollarSign, labelKey: "sidebar.fees", path: "/school/fees", role: "all", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: DollarSign, labelKey: "sidebar.studentFinance", path: "/school/finance/student", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: FileText, labelKey: "sidebar.invoices", path: "/school/invoices", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
          { icon: ShoppingBag, labelKey: "sidebar.pos", path: "/school/payments", role: "all", permission: PERMISSIONS.POS_VIEW },
          { icon: Receipt, labelKey: "sidebar.expenses", path: "/school/expenses", role: "all", permission: PERMISSIONS.EXPENSES_MANAGE },
          { icon: Package, labelKey: "sidebar.supplies", path: "/school/inventory", role: "all", permission: PERMISSIONS.SERVICES_MANAGE },
          { icon: ShoppingCart, labelKey: "sidebar.suppliesPos", path: "/school/pos", role: "all", permission: PERMISSIONS.POS_VIEW },
          { icon: UserCog, labelKey: "sidebar.users", path: "/school/staff", role: "salon_admin", permission: PERMISSIONS.STAFF_MANAGE },
          { icon: TrendingUp, labelKey: "sidebar.reports", path: "/school/reports", role: "salon_admin", permission: PERMISSIONS.REPORTS_VIEW },
          { icon: Settings, labelKey: "sidebar.settings", path: "/school/settings", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
        ];
    }
  };

  const employeeRole = normalizeEmployeeRole(employeeSession?.role);

  const employeeSpecificItems: SidebarItem[] = employeeRole === "cashier"
    ? [
        { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/employee", role: "all" },
        { icon: CreditCard, labelKey: "sidebar.pos", path: "/employee/pos", role: "all" },
        { icon: ClipboardList, labelKey: "sidebar.reports", path: "/employee", role: "all" },
        { icon: Calendar, labelKey: "sidebar.schedule", path: "/employee/schedule", role: "all" },
      ]
    : employeeRole === "barber"
    ? [
        { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/employee", role: "all" },
        { icon: Calendar, labelKey: "sidebar.schedule", path: "/employee/schedule", role: "all" },
        { icon: Wallet, label: "Mes gains", path: "/employee", role: "all" },
      ]
    : employeeItems;

  const rawItems = role === "super_admin"
    ? superAdminItems
    : role === "partner"
    ? partnerItems
    : (role === "salon_admin" || role === "school_admin" || role === "pharmacy_admin" || role === "market_admin" || role === "admin")
    ? getBusinessAdminItems()
    : employeeSpecificItems.filter(i => !i.role || i.role === "all" || i.role === "employee");

  // Staff/employee session takes precedence over Supabase profile for menu filtering
  const autoPartsAdminItems: SidebarItem[] = [
    { icon: LayoutDashboard, labelKey: "sidebar.dashboard", path: "/auto-parts", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: Package, labelKey: "sidebar.products", path: "/auto-parts/products", role: "all", permission: PERMISSIONS.PRODUCTS_READ },
    { icon: Layers, labelKey: "sidebar.categories", path: "/auto-parts/categories", role: "all", permission: PERMISSIONS.CATEGORIES_MANAGE },
    { icon: Truck, labelKey: "sidebar.brands", path: "/auto-parts/brands", role: "all", permission: PERMISSIONS.BRANDS_MANAGE },
    { icon: Wrench, labelKey: "sidebar.models", path: "/auto-parts/models", role: "all", permission: PERMISSIONS.MODELS_MANAGE },
    { icon: Users, labelKey: "sidebar.clients", path: "/auto-parts/clients", role: "all", permission: PERMISSIONS.CLIENTS_READ },
    { icon: Truck, labelKey: "sidebar.suppliers", path: "/auto-parts/suppliers", role: "all", permission: PERMISSIONS.SUPPLIERS_MANAGE },
    { icon: ShoppingBag, labelKey: "sidebar.pos", path: "/auto-parts/pos", role: "all", permission: PERMISSIONS.POS_VIEW },
    { icon: FileText, labelKey: "sidebar.invoices", path: "/auto-parts/invoices", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: FileText, labelKey: "sidebar.quotes", path: "/auto-parts/quotes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: FileText, labelKey: "sidebar.deliveryNotes", path: "/auto-parts/delivery-notes", role: "all", permission: PERMISSIONS.DASHBOARD_VIEW },
    { icon: Package, labelKey: "sidebar.purchases", path: "/auto-parts/purchases", role: "all", permission: PERMISSIONS.PURCHASES_MANAGE },
    { icon: ArrowLeftRight, labelKey: "sidebar.returns", path: "/auto-parts/returns", role: "all", permission: PERMISSIONS.RETURNS_MANAGE },
    { icon: UserCog, labelKey: "sidebar.employees", path: "/auto-parts/staff", role: "salon_admin", permission: PERMISSIONS.STAFF_MANAGE },
    { icon: Layers, labelKey: "sidebar.stock", path: "/auto-parts/stock-movements", role: "all", permission: PERMISSIONS.STOCK_VIEW },
    { icon: Workflow, labelKey: "sidebar.compatibilities", path: "/auto-parts/compatibilities", role: "all", permission: PERMISSIONS.COMPATIBILITIES_MANAGE },
    { icon: TrendingUp, labelKey: "sidebar.reports", path: "/auto-parts/reports", role: "salon_admin", permission: PERMISSIONS.REPORTS_VIEW },
    { icon: Building2, labelKey: "sidebar.branches", path: "/auto-parts/branches", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
    { icon: Settings, labelKey: "sidebar.settings", path: "/auto-parts/settings", role: "salon_admin", permission: PERMISSIONS.SETTINGS_MANAGE },
  ];
  const items = (() => {
    // School custom permissions filter
    if (profile && (activeBiz === "school" || activeBiz === "school_payments")) {
      const isSchoolAdmin = profile.role === "school_admin" || profile.role === "super_admin" || profile.role === "salon_admin";
      const customPerms = profile.permissions || [];
      const schoolItems = getBusinessAdminItems();
      
      return schoolItems.filter(item => {
        if (isSchoolAdmin) return true;
        
        const permissionMapping: Record<string, string> = {
          "/school/students": "school:students",
          "/school/enrollments": "school:enrollments",
          "/school/classes": "school:classes",
          "/school/academic-years": "school:academic-years",
          "/school/parents": "school:parents",
          "/school/teachers": "school:teachers",
          "/school/fees": "school:fees",
          "/school/finance/student": "school:finance",
          "/school/invoices": "school:invoices",
          "/school/payments": "school:payments",
          "/school/expenses": "school:expenses",
          "/school/inventory": "school:inventory",
          "/school/pos": "school:pos",
          "/school/staff": "school:staff",
          "/school/reports": "school:reports",
          "/school/settings": "school:settings",
        };
        
        const required = permissionMapping[item.path];
        if (!required) return true;
        return customPerms.includes(required);
      });
    }

    // Staff session without Supabase Auth → show filtered menu for cashier
    if (autoPartsStaffSession && !profile && !isAuthenticated) {
      const filtered = filterMenuByPermissions(autoPartsAdminItems, autoPartsStaffSession.permissions);
      console.log("[Sidebar] autoPartsStaffSession permissions:", autoPartsStaffSession.permissions, "filtered items:", filtered.map(i => i.label));
      return filtered;
    }
    // Employee session without Supabase Auth → show filtered menu
    if (employeeSession && !profile && !isAuthenticated) {
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
            ? "bg-gradient-to-r from-primary/15 to-info/10 dark:from-violet-500/20 dark:to-cyan-400/10 text-primary dark:text-cyan-400 font-medium border-primary/20 dark:border-cyan-400/20 shadow-glow dark:shadow-[0_0_15px_rgba(34,211,238,0.15)]" 
            : "text-muted-foreground border-transparent hover:bg-primary/5 dark:hover:bg-white/5 hover:text-foreground dark:hover:text-white hover:border-primary/10 dark:hover:border-white/10"
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
              {item.labelKey ? t(item.labelKey as any) : item.label}
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
          <TooltipContent side="right">{item.labelKey ? t(item.labelKey as any) : item.label}</TooltipContent>
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
          "h-screen flex-shrink-0 bg-background/80 dark:bg-[#0A0A0F]/95 backdrop-blur-2xl border-r border-purple-500/10 dark:border-white/5 " +
          "flex flex-col transition-all duration-300 ease-in-out shadow-2xl shadow-purple-950/20 dark:shadow-black/50 " +
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
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {activeBiz === "school" || activeBiz === "school_payments" ? (
            // ── SCHOOL: grouped sections
            <div className="space-y-1">
              {/* Dashboard (standalone) */}
              {items.filter(i => i.path === "/school").map(item => (
                <NavItem key={item.path} item={item} />
              ))}

              {/* ACADÉMIQUE */}
              {!collapsed && (
                <div className="mt-4 mb-1 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Académique</span>
                </div>
              )}
              {collapsed && <div className="mt-3 mb-1 border-t border-border/40" />}
              {items.filter(i => ["/school/students", "/school/enrollments", "/school/classes", "/school/academic-years", "/school/parents", "/school/teachers"].includes(i.path)).map(item => (
                <NavItem key={item.path} item={item} />
              ))}

              {/* FINANCE */}
              {!collapsed && (
                <div className="mt-4 mb-1 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Finance</span>
                </div>
              )}
              {collapsed && <div className="mt-3 mb-1 border-t border-border/40" />}
              {items.filter(i => ["/school/fees", "/school/finance/student", "/school/invoices", "/school/payments", "/school/expenses"].includes(i.path)).map(item => (
                <NavItem key={item.path} item={item} />
              ))}

              {/* FOURNITURES */}
              {!collapsed && (
                <div className="mt-4 mb-1 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Fournitures</span>
                </div>
              )}
              {collapsed && <div className="mt-3 mb-1 border-t border-border/40" />}
              {items.filter(i => ["/school/inventory", "/school/pos"].includes(i.path)).map(item => (
                <NavItem key={item.path} item={item} />
              ))}

              {/* SYSTÈME */}
              {!collapsed && (
                <div className="mt-4 mb-1 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Système</span>
                </div>
              )}
              {collapsed && <div className="mt-3 mb-1 border-t border-border/40" />}
              {items.filter(i => ["/school/staff", "/school/reports", "/school/settings"].includes(i.path)).map(item => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          ) : (
            // ── ALL OTHER MODULES: flat list
            <div className="space-y-1">
              {items.map((item) => (
                <NavItem key={`${item.path}-${item.label}`} item={item} />
              ))}
            </div>
          )}
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
