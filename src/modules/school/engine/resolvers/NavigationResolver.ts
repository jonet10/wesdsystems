import { SidebarItem } from "@/components/dashboard/DashboardSidebar";
import { SchoolPlugin } from "../types";

export class NavigationResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public getMenuItems(t: any): SidebarItem[] {
    return this.plugin.getMenuItems(t);
  }
}
