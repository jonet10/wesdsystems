import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Lock, AlertCircle, RefreshCw } from "lucide-react";
import { SchoolNotificationService } from "@/modules/school/services/SchoolNotificationService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { gradeService } from "@/modules/school/services/gradeService";

interface StudentGradeState {
  id: string;
  name: string;
  grade: string;
  note: string;
}

const STEPS_PERIODS = [
  { value: "Etape 1", label: "Étape 1" },
  { value: "Etape 2", label: "Étape 2" },
  { value: "Etape 3", label: "Étape 3" },
  { value: "Etape 4", label: "Étape 4" },
];

const TRIMESTRE_PERIODS = [
  { value: "Trimestre 1", label: "Trimestre 1" },
  { value: "Trimestre 2", label: "Trimestre 2" },
  { value: "Trimestre 3", label: "Trimestre 3" },
];

export default function TeacherGrades() {
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>("Enseignant");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>(STEPS_PERIODS);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [examId, setExamId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentGradeState[]>([]);
  const [maxPoints, setMaxPoints] = useState<number>(10);

  // 1. Initial Load: Teacher details and assignments
  useEffect(() => {
    if (!user?.id || !businessId) return;

    const initializeTeacherData = async () => {
      try {
        setLoading(true);
        // Find teacher record linked to user account
        const { data: teacherData, error: teacherErr } = await supabase
          .from("school_teachers")
          .select("id, first_name, last_name")
          .eq("user_id", user.id)
          .eq("business_id", businessId)
          .maybeSingle();

        if (teacherErr) throw teacherErr;
        if (!teacherData) {
          toast.error("Aucune fiche enseignant reliée à votre compte.");
          return;
        }

        setTeacherId(teacherData.id);
        setTeacherName(`${teacherData.first_name} ${teacherData.last_name}`);

        // Fetch active academic year
        const { data: academicYear } = await supabase
          .from("school_academic_years")
          .select("id, name")
          .eq("business_id", businessId)
          .eq("active", true)
          .maybeSingle();
        
        if (academicYear) {
          setActiveYearId(academicYear.id);
        }

        // Fetch evaluation period configuration
        const { data: config } = await supabase
          .from("school_configurations")
          .select("evaluation_period_type")
          .eq("business_id", businessId)
          .maybeSingle();
        
        if (config?.evaluation_period_type === "trimestres") {
          setPeriods(TRIMESTRE_PERIODS);
        } else {
          setPeriods(STEPS_PERIODS);
        }

        // Fetch assignments for this teacher
        const { data: assignData, error: assignErr } = await supabase
          .from("school_teacher_assignments")
          .select("id, class_id, subject_id, subject:school_subjects(name), class:school_classes(name, section)")
          .eq("teacher_id", teacherData.id)
          .eq("business_id", businessId);

        if (assignErr) throw assignErr;

        const activeAssignments = assignData || [];
        setAssignments(activeAssignments);

        // Extract unique classes
        const uniqueClassesMap = new Map();
        activeAssignments.forEach((a: any) => {
          if (a.class && !uniqueClassesMap.has(a.class_id)) {
            uniqueClassesMap.set(a.class_id, {
              id: a.class_id,
              name: `${a.class.name} ${a.class.section || ""}`.trim()
            });
          }
        });
        setClasses(Array.from(uniqueClassesMap.values()));
      } catch (err: any) {
        console.error("Initialization error:", err);
        toast.error("Erreur lors du chargement des données.");
      } finally {
        setLoading(false);
      }
    };

    initializeTeacherData();
  }, [user?.id, businessId]);

  // 2. Filter subjects when class selection changes
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setSelectedSubject("");
      return;
    }

    const classSubjects = assignments
      .filter((a: any) => a.class_id === selectedClass && a.subject)
      .map((a: any) => ({
        id: a.subject_id,
        name: a.subject.name
      }));
    
    // Deduplicate
    const uniqueSubjects = Array.from(new Map(classSubjects.map(s => [s.id, s])).values());
    setSubjects(uniqueSubjects);
    setSelectedSubject("");
  }, [selectedClass, assignments]);

  // 3. Load students and grades when selection changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !selectedPeriod || !businessId || !activeYearId) {
      setStudents([]);
      setExamId(null);
      setIsLocked(false);
      return;
    }

    const loadGradesData = async () => {
      try {
        setLoading(true);

        // Fetch students enrolled in the class (active)
        const { data: enrollments, error: enrollErr } = await supabase
          .from("school_enrollments")
          .select("student:student_id(id, first_name, last_name)")
          .eq("class_id", selectedClass)
          .eq("business_id", businessId)
          .eq("status", "active");

        if (enrollErr) throw enrollErr;

        const activeStudents = (enrollments || [])
          .filter((e: any) => e.student)
          .map((e: any) => ({
            id: e.student.id,
            name: `${e.student.first_name} ${e.student.last_name}`
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Fetch default coefficient for this subject in this class
        const { data: coefData } = await supabase
          .from("school_class_subject_coefficients")
          .select("coefficient")
          .eq("class_id", selectedClass)
          .eq("subject_id", selectedSubject)
          .maybeSingle();

        const defaultMaxPoints = coefData?.coefficient ? Number(coefData.coefficient) : 10;

        // Fetch existing exam for this configuration
        const { data: examData, error: examErr } = await supabase
          .from("school_exams")
          .select("id, status, max_points")
          .eq("class_id", selectedClass)
          .eq("subject_id", selectedSubject)
          .eq("period_name", selectedPeriod)
          .eq("academic_year_id", activeYearId)
          .eq("business_id", businessId)
          .maybeSingle();

        if (examErr) throw examErr;

        if (examData) {
          setExamId(examData.id);
          setIsLocked(examData.status === "submitted" || examData.status === "validated");
          setMaxPoints(examData.max_points ? Number(examData.max_points) : defaultMaxPoints);

          // Load student grades
          const { data: gradesData, error: gradesErr } = await supabase
            .from("school_grades")
            .select("student_id, points_obtained, note")
            .eq("exam_id", examData.id);

          if (gradesErr) throw gradesErr;

          const gradesMap = new Map(gradesData?.map(g => [g.student_id, g]) || []);
          const studentStates = activeStudents.map(s => {
            const gradeRecord = gradesMap.get(s.id);
            return {
              id: s.id,
              name: s.name,
              grade: gradeRecord ? String(gradeRecord.points_obtained) : "",
              note: gradeRecord?.note || ""
            };
          });
          setStudents(studentStates);
        } else {
          setExamId(null);
          setIsLocked(false);
          setMaxPoints(defaultMaxPoints);
          const studentStates = activeStudents.map(s => ({
            id: s.id,
            name: s.name,
            grade: "",
            note: ""
          }));
          setStudents(studentStates);
        }
      } catch (err: any) {
        console.error("Load grades error:", err);
        toast.error("Erreur lors de la récupération des notes.");
      } finally {
        setLoading(false);
      }
    };

    loadGradesData();
  }, [selectedClass, selectedSubject, selectedPeriod, businessId, activeYearId]);

  const handleGradeChange = (id: string, val: string) => {
    if (isLocked) return;

    if (val !== "") {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > maxPoints) return;
    }

    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, grade: val } : s))
    );
  };

  const handleNoteChange = (id: string, val: string) => {
    if (isLocked) return;
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, note: val } : s))
    );
  };

  // Helper: Save draft exam and grades
  const saveGradesAction = async (): Promise<string | null> => {
    if (!businessId || !activeYearId) return null;
    let currentExamId = examId;

    // 1. Create exam if it doesn't exist
    if (!currentExamId) {
      const selectedClassName = classes.find(c => c.id === selectedClass)?.name || "";
      const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || "";
      
      const { data: newExam, error: examErr } = await supabase
        .from("school_exams")
        .insert({
          business_id: businessId,
          class_id: selectedClass,
          subject_id: selectedSubject,
          period_name: selectedPeriod,
          academic_year_id: activeYearId,
          name: `${selectedSubjectName} - ${selectedPeriod} - ${selectedClassName}`,
          max_points: maxPoints,
          coefficient: maxPoints,
          status: 'draft'
        })
        .select()
        .single();

      if (examErr) throw examErr;
      currentExamId = newExam.id;
      setExamId(newExam.id);
    }

    // 2. Prepare grades payload and upsert
    const upsertPayload = students.map(s => ({
      business_id: businessId,
      exam_id: currentExamId!,
      student_id: s.id,
      points_obtained: parseFloat(s.grade) || 0,
      note: s.note || null
    }));

    const { error: upsertErr } = await supabase
      .from("school_grades")
      .upsert(upsertPayload, { onConflict: "exam_id,student_id" });

    if (upsertErr) throw upsertErr;

    return currentExamId;
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      await saveGradesAction();
      toast.success("Brouillon enregistré avec succès.");
    } catch (err: any) {
      console.error("Save draft error:", err);
      toast.error("Erreur lors de la sauvegarde du brouillon.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm("Attention : Une fois soumises, vous ne pourrez plus modifier ces notes. Voulez-vous continuer ?")) {
      return;
    }

    try {
      setLoading(true);
      
      // Save current entries as draft first
      const currentExamId = await saveGradesAction();
      if (!currentExamId || !user?.id || !businessId) throw new Error("Données d'examen introuvables.");

      // Change status to submitted
      await gradeService.submitExamGrades(currentExamId, user.id);
      setIsLocked(true);
      toast.success("Notes soumises et verrouillées ! La direction a été notifiée.");

      // Trigger notification to director
      const className = classes.find(c => c.id === selectedClass)?.name || "";
      const subjectName = subjects.find(s => s.id === selectedSubject)?.name || "";
      await SchoolNotificationService.notifyGradesSubmitted(businessId, teacherName, subjectName, className);
    } catch (err: any) {
      console.error("Submission error:", err);
      toast.error("Erreur lors de la soumission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="school_teacher" title="Saisie des Notes" subtitle="Évaluation des élèves">
      <StaggerContainer>
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loading || !selectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une matière" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={loading || !selectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir la période" />
              </SelectTrigger>
              <SelectContent>
                {periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center md:justify-start">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Chargement...
              </div>
            )}
          </div>
        </StaggerItem>

        {selectedClass && selectedSubject && selectedPeriod && (
          <StaggerItem>
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Grille de Notes</CardTitle>
                  <CardDescription>Saisissez les notes sur {maxPoints}</CardDescription>
                </div>
                {isLocked && (
                  <div className="flex items-center text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-sm font-medium">
                    <Lock className="w-4 h-4 mr-2" /> Notes Verrouillées
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead className="w-[150px] text-right">Note / {maxPoints}</TableHead>
                        <TableHead className="w-[300px]">Observations / Commentaires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.length === 0 ? (
                        <TableRow>
                          <td colSpan={3} className="text-center py-6 text-muted-foreground">
                            Aucun élève actif trouvé dans cette classe.
                          </td>
                        </TableRow>
                      ) : (
                        students.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>
                              <Input 
                                type="number" 
                                className="text-right font-bold" 
                                value={s.grade}
                                onChange={(e) => handleGradeChange(s.id, e.target.value)}
                                disabled={isLocked || loading}
                                min={0}
                                max={maxPoints}
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className="text-sm"
                                placeholder="Ras, excellent, absent..."
                                value={s.note}
                                onChange={(e) => handleNoteChange(s.id, e.target.value)}
                                disabled={isLocked || loading}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4">
                  {!isLocked && students.length > 0 && (
                    <>
                      <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
                        Enregistrer le brouillon
                      </Button>
                      <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        Soumettre & Verrouiller
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        )}
      </StaggerContainer>
    </DashboardLayout>
  );
}
