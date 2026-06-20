import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { setBusinessId, studentService, parentService, teacherService, classService, enrollmentService, invoiceService, paymentService, expenseService } from "@/modules/school/services";
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
