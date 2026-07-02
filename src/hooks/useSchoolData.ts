import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { setBusinessId, studentService, parentService, teacherService, classService, enrollmentService, invoiceService, paymentService, expenseService, payrollService, subjectService, assignmentService, attendanceService, timetableService, gradeService, smsService } from "@/modules/school/services";
import { useSchoolSettings } from "./useSchoolSettings";

function useBusinessId() {
  const { profile, user } = useAuth();
  return profile?.business_id || user?.user_metadata?.business_id;
}

// Students
export function useStudents() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "students"],
    queryFn: studentService.getAll,
    enabled: !!businessId,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: studentService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "students"] }),
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => studentService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "students"] }),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: studentService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "students"] }),
  });
}

// Parents
export function useParents() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "parents"],
    queryFn: parentService.getAll,
    enabled: !!businessId,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: parentService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "parents"] }),
  });
}

export function useUpdateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => parentService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "parents"] }),
  });
}

export function useDeleteParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: parentService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "parents"] }),
  });
}

// Teachers
export function useTeachers() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "teachers"],
    queryFn: teacherService.getAll,
    enabled: !!businessId,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "teachers"] }),
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teacherService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "teachers"] }),
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "teachers"] }),
  });
}

// Classes
export function useClasses() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "classes"],
    queryFn: classService.getAll,
    enabled: !!businessId,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "classes"] }),
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => classService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "classes"] }),
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "classes"] }),
  });
}

// Enrollments
export function useEnrollments(academicYearId?: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "enrollments", academicYearId],
    queryFn: () => academicYearId ? enrollmentService.getActiveByAcademicYear(academicYearId) : enrollmentService.getAll(),
    enabled: !!businessId,
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enrollmentService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["school", "students"] });
      queryClient.invalidateQueries({ queryKey: ["school", "invoices"] });
    },
  });
}

export function useTransferStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, newClassId, academicYearId }: { studentId: string; newClassId: string; academicYearId: string }) =>
      enrollmentService.transfer(studentId, newClassId, academicYearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["school", "students"] });
    },
  });
}

// Invoices
export function useInvoices() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "invoices"],
    queryFn: invoiceService.getAll,
    enabled: !!businessId,
  });
}

export function usePendingInvoices() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "invoices", "pending"],
    queryFn: invoiceService.getPending,
    enabled: !!businessId,
  });
}

export function useInvoiceStats() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "invoices", "stats"],
    queryFn: invoiceService.getStats,
    enabled: !!businessId,
  });
}

// Payments
export function usePayments() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "payments"],
    queryFn: () => paymentService.getAll(),
    enabled: !!businessId,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paymentService.recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["school", "invoices"] });
    },
  });
}

// Expenses
export function useExpenses() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "expenses"],
    queryFn: expenseService.getAll,
    enabled: !!businessId,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expenseService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "expenses"] }),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => expenseService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "expenses"] }),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expenseService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "expenses"] }),
  });
}

// Subjects
export function useSubjects() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "subjects"],
    queryFn: subjectService.getAll,
    enabled: !!businessId,
  });
}

export function useFindOrCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => subjectService.findOrCreate(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school", "subjects"] }),
  });
}

// Teacher Assignments
export function useTeacherAssignments(teacherId?: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "teacher-assignments", teacherId],
    queryFn: () => assignmentService.getByTeacherId(teacherId!),
    enabled: !!businessId && !!teacherId,
  });
}

export function useSaveTeacherAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teacherId, assignments, totalSalary }: {
      teacherId: string;
      assignments: Array<{
        class_id: string;
        subject_id: string;
        pay_mode: 'hourly' | 'monthly';
        hourly_rate: number;
        hours_per_week: number;
        monthly_salary: number;
      }>;
      totalSalary: number;
    }) => {
      const result = await assignmentService.saveTeacherAssignments(teacherId, assignments);
      await teacherService.update(teacherId, { salary: totalSalary });
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["school", "teacher-assignments", variables.teacherId] });
      queryClient.invalidateQueries({ queryKey: ["school", "teachers"] });
    },
  });
}

// Payroll
export function usePayroll(month: number, year: number) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "payroll", month, year],
    queryFn: () => payrollService.getByMonth(month, year),
    enabled: !!businessId,
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      payrollService.generateForMonth(month, year),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "payroll", vars.month, vars.year] });
    },
  });
}

export function useUpdatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, month, year }: {
      id: string;
      payload: { gross_salary?: number; absence_days?: number; deduction?: number };
      month: number;
      year: number;
    }) => payrollService.update(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "payroll", vars.month, vars.year] });
    },
  });
}

export function useMarkPayrollPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payMethod }: { id: string; payMethod: string; month: number; year: number }) =>
      payrollService.markPaid(id, payMethod),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "payroll", vars.month, vars.year] });
      queryClient.invalidateQueries({ queryKey: ["school", "expenses"] });
    },
  });
}

// Attendance
export function useClassAttendance(classId: string, date: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "attendance", classId, date],
    queryFn: () => attendanceService.getByClassAndDate(classId, date),
    enabled: !!businessId && !!classId && !!date,
  });
}

export function useSaveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, date, records }: {
      classId: string;
      date: string;
      records: Array<{ student_id: string; status: 'present' | 'absent' | 'late' | 'excused'; note?: string | null }>;
    }) => attendanceService.save(classId, date, records),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "attendance", vars.classId, vars.date] });
    },
  });
}

// Timetables
export function useTimetable(classId: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "timetable", classId],
    queryFn: () => timetableService.getByClass(classId),
    enabled: !!businessId && !!classId,
  });
}

export function useCreateTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: timetableService.create,
    onSuccess: (_, slot) => {
      queryClient.invalidateQueries({ queryKey: ["school", "timetable", slot.class_id] });
    },
  });
}

export function useUpdateTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => timetableService.update(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "timetable", vars.data.class_id] });
    },
  });
}

export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, classId }: { id: string; classId: string }) => timetableService.remove(id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "timetable", vars.classId] });
    },
  });
}

// Exams & Grades
export function useExams(classId: string, academicYearId: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "exams", classId, academicYearId],
    queryFn: () => gradeService.getExamsByClass(classId, academicYearId),
    enabled: !!businessId && !!classId && !!academicYearId,
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: gradeService.createExam,
    onSuccess: (_, exam) => {
      queryClient.invalidateQueries({ queryKey: ["school", "exams", exam.class_id, exam.academic_year_id] });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, classId, academicYearId }: { id: string; classId: string; academicYearId: string }) =>
      gradeService.removeExam(id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "exams", vars.classId, vars.academicYearId] });
    },
  });
}

export function useExamGrades(classId: string, examId: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "exam-grades", classId, examId],
    queryFn: () => gradeService.getGradesForExam(classId, examId),
    enabled: !!businessId && !!classId && !!examId,
  });
}

export function useSaveGrades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, grades }: {
      examId: string;
      grades: Array<{ student_id: string; points_obtained: number; note?: string | null }>;
      classId: string;
    }) => gradeService.saveGrades(examId, grades),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["school", "exam-grades", vars.classId, vars.examId] });
    },
  });
}

export function useClassReportCards(classId: string, academicYearId: string) {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "report-cards", classId, academicYearId],
    queryFn: () => gradeService.getClassReportCards(classId, academicYearId),
    enabled: !!businessId && !!classId && !!academicYearId,
  });
}

// SMS Gateway Settings
export function useSmsSettings() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "sms-settings"],
    queryFn: smsService.getSettings,
    enabled: !!businessId,
  });
}

export function useUpdateSmsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: smsService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "sms-settings"] });
    },
  });
}

export function useSmsLogs() {
  const businessId = useBusinessId();
  if (businessId) setBusinessId(businessId);
  return useQuery({
    queryKey: ["school", "sms-logs"],
    queryFn: smsService.getLogs,
    enabled: !!businessId,
  });
}
