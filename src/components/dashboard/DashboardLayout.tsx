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
    <div className="flex h-screen relative overflow-hidden bg-background">
      {/* GLOBAL BACKGROUND GIF */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <img src="/images/Background.gif" alt="Platform Background" className="w-full h-full object-cover" />
      </div>
      {/* LIGHT OVERLAY TO ENSURE TEXT REMAINS READABLE, BUT NO BLUR */}
      <div className="absolute inset-0 z-0 bg-background/60 pointer-events-none" />

      {/* FOREGROUND CONTENT */}
      <div className="relative z-10 flex w-full h-full">
        <DashboardSidebar role={role} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader title={title} subtitle={subtitle} userName={userName} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
