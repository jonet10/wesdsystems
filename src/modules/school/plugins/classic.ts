import { ReactNode } from "react";
import { SchoolPlugin, SchoolCapability, FormFieldSchema } from "../engine/types";
import { SidebarItem } from "@/components/dashboard/DashboardSidebar";
import {
  LayoutDashboard, Users, UserPlus, CalendarCheck, Layers, Calendar, FileSpreadsheet,
  BookOpen, UserCog, BadgeDollarSign, DollarSign, FileText, ShoppingBag, Receipt,
  Wallet, Package, ShoppingCart, TrendingUp, Settings
} from "lucide-react";
import { DEFAULT_CLASSES } from "../defaultClasses";

export class ClassicPlugin implements SchoolPlugin {
  public readonly id = "CLASSIC";
  public readonly version = "1.0.0";
  public readonly name = "École Classique";

  public getCapabilities(): Set<SchoolCapability> {
    return new Set([
      SchoolCapability.MANAGE_PARENTS,
      SchoolCapability.MANAGE_SCHOLARSHIPS
    ]);
  }

  public getTerminology(): Record<string, string> {
    return {
      student: "Élève",
      students: "Élèves",
      class: "Classe",
      classes: "Classes",
      level: "Niveau",
      levels: "Niveaux",
      section: "Section",
      sections: "Sections",
      teacher: "Professeur",
      teachers: "Professeurs",
      subject: "Matière",
      subjects: "Matières",
      year: "Année Académique",
      years: "Années Acad.",
      reportCard: "Bulletin",
      reportCards: "Notes & Bulletins",
      attendance: "Présences / Appel",
      average: "Moyenne"
    };
  }

  public getMenuItems(t: any): SidebarItem[] {
    const term = this.getTerminology();
    return [
      { icon: LayoutDashboard, label: "Tableau de Bord", path: "/school", role: "all", permission: "dashboard_view" },
      { icon: Users, label: term.students, path: "/school/students", role: "all", permission: "clients_read" },
      { icon: UserPlus, label: "Inscriptions", path: "/school/enrollments", role: "all", permission: "clients_manage" },
      { icon: CalendarCheck, label: term.attendance, path: "/school/attendance", role: "all", permission: "services_manage" },
      { icon: Layers, label: term.classes, path: "/school/classes", role: "all", permission: "services_manage" },
      { icon: Calendar, label: "Emplois du temps", path: "/school/timetables", role: "all", permission: "services_manage" },
      { icon: FileSpreadsheet, label: term.reportCards, path: "/school/grades", role: "all", permission: "services_manage" },
      { icon: BookOpen, label: term.subjects, path: "/school/subjects", role: "all", permission: "services_manage" },
      { icon: Calendar, label: term.years, path: "/school/academic-years", role: "all", permission: "settings_manage" },
      { icon: UserCog, label: "Personnel", path: "/school/teachers", role: "all", permission: "staff_manage" },
      { icon: BadgeDollarSign, label: "Frais & Tarifs", path: "/school/fees", role: "all", permission: "services_manage" },
      { icon: DollarSign, label: "Fiche Financière", path: "/school/finance/student", role: "all", permission: "dashboard_view" },
      { icon: FileText, label: "Factures", path: "/school/invoices", role: "all", permission: "dashboard_view" },
      { icon: ShoppingBag, label: "Caisse Scolaire", path: "/school/payments", role: "all", permission: "pos_view" },
      { icon: Receipt, label: "Dépenses", path: "/school/expenses", role: "all", permission: "expenses_manage" },
      { icon: Wallet, label: "Payroll", path: "/school/payroll", role: "all", permission: "expenses_manage" },
      { icon: Package, label: "Fournitures", path: "/school/inventory", role: "all", permission: "services_manage" },
      { icon: ShoppingCart, label: "Caisse Fournitures", path: "/school/pos", role: "all", permission: "pos_view" },
      { icon: UserCog, label: "Utilisateurs", path: "/school/staff", role: "salon_admin", permission: "staff_manage" },
      { icon: TrendingUp, label: "Rapports", path: "/school/reports", role: "salon_admin", permission: "reports_view" },
      { icon: Settings, label: "Paramètres", path: "/school/settings", role: "salon_admin", permission: "settings_manage" }
    ];
  }

  public getStudentFormSchema(): FormFieldSchema[] {
    return []; // No extra dynamic relation fields required for Classic
  }

  public getClassFormSchema(): FormFieldSchema[] {
    return []; // Standard fields are enough
  }

  public getRequiredPermissions(): Record<string, string[]> {
    return {
      dashboard: ["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"],
      students: ["salon_admin", "school_admin", "school_accountant", "school_teacher"],
      classes: ["salon_admin", "school_admin"],
      settings: ["salon_admin", "school_admin"]
    };
  }

  public getDashboardWidgets(stats: any, formatAmount: any): ReactNode {
    return null; // The main UI dashboard handles default rendering
  }

  public async getDashboardStatsQuery(businessId: string, supabase: any): Promise<any> {
    return {}; // No additional specific queries
  }

  public getReportColumns(type: "classlist" | "attendance" | "grades"): any[] {
    return [];
  }

  public getReportCardTemplate(student: any, formatAmount: any): ReactNode {
    return null; // Will fallback to classic renderer
  }

  public getInitialClasses() {
    return DEFAULT_CLASSES;
  }

  public validateStudent(data: any): string | null {
    return null; // Default validation is sufficient
  }

  public validateClass(data: any): string | null {
    return null;
  }
}
