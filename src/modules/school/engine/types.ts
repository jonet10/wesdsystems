import { ReactNode } from "react";
import { SidebarItem } from "@/components/dashboard/DashboardSidebar";

export enum SchoolCapability {
  MANAGE_FACULTIES = "MANAGE_FACULTIES",
  MANAGE_DEPARTMENTS = "MANAGE_DEPARTMENTS",
  MANAGE_PROGRAMS = "MANAGE_PROGRAMS",
  MANAGE_OPTIONS = "MANAGE_OPTIONS",
  MANAGE_SEMESTERS = "MANAGE_SEMESTERS",
  MANAGE_COHORTS = "MANAGE_COHORTS",
  MANAGE_PARENTS = "MANAGE_PARENTS",
  MANAGE_SCHOLARSHIPS = "MANAGE_SCHOLARSHIPS",
}

export type SchoolType = "CLASSIC" | "VOCATIONAL" | "UNIVERSITY";

export interface FormFieldSchema {
  name: string;
  label: string;
  type: "text" | "select" | "date" | "checkbox" | "textarea" | "number";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  fetchOptions?: (businessId: string, supabase: any) => Promise<Array<{ value: string; label: string }>>;
}

export interface SchoolPlugin {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  
  getCapabilities(): Set<SchoolCapability>;
  getTerminology(): Record<string, string>;
  getMenuItems(t: any): SidebarItem[];
  getStudentFormSchema(): FormFieldSchema[];
  getClassFormSchema(): FormFieldSchema[];
  getRequiredPermissions(): Record<string, string[]>;
  getDashboardWidgets(stats: any, formatAmount: any): ReactNode;
  getDashboardStatsQuery(businessId: string, supabase: any): Promise<any>;
  getReportColumns(type: "classlist" | "attendance" | "grades"): any[];
  getReportCardTemplate(student: any, formatAmount: any): ReactNode;
  getInitialClasses(): Array<{ name: string; code: string; cycle?: string; level_order?: number }>;
  validateStudent(data: any): string | null;
  validateClass(data: any): string | null;
}
