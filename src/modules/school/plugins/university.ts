import { ReactNode } from "react";
import { SchoolPlugin, SchoolCapability, FormFieldSchema } from "../engine/types";
import { SidebarItem } from "@/components/dashboard/DashboardSidebar";
import {
  LayoutDashboard, Users, UserPlus, CalendarCheck, Layers, Calendar, FileSpreadsheet,
  BookOpen, UserCog, BadgeDollarSign, DollarSign, FileText, ShoppingBag, Receipt,
  Wallet, Package, ShoppingCart, TrendingUp, Settings
} from "lucide-react";

export class UniversityPlugin implements SchoolPlugin {
  public readonly id = "UNIVERSITY";
  public readonly version = "1.0.0";
  public readonly name = "Université";

  public getCapabilities(): Set<SchoolCapability> {
    return new Set([
      SchoolCapability.MANAGE_FACULTIES,
      SchoolCapability.MANAGE_DEPARTMENTS,
      SchoolCapability.MANAGE_PROGRAMS,
      SchoolCapability.MANAGE_OPTIONS,
      SchoolCapability.MANAGE_SEMESTERS,
      SchoolCapability.MANAGE_COHORTS,
      SchoolCapability.MANAGE_SCHOLARSHIPS
    ]);
  }

  public getTerminology(): Record<string, string> {
    return {
      student: "Étudiant",
      students: "Étudiants",
      class: "Groupe d'études",
      classes: "Programmes & Groupes",
      level: "Semestre",
      levels: "Semestres",
      section: "Département",
      sections: "Départements",
      faculty: "Faculté",
      faculties: "Facultés",
      teacher: "Enseignant",
      teachers: "Enseignants",
      subject: "Cours / UE",
      subjects: "Cours / UE",
      year: "Année Universitaire",
      years: "Années Universitaires",
      reportCard: "Relevé de notes",
      reportCards: "Relevés de notes",
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
      { icon: Layers, label: "Facultés & Programmes", path: "/school/classes", role: "all", permission: "services_manage" },
      { icon: Calendar, label: "Emplois du temps", path: "/school/timetables", role: "all", permission: "services_manage" },
      { icon: FileSpreadsheet, label: term.reportCards, path: "/school/grades", role: "all", permission: "services_manage" },
      { icon: BookOpen, label: term.subjects, path: "/school/subjects", role: "all", permission: "services_manage" },
      { icon: Calendar, label: term.years, path: "/school/academic-years", role: "all", permission: "settings_manage" },
      { icon: UserCog, label: term.teachers, path: "/school/teachers", role: "all", permission: "staff_manage" },
      { icon: BadgeDollarSign, label: "Frais & Tarifs", path: "/school/fees", role: "all", permission: "services_manage" },
      { icon: DollarSign, label: "Fiche Financière", path: "/school/finance/student", role: "all", permission: "dashboard_view" },
      { icon: FileText, label: "Factures", path: "/school/invoices", role: "all", permission: "dashboard_view" },
      { icon: ShoppingBag, label: "Encaissements", path: "/school/payments", role: "all", permission: "pos_view" },
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
      {
        name: "faculty_id",
        label: "Faculté",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_faculties").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "department_id",
        label: "Département",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_departments").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "program_id",
        label: "Programme",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_programs").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "semester_id",
        label: "Semestre actuel",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_semesters").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "promotion_id",
        label: "Cohorte / Promotion d'admission",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_promotions").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: false });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      { name: "admission_date", label: "Date d'admission", type: "date" },
      {
        name: "admission_type",
        label: "Type d'admission",
        type: "select",
        options: [
          { value: "concours", label: "Sur Concours" },
          { value: "dossier", label: "Sur Dossier" },
          { value: "transfert", label: "Transfert universitaire" },
          { value: "equivalence", label: "Équivalence" }
        ]
      }
    ];
  }

  public getClassFormSchema(): FormFieldSchema[] {
    return [
      {
        name: "faculty_id",
        label: "Faculté associée",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_faculties").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "department_id",
        label: "Département associé",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_departments").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "program_id",
        label: "Programme / Spécialisation",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_programs").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "semester_id",
        label: "Semestre d'études",
        type: "select",
        required: true,
        fetchOptions: async (businessId, supabase) => {
          const { data } = await supabase.from("school_semesters").select("id, name").eq("business_id", businessId).eq("active", true).order("name", { ascending: true });
          return (data || []).map((d: any) => ({ value: d.id, label: d.name }));
        }
      },
      {
        name: "promotion_id",
        label: "Cohorte / Promotion",
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
    return null; // Will render dynamic grid count in Dashboard page
  }

  public async getDashboardStatsQuery(businessId: string, supabase: any): Promise<any> {
    const [facRes, depRes, progRes] = await Promise.all([
      supabase.from("school_faculties").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      supabase.from("school_departments").select("id", { count: "exact", head: true }).eq("business_id", businessId),
      supabase.from("school_programs").select("id", { count: "exact", head: true }).eq("business_id", businessId)
    ]);
    return {
      totalFaculties: facRes.count || 0,
      totalDepartments: depRes.count || 0,
      totalClasses: progRes.count || 0 // Programmes count maps to totalClasses dashboard stat
    };
  }

  public getReportColumns(type: "classlist" | "attendance" | "grades"): any[] {
    return [];
  }

  public getReportCardTemplate(student: any, formatAmount: any): ReactNode {
    return null;
  }

  public getInitialClasses() {
    return []; // No default classes to seed for university
  }

  public validateStudent(data: any): string | null {
    if (!data.faculty_id) return "Faculté obligatoire pour l'université";
    if (!data.department_id) return "Département obligatoire pour l'université";
    if (!data.program_id) return "Programme obligatoire pour l'université";
    if (!data.semester_id) return "Semestre obligatoire pour l'université";
    if (!data.promotion_id) return "Cohorte obligatoire pour l'université";
    return null;
  }

  public validateClass(data: any): string | null {
    if (!data.faculty_id) return "Faculté obligatoire";
    if (!data.department_id) return "Département obligatoire";
    if (!data.program_id) return "Programme obligatoire";
    if (!data.semester_id) return "Semestre obligatoire";
    if (!data.promotion_id) return "Cohorte obligatoire";
    return null;
  }
}
