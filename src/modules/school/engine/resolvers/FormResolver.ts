import { FormFieldSchema, SchoolPlugin } from "../types";

export class FormResolver {
  private plugin: SchoolPlugin;

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public getStudentFormSchema(): FormFieldSchema[] {
    return this.plugin.getStudentFormSchema();
  }

  public getClassFormSchema(): FormFieldSchema[] {
    return this.plugin.getClassFormSchema();
  }
}
