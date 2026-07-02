import { ReactNode } from "react";
import { SchoolPlugin } from "../types";

export class DashboardResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public getDashboardWidgets(stats: any, formatAmount: any): ReactNode {
    return this.plugin.getDashboardWidgets(stats, formatAmount);
  }

  public async getDashboardStatsQuery(businessId: string, supabase: any): Promise<any> {
    return this.plugin.getDashboardStatsQuery(businessId, supabase);
  }
}
