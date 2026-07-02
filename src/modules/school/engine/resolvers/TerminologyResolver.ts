import { SchoolPlugin } from "../types";

export class TerminologyResolver {
  private plugin: SchoolPlugin;
  private fallbackTerminology: Record<string, string> = {
    student: "Élève",
    students: "Élèves",
    class: "Classe",
    classes: "Classes",
    level: "Niveau",
    levels: "Niveaux",
    section: "Section",
    sections: "Sections",
    teacher: "Professeur",
    teachers: "Professeurs",
    subject: "Matière",
    subjects: "Matières",
    year: "Année Académique",
    years: "Années Académiques",
    reportCard: "Bulletin",
    reportCards: "Bulletins",
    average: "Moyenne",
    attendance: "Présences / Appel"
  };

  constructor(plugin: SchoolPlugin) {
    this.plugin = plugin;
  }

  public get(key: string): string {
    const terms = this.plugin.getTerminology();
    if (terms && terms[key]) {
      return terms[key];
    }
    return this.fallbackTerminology[key] || key;
  }
}
