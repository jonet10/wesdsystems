import { SchoolPlugin } from "../types";

export class PermissionResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public getRequiredPermissions(): Record<string, string[]> {
    return this.plugin.getRequiredPermissions();
  }

  public checkAccess(role: string, view: string): boolean {
    const permissions = this.plugin.getRequiredPermissions();
    if (!permissions[view]) return true; // defaults to allowed
    return permissions[view].includes(role);
  }
}
