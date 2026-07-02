import { ReactNode } from "react";
import { SchoolPlugin } from "../types";

export class ReportResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public getReportColumns(type: "classlist" | "attendance" | "grades"): any[] {
    return this.plugin.getReportColumns(type);
  }

  public getReportCardTemplate(student: any, formatAmount: any): ReactNode {
    return this.plugin.getReportCardTemplate(student, formatAmount);
  }

  public getReportCardSubjectLabel(): string {
    return this.plugin.getTerminology().subject || "Matière";
  }

  public getReportCardAverageLabel(): string {
    return this.plugin.getTerminology().average || "Moyenne";
  }
}
