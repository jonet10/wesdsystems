import { SchoolPlugin } from "../types";

export class ValidationResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public validateStudent(data: any): string | null {
    return this.plugin.validateStudent(data);
  }

  public validateClass(data: any): string | null {
    return this.plugin.validateClass(data);
  }
}
