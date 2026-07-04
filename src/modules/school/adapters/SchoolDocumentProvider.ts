import { 
  DataProvider, 
  VariableDefinition, 
  CollectionDefinition, 
  DataPayload 
} from '../../document-engine/types/capabilities';
import { supabase } from '@/lib/supabase';

export class SchoolDocumentProvider implements DataProvider {
  moduleName = 'school';

  getVariables(): VariableDefinition[] {
    return [
      // Élève
      { id: 'student.firstName', category: 'Élève', type: 'string', label: 'Prénom de l\'élève' },
      { id: 'student.lastName', category: 'Élève', type: 'string', label: 'Nom de l\'élève' },
      { id: 'student.fullName', category: 'Élève', type: 'string', label: 'Nom complet de l\'élève' },
      { id: 'student.gender', category: 'Élève', type: 'string', label: 'Sexe (M/F)' },
      { id: 'student.birthDate', category: 'Élève', type: 'date', label: 'Date de naissance' },
      { id: 'student.matricule', category: 'Élève', type: 'string', label: 'Matricule / Identifiant' },
      { id: 'student.absences', category: 'Élève', type: 'number', label: 'Nombre de jours d\'absence' },
      { id: 'student.tardiness', category: 'Élève', type: 'number', label: 'Nombre de retards' },
      { id: 'student.behaviorGrade', category: 'Élève', type: 'number', label: 'Note de conduite' },

      // Classe
      { id: 'class.name', category: 'Classe', type: 'string', label: 'Nom de la classe' },
      { id: 'class.level', category: 'Classe', type: 'string', label: 'Niveau' },
      { id: 'class.headTeacher', category: 'Classe', type: 'string', label: 'Professeur principal' },

      // Établissement
      { id: 'school.name', category: 'Établissement', type: 'string', label: 'Nom de l\'établissement' },
      { id: 'school.address', category: 'Établissement', type: 'string', label: 'Adresse' },
      { id: 'school.phone', category: 'Établissement', type: 'string', label: 'Téléphone' },
      { id: 'school.email', category: 'Établissement', type: 'string', label: 'Email' },
      { id: 'school.logo', category: 'Établissement', type: 'image', label: 'Logo de l\'établissement' },

      // Année Scolaire & Période
      { id: 'academic.year', category: 'Académique', type: 'string', label: 'Année scolaire (ex: 2025-2026)' },
      { id: 'academic.period', category: 'Académique', type: 'string', label: 'Période (Trimestre 1, Semestre 1...)' },

      // Synthèse Notes
      { id: 'report.overallAverage', category: 'Notes', type: 'number', label: 'Moyenne générale de l\'élève' },
      { id: 'report.classAverage', category: 'Notes', type: 'number', label: 'Moyenne générale de la classe' },
      { id: 'report.rank', category: 'Notes', type: 'number', label: 'Rang de l\'élève' },
      { id: 'report.decision', category: 'Notes', type: 'string', label: 'Décision du conseil' },
      { id: 'report.appreciation', category: 'Notes', type: 'string', label: 'Mention / Appréciation globale' },
    ];
  }

  getCollections(): CollectionDefinition[] {
    return [
      {
        id: 'student.grades',
        label: 'Relevé de notes par matière',
        type: 'table',
        schema: [
          { id: 'subjectName', category: 'Matière', type: 'string', label: 'Nom de la matière' },
          { id: 'category', category: 'Matière', type: 'string', label: 'Catégorie (Domaine)' },
          { id: 'coefficient', category: 'Matière', type: 'number', label: 'Coefficient' },
          { id: 'grade', category: 'Matière', type: 'number', label: 'Note sur 10' },
          { id: 'gradeOutOf20', category: 'Matière', type: 'number', label: 'Note sur 20' },
          { id: 'average', category: 'Matière', type: 'number', label: 'Moyenne de classe' },
          { id: 'minGrade', category: 'Matière', type: 'number', label: 'Note minimum' },
          { id: 'maxGrade', category: 'Matière', type: 'number', label: 'Note maximum' },
          { id: 'teacherName', category: 'Matière', type: 'string', label: 'Nom du professeur' },
          { id: 'appreciation', category: 'Matière', type: 'string', label: 'Appréciation' },
        ],
        groupBy: ['category'] // Allow grouping by "Domaine" for Model B style
      }
    ];
  }

  /**
   * En production, cette méthode récupèrera les vraies données de Supabase.
   * Pour l'instant, c'est un mock ou une implémentation partielle pour prouver le concept.
   */
  async fetchData(contextId: string): Promise<DataPayload> {
    // contextId might be "studentId_periodId" in a real implementation
    // We mock the response to match the current renderBulletin expected data structure.
    return {
      variables: {
        'student.firstName': 'Jean',
        'student.lastName': 'Dupont',
        'student.fullName': 'Jean Dupont',
        'student.gender': 'M',
        'student.birthDate': '2010-05-14',
        'student.matricule': 'WESD-2010-JD',
        'student.absences': 2,
        'student.tardiness': 0,
        'student.behaviorGrade': 9,

        'class.name': '3ème A',
        'class.level': 'Secondaire',
        'class.headTeacher': 'Mme. Martin',

        'school.name': 'Lycée WesdSystems',
        'school.address': '123 Rue de la Technologie',
        'school.phone': '+509 33 44 55 66',
        
        'academic.year': '2025-2026',
        'academic.period': 'Trimestre 1',

        'report.overallAverage': 8.5,
        'report.classAverage': 7.2,
        'report.rank': 1,
        'report.decision': 'Félicitations',
        'report.appreciation': 'Excellent travail',
      },
      collections: {
        'student.grades': [
          {
            subjectName: 'Mathématiques',
            category: 'Sciences',
            coefficient: 3,
            grade: 9,
            gradeOutOf20: 18,
            average: 6.5,
            minGrade: 4,
            maxGrade: 9,
            teacherName: 'M. Paul',
            appreciation: 'Très bien'
          },
          {
            subjectName: 'Physique',
            category: 'Sciences',
            coefficient: 2,
            grade: 8,
            gradeOutOf20: 16,
            average: 6.0,
            minGrade: 3,
            maxGrade: 9.5,
            teacherName: 'Mme. Curie',
            appreciation: 'Bons résultats'
          }
        ]
      }
    };
  }
}
