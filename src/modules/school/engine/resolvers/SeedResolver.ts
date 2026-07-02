import { SchoolPlugin } from "../types";

export class SeedResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public getInitialClasses(): Array<{ name: string; code: string; cycle?: string; level_order?: number }> {
    return this.plugin.getInitialClasses();
  }
}
