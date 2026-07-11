import { ReactNode, useState, useMemo } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { useEnsureDefaultBranch } from "@/hooks/useEnsureDefaultBranch";
import { useSubscriptionPaymentReminder } from "@/hooks/useSubscriptionPaymentReminder";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, CreditCard, Lock, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface DashboardLayoutProps {
  children: ReactNode;
  role?: "super_admin" | "salon_admin" | "bar_admin" | "employee" | "partner" | string;
  title: string;
  subtitle?: string;
  userName?: string;
}

export const DashboardLayout = ({ children, role: explicitRole, title, subtitle, userName: explicitUserName }: DashboardLayoutProps) => {
  useEnsureDefaultBranch();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { profile, employeeSession, autoPartsStaffSession, isAuthenticated } = useAuth();
  
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const subscriptionReminder = useSubscriptionPaymentReminder();

  const { effectiveRole, effectiveUserName } = useMemo(() => {
    const isEmployeeContext = location.pathname.startsWith("/employee") || 
                             (employeeSession && !isAuthenticated);
                             
    if (isEmployeeContext && employeeSession) {
      return {
        effectiveRole: "employee",
        effectiveUserName: employeeSession.full_name
      };
    }
    
    if (autoPartsStaffSession && !isAuthenticated) {
      return {
        effectiveRole: "employee",
        effectiveUserName: autoPartsStaffSession.name
      };
    }

    return {
      effectiveRole: explicitRole || profile?.role || "employee",
      effectiveUserName: explicitUserName || profile?.full_name || "Utilisateur"
    };
  }, [explicitRole, explicitUserName, profile, employeeSession, autoPartsStaffSession, isAuthenticated, location.pathname]);

  const isBusinessArea = effectiveRole === "salon_admin" || effectiveRole === "bar_admin";
  const isSubscriptionLocked = isBusinessArea && subscriptionReminder.isCritical;

  return (
    <div className="flex h-screen relative overflow-hidden bg-transparent">
      {/* FOREGROUND CONTENT */}
      <div className="relative z-10 flex w-full h-full">
        <DashboardSidebar
          role={effectiveRole as any}
          mobileOpen={mobileSidebarOpen}
          onMobileToggle={() => setMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader
            title={title}
            subtitle={subtitle}
            userName={effectiveUserName}
            userRole={effectiveRole}
            onMenuToggle={isMobile ? () => setMobileSidebarOpen(true) : undefined}
          />
          <main className="relative flex-1 overflow-auto p-4 md:p-6">
            {subscriptionReminder.shouldPrompt && isBusinessArea && (
              <div
                className={cn(
                  "mb-6 rounded-2xl border p-4 shadow-sm print:hidden",
                  subscriptionReminder.severity === "critical"
                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-100"
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl",
                        subscriptionReminder.severity === "critical" ? "bg-destructive/15" : "bg-amber-500/20"
                      )}
                    >
                      {subscriptionReminder.isCritical ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{subscriptionReminder.title}</p>
                      <p className="text-sm opacity-90">{subscriptionReminder.description}</p>
                      <p className="mt-1 text-xs opacity-80">
                        {subscriptionReminder.planName ? `${subscriptionReminder.planName} • ` : ""}
                        {subscriptionReminder.businessName}
                      </p>
                    </div>
                  </div>
                  <Button asChild disabled={!subscriptionReminder.paymentUrl} variant={subscriptionReminder.isCritical ? "destructive" : "secondary"}>
                    <Link to={subscriptionReminder.paymentUrl || "#"}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {subscriptionReminder.ctaLabel}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            <div className={cn(isSubscriptionLocked && "pointer-events-none select-none opacity-50")}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
