export interface DefaultClass {
  code: string;
  name: string;
  cycle: string;
  level_order: number;
}

export const DEFAULT_CLASSES: DefaultClass[] = [
  // Préscolaire
  { code: "PS", name: "Petite Section", cycle: "Préscolaire", level_order: 1 },
  { code: "MS", name: "Moyenne Section", cycle: "Préscolaire", level_order: 2 },
  { code: "GS", name: "Grande Section", cycle: "Préscolaire", level_order: 3 },

  // Fondamental 1er Cycle
  { code: "1AF", name: "1ère Année Fondamentale", cycle: "Fondamental 1er Cycle", level_order: 4 },
  { code: "2AF", name: "2ème Année Fondamentale", cycle: "Fondamental 1er Cycle", level_order: 5 },
  { code: "3AF", name: "3ème Année Fondamentale", cycle: "Fondamental 1er Cycle", level_order: 6 },

  // Fondamental 2e Cycle
  { code: "4AF", name: "4ème Année Fondamentale", cycle: "Fondamental 2e Cycle", level_order: 7 },
  { code: "5AF", name: "5ème Année Fondamentale", cycle: "Fondamental 2e Cycle", level_order: 8 },
  { code: "6AF", name: "6ème Année Fondamentale", cycle: "Fondamental 2e Cycle", level_order: 9 },

  // Fondamental 3e Cycle
  { code: "7AF", name: "7ème Année Fondamentale", cycle: "Fondamental 3e Cycle", level_order: 10 },
  { code: "8AF", name: "8ème Année Fondamentale", cycle: "Fondamental 3e Cycle", level_order: 11 },
  { code: "9AF", name: "9ème Année Fondamentale", cycle: "Fondamental 3e Cycle", level_order: 12 },

  // Secondaire Nouveau
  { code: "NS1", name: "Nouveau Secondaire 1", cycle: "Secondaire Nouveau", level_order: 13 },
  { code: "NS2", name: "Nouveau Secondaire 2", cycle: "Secondaire Nouveau", level_order: 14 },
  { code: "NS3", name: "Nouveau Secondaire 3", cycle: "Secondaire Nouveau", level_order: 15 },
  { code: "NS4", name: "Nouveau Secondaire 4", cycle: "Secondaire Nouveau", level_order: 16 },
];

export const CYCLES = [
  "Préscolaire",
  "Fondamental 1er Cycle",
  "Fondamental 2e Cycle",
  "Fondamental 3e Cycle",
  "Secondaire Nouveau",
];
