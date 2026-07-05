import { supabase } from "@/lib/supabase";
import { getBusinessId } from "./utils";

export interface SchoolExam {
  id?: string;
  business_id: string;
  branch_id?: string | null;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  name: string;
  max_points: number;
  coefficient: number;
  exam_date: string;
  created_at?: string;
  
  // Relations
  subject?: { name: string };
  class?: { name: string };
}

export interface SchoolGrade {
  id?: string;
  business_id: string;
  exam_id: string;
  student_id: string;
  points_obtained: number;
  note?: string | null;
  created_at?: string;
}

export const gradeService = {
  async getExamsByClass(classId: string, academicYearId: string): Promise<SchoolExam[]> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_exams")
      .select("*, subject:school_subjects(name)")
      .eq("business_id", businessId)
      .eq("class_id", classId)
      .eq("academic_year_id", academicYearId)
      .order("exam_date", { ascending: false });

    if (error) throw error;
    return data as any[];
  },

  async createExam(payload: Partial<SchoolExam>): Promise<SchoolExam> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_exams")
      .insert([{ ...payload, business_id: businessId }])
      .select("*, subject:school_subjects(name)")
      .single();

    if (error) throw error;
    return data as any;
  },

  async removeExam(id: string): Promise<void> {
    const { error } = await supabase
      .from("school_exams")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  /** Get students in the class with their grade details for a specific exam */
  async getGradesForExam(classId: string, examId: string): Promise<Array<{
    student_id: string;
    student_name: string;
    matricule?: string;
    points_obtained: number | string; // string allowed for empty input
    note: string;
  }>> {
    const businessId = getBusinessId();

    // 1. Get enrolled students in the class
    const { data: enrollments, error: enrollError } = await supabase
      .from("school_enrollments")
      .select("*, student:student_id(*)")
      .eq("class_id", classId)
      .in("status", ["registered", "active"]);
    if (enrollError) throw enrollError;

    if (!enrollments || enrollments.length === 0) return [];

    // 2. Get grades already registered for this exam
    const { data: grades, error: gradeError } = await supabase
      .from("school_grades")
      .select("*")
      .eq("exam_id", examId);
    if (gradeError) throw gradeError;

    const gradesMap = new Map(grades?.map(g => [g.student_id, g]) || []);

    return enrollments
      .filter(e => e.student)
      .map(e => {
        const student = e.student;
        const g = gradesMap.get(student.id);
        return {
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          matricule: student.matricule || undefined,
          points_obtained: g ? g.points_obtained : "",
          note: g?.note || "",
        };
      })
      .sort((a, b) => a.student_name.localeCompare(b.student_name));
  },

  /** Save grade entries for an exam */
  async saveGrades(examId: string, grades: Array<{
    student_id: string;
    points_obtained: number;
    note?: string | null;
  }>): Promise<void> {
    const businessId = getBusinessId();

    // Delete existing entries for this exam to prevent duplicate key violations
    const { error: deleteError } = await supabase
      .from("school_grades")
      .delete()
      .eq("exam_id", examId);
    if (deleteError) throw deleteError;

    if (grades.length === 0) return;

    const toInsert = grades.map(g => ({
      business_id: businessId,
      exam_id: examId,
      student_id: g.student_id,
      points_obtained: g.points_obtained,
      note: g.note || null,
    }));

    const { error: insertError } = await supabase
      .from("school_grades")
      .insert(toInsert);

    if (insertError) throw insertError;
  },

  /** Generate dynamic report card data for all students in a class */
  async getClassReportCards(classId: string, academicYearId: string): Promise<any[]> {
    const businessId = getBusinessId();

    // 1. Fetch class details
    const { data: classObj } = await supabase
      .from("school_classes")
      .select("name")
      .eq("id", classId)
      .single();

    // 2. Fetch all student enrollments
    const { data: enrollments } = await supabase
      .from("school_enrollments")
      .select("*, student:student_id(*)")
      .eq("class_id", classId)
      .in("status", ["registered", "active"]);

    const activeStudents = enrollments?.filter(e => e.student).map(e => e.student) || [];
    if (activeStudents.length === 0) return [];

    // 3. Fetch all exams in the class for the academic year
    const exams = await gradeService.getExamsByClass(classId, academicYearId);
    if (exams.length === 0) return [];

    const examIds = exams.map(e => e.id!);

    // 4. Fetch all grades for these exams
    const { data: allGrades } = await supabase
      .from("school_grades")
      .select("*")
      .in("exam_id", examIds);

    const gradesMap = new Map<string, SchoolGrade[]>(); // key: student_id
    (allGrades || []).forEach(g => {
      const list = gradesMap.get(g.student_id) || [];
      list.push(g);
      gradesMap.set(g.student_id, list);
    });

    // 5. Fetch class coefficients and domains
    const { data: coeffData } = await supabase
      .from("school_class_subject_coefficients")
      .select("*, school_subject_domains(*)")
      .eq("class_id", classId);

    const coeffsMap = new Map<string, { coefficient: number; domain_id: string | null; domain_name: string | null; display_order: number }>();
    (coeffData || []).forEach(c => {
      coeffsMap.set(c.subject_id, {
        coefficient: Number(c.coefficient),
        domain_id: c.domain_id,
        domain_name: c.school_subject_domains?.name || null,
        display_order: c.school_subject_domains?.display_order || 0
      });
    });

    // 6. Aggregate averages by student and subject
    const subjectList = Array.from(new Set(exams.map(e => JSON.stringify({ id: e.subject_id, name: e.subject?.name }))));
    const subjects = subjectList.map(s => JSON.parse(s));

    const studentReportCards = activeStudents.map(student => {
      const studentGrades = gradesMap.get(student.id) || [];
      const sGradesMap = new Map(studentGrades.map(g => [g.exam_id, g.points_obtained]));

      let totalWeightedScore = 0;
      let totalCoefficient = 0;

      const subjectDetails = subjects.map(sub => {
        // Find exams of this subject
        const subExams = exams.filter(e => e.subject_id === sub.id);
        
        let subWeightedSum = 0;
        let subCoefSum = 0;

        subExams.forEach(ex => {
          const score = sGradesMap.get(ex.id!);
          if (score !== undefined) {
            // Calculate percentage score (out of 1)
            const scorePct = score / ex.max_points;
            subWeightedSum += scorePct * ex.coefficient;
            subCoefSum += ex.coefficient;
          }
        });

        const subjectPct = subCoefSum > 0 ? (subWeightedSum / subCoefSum) : null;
        
        // Load custom coefficient (acts as note max)
        const customCoeff = coeffsMap.get(sub.id);
        const subjectMax = customCoeff?.coefficient ?? 10; // Default max is 10
        const domainId = customCoeff?.domain_id || null;
        const domainName = customCoeff?.domain_name || null;
        const displayOrder = customCoeff?.display_order || 0;

        const studentNote = subjectPct !== null ? Number((subjectPct * subjectMax).toFixed(2)) : null;

        if (studentNote !== null) {
          totalWeightedScore += studentNote;
          totalCoefficient += subjectMax;
        }

        return {
          subject_id: sub.id,
          subject_name: sub.name,
          average: studentNote,
          coef: subjectMax,
          domain_id: domainId,
          domain_name: domainName,
          display_order: displayOrder
        };
      });

      // Scale overall average to 10 base
      const overallAverage = totalCoefficient > 0 ? Number(((totalWeightedScore / totalCoefficient) * 10).toFixed(2)) : null;

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        matricule: student.matricule || "-",
        gender: student.gender || "-",
        subjects: subjectDetails,
        totalPoints: Number(totalWeightedScore.toFixed(2)),
        totalCoefficients: totalCoefficient,
        overallAverage,
      };
    });

    // Calculate class averages for each subject
    const classSubjectAverages = subjects.map(sub => {
      const studentAverages = studentReportCards
        .map(card => card.subjects.find((s: any) => s.subject_id === sub.id)?.average)
        .filter(avg => avg !== null && avg !== undefined) as number[];

      const classAvg = studentAverages.length > 0
        ? Number((studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length).toFixed(2))
        : null;

      return {
        subject_id: sub.id,
        average: classAvg,
      };
    });

    // Sort student cards to calculate ranks
    const sortedReportCards = [...studentReportCards].sort((a, b) => {
      const avgA = a.overallAverage ?? -1;
      const avgB = b.overallAverage ?? -1;
      return avgB - avgA; // Descending
    });

    // Assign ranks
    const finalReportCards = sortedReportCards.map((card, index) => {
      // Handle ties nicely
      let rank = index + 1;
      if (index > 0 && card.overallAverage === sortedReportCards[index - 1].overallAverage) {
        // Find previous card's rank
        rank = (sortedReportCards[index - 1] as any).rank;
      }

      // Add class averages to subjects
      const enrichedSubjects = card.subjects.map((sub: any) => {
        const classAvgObj = classSubjectAverages.find(c => c.subject_id === sub.subject_id);
        return {
          ...sub,
          classAverage: classAvgObj?.average || null,
        };
      });

      return {
        ...card,
        rank,
        subjects: enrichedSubjects,
        className: classObj?.name || "",
      };
    });

    return finalReportCards;
  },

  /** Generate Palmares data for a specific subject across all periods */
  async getPalmaresForSubject(classId: string, subjectId: string, academicYearId: string): Promise<any> {
    const businessId = getBusinessId();

    // 1. Fetch class details
    const { data: classObj } = await supabase
      .from("school_classes")
      .select("name")
      .eq("id", classId)
      .single();

    // 2. Fetch subject details
    const { data: subjectObj } = await supabase
      .from("school_subjects")
      .select("name")
      .eq("id", subjectId)
      .single();

    // 3. Fetch Teacher for this class and subject 
    // Usually mapped via school_subject_classes or school_assignments.
    // For simplicity, we'll try to find the assignment or fallback to empty string
    const { data: assignmentData } = await supabase
      .from("school_assignments")
      .select("*, teacher:teacher_id(first_name, last_name)")
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    const teacherName = assignmentData?.teacher 
      ? `${assignmentData.teacher.first_name} ${assignmentData.teacher.last_name}` 
      : "Non assigné";

    // 4. Fetch all enrollments for this class
    const { data: enrollments } = await supabase
      .from("school_enrollments")
      .select("*, student:student_id(*)")
      .eq("class_id", classId)
      .in("status", ["registered", "active"]);

    const activeStudents = enrollments?.filter(e => e.student).map(e => e.student) || [];

    // 5. Fetch exams for this specific subject & class
    const { data: exams, error: examsError } = await supabase
      .from("school_exams")
      .select("*")
      .eq("business_id", businessId)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .eq("academic_year_id", academicYearId);

    if (examsError) throw examsError;

    // Use max points from the most recent exam or default to 100
    const maxPoints = exams && exams.length > 0 ? exams[0].coefficient : 100;

    const examIds = (exams || []).map(e => e.id);

    // 6. Fetch grades for these exams
    const { data: grades } = await supabase
      .from("school_grades")
      .select("*")
      .in("exam_id", examIds.length > 0 ? examIds : ['00000000-0000-0000-0000-000000000000']);

    // Map grades by student
    const studentGradesMap = new Map<string, any[]>();
    (grades || []).forEach(g => {
      const list = studentGradesMap.get(g.student_id) || [];
      list.push(g);
      studentGradesMap.set(g.student_id, list);
    });

    // Structure data for Palmares
    const studentsData = activeStudents.map(student => {
      const sGrades = studentGradesMap.get(student.id) || [];
      const periodScores: Record<string, string | number> = {};

      (exams || []).forEach(exam => {
        const gradeForExam = sGrades.find(g => g.exam_id === exam.id);
        const periodName = (exam as any).period_name || "N/A";
        periodScores[periodName] = gradeForExam ? gradeForExam.points_obtained : "";
      });

      return {
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        matricule: student.matricule || "-",
        period_scores: periodScores
      };
    });

    // Sort students alphabetically
    studentsData.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

    return {
      className: classObj?.name || "",
      subjectName: subjectObj?.name || "",
      teacherName,
      maxPoints,
      students: studentsData,
      periodsFound: Array.from(new Set((exams || []).map(e => (e as any).period_name).filter(Boolean)))
    };
  }
};
