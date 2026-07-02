import { SchoolPlugin } from "./types";
import { ClassicPlugin } from "../plugins/classic";
import { VocationalPlugin } from "../plugins/vocational";
import { UniversityPlugin } from "../plugins/university";

class PluginRegistry {
  private plugins = new Map<string, SchoolPlugin>();

  constructor() {
    this.register(new ClassicPlugin());
    this.register(new VocationalPlugin());
    this.register(new UniversityPlugin());
  }

  public register(plugin: SchoolPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  public get(type: string): SchoolPlugin {
    return this.plugins.get(type) || this.plugins.get("CLASSIC")!;
  }

  public getAll(): SchoolPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const schoolPluginRegistry = new PluginRegistry();
