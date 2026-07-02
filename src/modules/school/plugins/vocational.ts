import { ReactNode } from "react";
import { SchoolPlugin, SchoolCapability, FormFieldSchema } from "../engine/types";
import { SidebarItem } from "@/components/dashboard/DashboardSidebar";
import {
  LayoutDashboard, Users, UserPlus, CalendarCheck, Layers, Calendar, FileSpreadsheet,
  BookOpen, UserCog, BadgeDollarSign, DollarSign, FileText, ShoppingBag, Receipt,
  Wallet, Package, ShoppingCart, TrendingUp, Settings
} from "lucide-react";

export class VocationalPlugin implements SchoolPlugin {
  public readonly id = "VOCATIONAL";
  public readonly version = "1.0.0";
  public readonly name = "École Professionnelle";

  public getCapabilities(): Set<SchoolCapability> {
    return new Set([
      SchoolCapability.MANAGE_COHORTS,
      SchoolCapability.MANAGE_SCHOLARSHIPS,
      SchoolCapability.MANAGE_OPTIONS
    ]);
  }

  public getTerminology(): Record<string, string> {
    return {
      student: "Apprenant",
      students: "Apprenants",
      class: "Option",
      classes: "Options",
      level: "Niveau professionnel",
      levels: "Niveaux professionnels",
      section: "Cycle",
      sections: "Cycles",
      teacher: "Formateur",
      teachers: "Formateurs",
      subject: "Module / Compétence",
      subjects: "Modules & Compétences",
      year: "Promotion",
      years: "Promotions",
      reportCard: "Relevé de résultats",
      reportCards: "Relevés & Certifications",
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
      { icon: UserCog, label: term.teachers, path: "/school/teachers", role: "all", permission: "staff_manage" },
      { icon: BadgeDollarSign, label: "Frais & Tarifs", path: "/school/fees", role: "all", permission: "services_manage" },
      { icon: DollarSign, label: "Fiche Financière", path: "/school/finance/student", role: "all", permission: "dashboard_view" },
      { icon: FileText, label: "Factures", path: "/school/invoices", role: "all", permission: "dashboard_view" },
      { icon: ShoppingBag, label: "Caisse", path: "/school/payments", role: "all", permission: "pos_view" },
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
    return [
      { name: "profession", label: "Profession actuelle", type: "text" },
      { name: "previous_level", label: "Niveau d'études précédent", type: "text" },
      { name: "experience", label: "Expérience professionnelle (ex: 2 ans)", type: "text" },
      { name: "provenance_center", label: "Centre de provenance / École antérieure", type: "text" },
      { name: "professional_goal", label: "Objectif professionnel après formation", type: "textarea" },
      {
        name: "promotion_id",
        label: "Promotion / Cohorte d'admission",
        type: "select",
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_promotions").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: false });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      }
    ];
  }

  public getClassFormSchema(): FormFieldSchema[] {
    return [
      {
        name: "program_id",
        label: "Filière / Programme associé",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_programs").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "promotion_id",
        label: "Promotion / Cohorte",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_promotions").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: false });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      }
    ];
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
    return null; // Will use engine resolvers
  }

  public async getDashboardStatsQuery(businessId: string, supabase: any): Promise<any> {
    const [optionsCount, promotionsCount] = await Promise.all([
      supabase.from("school_classes").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      supabase.from("school_promotions").select("id", { count: "exact", head: true }).eq("business_id", businessId)
    ]);
    return {
      totalClasses: optionsCount.count || 0,
      totalPromotions: promotionsCount.count || 0
    };
  }

  public getReportColumns(type: "classlist" | "attendance" | "grades"): any[] {
    return [];
  }

  public getReportCardTemplate(student: any, formatAmount: any): ReactNode {
    return null;
  }

  public getInitialClasses() {
    return []; // No default classes to seed for vocational school
  }

  public validateStudent(data: any): string | null {
    return null;
  }

  public validateClass(data: any): string | null {
    if (!data.program_id) return "Veuillez sélectionner un programme/filière";
    if (!data.promotion_id) return "Veuillez sélectionner une promotion/cohorte";
    return null;
  }
}
