import { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { useEnsureDefaultBranch } from "@/hooks/useEnsureDefaultBranch";
import { useSubscriptionPaymentReminder } from "@/hooks/useSubscriptionPaymentReminder";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AlertTriangle, CreditCard, Lock } from "lucide-react";
import { cn } from "@/lib/utils";


interface DashboardLayoutProps {
  children: ReactNode;
  role: "super_admin" | "salon_admin" | "bar_admin" | "employee" | "partner";
  title: string;
  subtitle?: string;
  userName?: string;
}

export const DashboardLayout = ({ children, role, title, subtitle, userName }: DashboardLayoutProps) => {
  useEnsureDefaultBranch();
  const subscriptionReminder = useSubscriptionPaymentReminder();
  const isBusinessArea = role === "salon_admin" || role === "bar_admin";
  const isSubscriptionLocked = isBusinessArea && subscriptionReminder.isCritical;

  return (
    <div className="flex h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(135deg,hsl(224,71%,4%)_0%,hsl(258,63%,8%)_48%,hsl(224,71%,5%)_100%)]" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(168,85,247,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />

      {/* FOREGROUND CONTENT */}
      <div className="relative z-10 flex w-full h-full">
        <DashboardSidebar role={role} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader title={title} subtitle={subtitle} userName={userName} userRole={role} />
          <main className="relative flex-1 overflow-auto p-6">
            {subscriptionReminder.shouldPrompt && isBusinessArea && (
              <div
                className={cn(
                  "mb-6 rounded-2xl border p-4 shadow-sm",
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
