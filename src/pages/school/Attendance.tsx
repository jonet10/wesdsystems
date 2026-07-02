import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarCheck, Users, CheckCircle2, XCircle, Clock, AlertCircle, Save, Check, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useClasses, useClassAttendance, useSaveAttendance } from "@/hooks/useSchoolData";
import { enrollmentService } from "@/modules/school/services/enrollmentService";
import { format } from "date-fns";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface StudentState {
  student_id: string;
  name: string;
  status: AttendanceStatus;
  note: string;
}

export default function SchoolAttendance() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();

  // Load students enrolled in the class
  const { data: enrollments = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["school", "enrollments-by-class", selectedClassId],
    queryFn: () => enrollmentService.getByClass(selectedClassId),
    enabled: !!selectedClassId,
  });

  // Load saved attendance for this class and date
  const { data: savedRecords = [], isLoading: isLoadingAttendance } = useClassAttendance(
    selectedClassId,
    selectedDate
  );

  const saveAttendanceMutation = useSaveAttendance();

  // Keep local state of student attendance values
  const [studentStates, setStudentStates] = useState<StudentState[]>([]);

  // Select first class by default when classes load
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Synchronize local states when enrollments or savedRecords change
  useEffect(() => {
    if (!selectedClassId || enrollments.length === 0) {
      setStudentStates([]);
      return;
    }

    // Map existing saved records by student ID (person_id)
    const savedMap = new Map(savedRecords.map(r => [r.person_id, r]));

    const initialStates: StudentState[] = enrollments
      .filter(e => e.student && e.status !== "withdrawn")
      .map(e => {
        const student = e.student;
        const saved = savedMap.get(student.id);
        return {
          student_id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          status: (saved?.status as AttendanceStatus) || "present", // Default to present if no attendance saved yet
          note: saved?.note || "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setStudentStates(initialStates);
  }, [selectedClassId, enrollments, savedRecords]);

  // Update status for a specific student
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudentStates(prev =>
      prev.map(s => (s.student_id === studentId ? { ...s, status } : s))
    );
  };

  // Update note for a specific student
  const handleNoteChange = (studentId: string, note: string) => {
    setStudentStates(prev =>
      prev.map(s => (s.student_id === studentId ? { ...s, note } : s))
    );
  };

  // Bulk actions
  const markAllStatus = (status: AttendanceStatus) => {
    setStudentStates(prev => prev.map(s => ({ ...s, status })));
    toast.success(`Tous les élèves ont été marqués comme : ${status === 'present' ? 'Présents' : status === 'absent' ? 'Absents' : status === 'late' ? 'En retard' : 'Excusés'}`);
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedClassId) return;
    try {
      const records = studentStates.map(s => ({
        student_id: s.student_id,
        status: s.status,
        note: s.note.trim() || null,
      }));

      await saveAttendanceMutation.mutateAsync({
        classId: selectedClassId,
        date: selectedDate,
        records,
      });

      toast.success("Registre d'appel enregistré avec succès !");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement de l'appel");
    }
  };

  // Summary counts
  const countPresent = studentStates.filter(s => s.status === "present").length;
  const countAbsent = studentStates.filter(s => s.status === "absent").length;
  const countLate = studentStates.filter(s => s.status === "late").length;
  const countExcused = studentStates.filter(s => s.status === "excused").length;

  const isSaving = saveAttendanceMutation.isPending;
  const isDataLoading = isLoadingClasses || isLoadingStudents || isLoadingAttendance;
  const hasStudents = studentStates.length > 0;
  const isAlreadyTaken = savedRecords.length > 0;

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarCheck className="h-6 w-6 text-primary" /> Registre d'Appels & Présences
            </h1>
            <p className="text-muted-foreground">Faites l'appel quotidien et gérez les absences des élèves par classe</p>
          </div>
        </div>

        {/* ── Selection Bar ── */}
        <Card className="p-4 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                disabled={isLoadingClasses}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {isLoadingClasses ? (
                  <option>Chargement des classes...</option>
                ) : classes.length === 0 ? (
                  <option>Aucune classe disponible</option>
                ) : (
                  classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                max={todayStr}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => markAllStatus("present")}
                disabled={!hasStudents || isDataLoading}
              >
                <Check className="h-4 w-4 mr-2 text-green-500" /> Tout Présent
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => markAllStatus("absent")}
                disabled={!hasStudents || isDataLoading}
              >
                <XCircle className="h-4 w-4 mr-2 text-destructive" /> Tout Absent
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Summary Stats Banner ── */}
        {hasStudents && !isDataLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Présents</p>
                <p className="text-lg font-bold text-green-600">{countPresent} <span className="text-xs font-normal text-muted-foreground">({Math.round((countPresent / studentStates.length) * 100)}%)</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absents</p>
                <p className="text-lg font-bold text-destructive">{countAbsent}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">En retard</p>
                <p className="text-lg font-bold text-yellow-600">{countLate}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Excusés</p>
                <p className="text-lg font-bold text-blue-600">{countExcused}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Taken Status Label */}
        {isAlreadyTaken && !isDataLoading && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            L'appel pour cette classe a déjà été effectué pour le {new Date(selectedDate).toLocaleDateString("fr-FR")}. Vous pouvez le modifier et réenregistrer.
          </div>
        )}

        {/* ── Students Roll Call Table ── */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Élève</TableHead>
                  <TableHead className="w-[45%]">Statut de Présence</TableHead>
                  <TableHead className="w-[20%]">Notes / Remarque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDataLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Chargement de la liste d'appel...
                    </TableCell>
                  </TableRow>
                ) : !selectedClassId ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                      Veuillez sélectionner une classe.
                    </TableCell>
                  </TableRow>
                ) : !hasStudents ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-45" />
                      Aucun élève inscrit n'a été trouvé dans cette classe pour l'année académique active.
                    </TableCell>
                  </TableRow>
                ) : (
                  studentStates.map(student => (
                    <TableRow key={student.student_id} className={student.status === "absent" ? "bg-destructive/5" : undefined}>
                      {/* Student Name */}
                      <TableCell className="font-medium text-base">
                        {student.name}
                      </TableCell>

                      {/* Presence Toggle Buttons */}
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {(["present", "absent", "late", "excused"] as const).map(status => {
                            let colorClass = "border-muted text-muted-foreground hover:bg-muted/30";
                            if (student.status === status) {
                              if (status === "present") colorClass = "border-green-600 bg-green-500/10 text-green-700 dark:text-green-400";
                              if (status === "absent") colorClass = "border-destructive bg-destructive/10 text-destructive";
                              if (status === "late") colorClass = "border-yellow-600 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
                              if (status === "excused") colorClass = "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-400";
                            }
                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusChange(student.student_id, status)}
                                className={`py-1.5 px-4 rounded-lg border-2 text-xs font-semibold uppercase tracking-wider transition-all ${colorClass}`}
                              >
                                {status === "present" ? "Présent" : status === "absent" ? "Absent" : status === "late" ? "En retard" : "Excusé"}
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>

                      {/* Notes / Remarks */}
                      <TableCell>
                        <Input
                          placeholder="Ex: Maladie..."
                          value={student.note}
                          onChange={e => handleNoteChange(student.student_id, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Footer Save Button ── */}
        {hasStudents && !isDataLoading && (
          <div className="flex justify-end pt-4">
            <Button size="lg" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Enregistrement de l'appel..." : "Enregistrer l'appel"}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
