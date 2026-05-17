import { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "super_admin" | "salon_admin" | "employee";
  title: string;
  subtitle?: string;
  userName?: string;
}

export const DashboardLayout = ({ children, role, title, subtitle, userName }: DashboardLayoutProps) => {
  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader title={title} subtitle={subtitle} userName={userName} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
