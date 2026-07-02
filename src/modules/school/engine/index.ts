import { SchoolPlugin, SchoolCapability, SchoolType } from "./types";
import { TerminologyResolver } from "./resolvers/TerminologyResolver";
import { NavigationResolver } from "./resolvers/NavigationResolver";
import { FormResolver } from "./resolvers/FormResolver";
import { PermissionResolver } from "./resolvers/PermissionResolver";
import { DashboardResolver } from "./resolvers/DashboardResolver";
import { ReportResolver } from "./resolvers/ReportResolver";
import { ValidationResolver } from "./resolvers/ValidationResolver";
import { SeedResolver } from "./resolvers/SeedResolver";

export class SchoolEngine {
  private activePlugin: SchoolPlugin;
  
  public readonly terminology: TerminologyResolver;
  public readonly navigation: NavigationResolver;
  public readonly forms: FormResolver;
  public readonly permissions: PermissionResolver;
  public readonly dashboard: DashboardResolver;
  public readonly reports: ReportResolver;
  public readonly validation: ValidationResolver;
  public readonly seeds: SeedResolver;

  constructor(activePlugin: SchoolPlugin) {
    this.activePlugin = activePlugin;
    this.terminology = new TerminologyResolver(activePlugin);
    this.navigation = new NavigationResolver(activePlugin);
    this.forms = new FormResolver(activePlugin);
    this.permissions = new PermissionResolver(activePlugin);
    this.dashboard = new DashboardResolver(activePlugin);
    this.reports = new ReportResolver(activePlugin);
    this.validation = new ValidationResolver(activePlugin);
    this.seeds = new SeedResolver(activePlugin);
  }

  public getActivePlugin(): SchoolPlugin {
    return this.activePlugin;
  }

  public hasCapability(capability: SchoolCapability): boolean {
    return this.activePlugin.getCapabilities().has(capability);
  }

  public getSchoolType(): SchoolType {
    return this.activePlugin.id as SchoolType;
  }
}

export * from "./types";
export * from "./registry";
export * from "./resolvers/TerminologyResolver";
export * from "./resolvers/NavigationResolver";
export * from "./resolvers/FormResolver";
export * from "./resolvers/PermissionResolver";
export * from "./resolvers/DashboardResolver";
export * from "./resolvers/ReportResolver";
export * from "./resolvers/ValidationResolver";
export * from "./resolvers/SeedResolver";
