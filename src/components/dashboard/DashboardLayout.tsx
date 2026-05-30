import { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "super_admin" | "salon_admin" | "employee" | "partner";
  title: string;
  subtitle?: string;
  userName?: string;
}

export const DashboardLayout = ({ children, role, title, subtitle, userName }: DashboardLayoutProps) => {
  return (
    <div className="flex h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(135deg,hsl(224,71%,4%)_0%,hsl(258,63%,8%)_48%,hsl(224,71%,5%)_100%)]" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(168,85,247,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />

      {/* FOREGROUND CONTENT */}
      <div className="relative z-10 flex w-full h-full">
        <DashboardSidebar role={role} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader title={title} subtitle={subtitle} userName={userName} userRole={role} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
