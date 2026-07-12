import { supabase } from '@/lib/supabase';

export class PalmaresService {
  /**
   * Génère automatiquement le bulletin en consolidant les notes, absences et retards.
   */
  static async generateReportCard(studentId: string, classId: string, academicYearId: string, period: string) {
    // 1. Fetch Student Info
    const { data: student } = await supabase.from('school_students').select('*').eq('id', studentId).single();
    
    // 2. Fetch Grades for all subjects in that period
    const { data: grades } = await supabase
      .from('school_exams')
      .select('subject_id, max_grade, grade')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId)
      .eq('period', period)
      .eq('is_locked', true);
      
    // 3. Fetch Attendance and Lates
    const { data: attendance } = await supabase
      .from('school_attendance')
      .select('status')
      .eq('student_id', studentId)
      .eq('class_id', classId);
      
    const absences = attendance?.filter(a => a.status === 'absent').length || 0;
    const lates = attendance?.filter(a => a.status === 'late').length || 0;
    const presences = attendance?.filter(a => a.status === 'present').length || 0;

    // 4. Calculate Averages
    let totalScore = 0;
    let totalMax = 0;
    const subjectAverages: Record<string, number> = {};

    if (grades) {
      grades.forEach(g => {
        totalScore += g.grade || 0;
        totalMax += g.max_grade || 100;
        subjectAverages[g.subject_id] = g.grade; // Simplified logic
      });
    }

    const overallAverage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

    // Return auto-generated consolidated data
    return {
      student,
      period,
      subjectAverages,
      overallAverage,
      discipline: {
        absences,
        lates,
        presences
      },
      // Rank would require fetching all students and sorting, mocked here:
      rank: 1 
    };
  }
}
