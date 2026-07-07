import { GoogleGenerativeAI } from '@google/generative-ai';
import type { DocumentNode } from '../types/ast';

export class GeminiTranslationService {
  private genAI: GoogleGenerativeAI;
  
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async translateHtmlToAST(html: string): Promise<DocumentNode> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
Tu es un expert en structuration de données pour des bulletins scolaires (report cards).
Voici le contenu HTML extrait d'un document Word (DOCX) représentant un modèle de bulletin scolaire.
Ta mission est de convertir ce document en un format JSON strict (notre DocumentAST) qui respecte la structure suivante.

REGLES IMPORTANTES:
1. Chaque noeud (node) doit avoir un "id" unique (chaine aléatoire courte) et un "type".
2. Le noeud racine DOIT être de type "document".
3. Les paragraphes deviennent des noeuds de type "paragraph" avec des enfants (children).
4. Le texte devient des noeuds de type "text" avec une propriété "content".
5. Si tu détectes des variables (comme "Nom de l'étudiant", "Classe", ou des trous), remplace-les par des noeuds de type "variable" avec la propriété "variableId" correspondant à notre standard (ex: "student.last_name", "student.first_name", "school.name", "term.name", "grades.average").
6. Les tableaux deviennent "table", avec enfants "table_row", eux-mêmes avec enfants "table_cell".
7. Tu ne dois renvoyer QUE du JSON valide. Pas de texte autour.

HTML à analyser:
"""
${html}
"""
`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const cleaned = text.replace(/^```json/g, "").replace(/```$/g, "").trim();
      const ast = JSON.parse(cleaned);
      if (ast.type !== 'document') {
        ast.type = 'document';
      }
      return ast as DocumentNode;
    } catch (error) {
      console.error("Erreur lors de la traduction Gemini:", error);
      throw new Error("L'intelligence artificielle n'a pas pu traiter ce document.");
    }
  }
}
