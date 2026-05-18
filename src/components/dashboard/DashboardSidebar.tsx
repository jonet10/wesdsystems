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
  ShoppingBag,
  FileText,
  Layers,
  ShoppingBag as POSIcon,
  Package,
  BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { glowupStore } from "@/lib/store";

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

interface DashboardSidebarProps {
  role: "super_admin" | "salon_admin" | "employee";
}

const superAdminItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Building2, label: "Établissements", path: "/admin/salons" },
  { icon: CreditCard, label: "Abonnements", path: "/admin/subscriptions" },
  { icon: Settings, label: "Paramètres", path: "/admin/settings" },
];

const employeeItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/employee" },
  { icon: Calendar, label: "Mon Agenda", path: "/employee/schedule" },
];

export const DashboardSidebar = ({ role }: DashboardSidebarProps) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());

  useEffect(() => {
    const handleUpdate = () => {
      setActiveBiz(glowupStore.getActiveBusiness());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  // Compute dynamic items for business admin based on selected business vertical!
  const getBusinessAdminItems = (): SidebarItem[] => {
    switch (activeBiz) {
      case "pharmacie":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/salon" },
          { icon: FileText, label: "Ordonnances", path: "/salon/appointments" },
          { icon: Users, label: "Patients", path: "/salon/clients" },
          { icon: Users, label: "Pharmaciens", path: "/salon/employees" },
          { icon: Pill, label: "Stock Médicaments", path: "/salon/services" },
          { icon: Settings, label: "Configuration", path: "/salon/settings" },
        ];
      case "restaurant":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/salon" },
          { icon: Utensils, label: "POS Commandes", path: "/salon/appointments" },
          { icon: Users, label: "Clients Directory", path: "/salon/clients" },
          { icon: Users, label: "Personnel / Staff", path: "/salon/employees" },
          { icon: Layers, label: "Carte & Cuisine", path: "/salon/services" },
          { icon: Settings, label: "Configuration", path: "/salon/settings" },
        ];
      case "market":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/salon" },
          { icon: POSIcon, label: "Caisse POS", path: "/salon/appointments" },
          { icon: Users, label: "Membres Club", path: "/salon/clients" },
          { icon: Users, label: "Caissiers", path: "/salon/employees" },
          { icon: Layers, label: "Inventaire Stock", path: "/salon/services" },
          { icon: Settings, label: "Configuration", path: "/salon/settings" },
        ];
      case "boutique":
        return [
          { icon: LayoutDashboard, label: "Tableau de Bord", path: "/salon" },
          { icon: POSIcon, label: "Ventes POS", path: "/salon/appointments" },
          { icon: Users, label: "Clients / CRM", path: "/salon/clients" },
          { icon: Users, label: "Vendeurs", path: "/salon/employees" },
          { icon: Layers, label: "Catalogue Articles", path: "/salon/services" },
          { icon: Settings, label: "Configuration", path: "/salon/settings" },
        ];
      case "salon":
      default:
        return [
          { icon: LayoutDashboard, label: "Dashboard Salon", path: "/salon" },
          { icon: Calendar, label: "Rendez-vous", path: "/salon/appointments" },
          { icon: Users, label: "Clients", path: "/salon/clients" },
          { icon: Users, label: "Employés", path: "/salon/employees" },
          { icon: Scissors, label: "Prestations", path: "/salon/services" },
          { icon: Package, label: "Inventaire", path: "/salon/inventory" },
          { icon: POSIcon, label: "POS / Caisse", path: "/salon/pos" },
          { icon: BarChart3, label: "Analytics Ventes", path: "/salon/sales-analytics" },
          { icon: Settings, label: "Paramètres", path: "/salon/settings" },
        ];
    }
  };

  const items = role === "super_admin" 
    ? superAdminItems 
    : role === "salon_admin" 
    ? getBusinessAdminItems() 
    : employeeItems;

  return (
    <aside className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <Logo size="sm" showText={!collapsed} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.label + item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="font-semibold text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Link
          to="/auth/login"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="font-semibold text-sm">Déconnexion</span>}
        </Link>
      </div>
    </aside>
  );
};
