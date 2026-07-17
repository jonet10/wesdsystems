import React, { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileSpreadsheet, FileText, Plus, Save, Trash2, Edit2, Download, Printer, Settings, CheckCircle2, 
  ChevronDown, ChevronRight, Calculator, Lock, AlertCircle, RefreshCw, AlertTriangle, PlayCircle, 
  GraduationCap, Award, BookOpen
} from "lucide-react";
import { toast } from "sonner";
import {
  useClasses, useSubjects, useExams, useCreateExam, useDeleteExam, useUpdateExam,
  useExamGrades, useSaveGrades, useClassReportCards, usePalmares
} from "@/hooks/useSchoolData";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { useSchool } from "@/hooks/useSchool";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { DocumentEngineWrapper } from "@/modules/document-engine/ui/components/DocumentEngineWrapper";
import { TemplateRepository } from "@/modules/document-engine/storage/TemplateRepository";
import { supabase } from "@/lib/supabase";
import { PalmaresPrintView } from "./components/PalmaresPrintView";
import { BulkGradesGrid } from "./components/BulkGradesGrid";

// ─── Periods helpers ─────────────────────────────────────────────────────────
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

export default function SchoolGrades() {
  const { settings, activeAcademicYear } = useSchoolSettings();
  const { user, profile } = useAuth();
  const { engine, evaluationPeriodType, bulletinModel, useDocumentEngine } = useSchool();
  const businessId = profile?.business_id;

  const periods = evaluationPeriodType === "trimestres" ? TRIMESTRE_PERIODS : STEPS_PERIODS;

  const [activeTab, setActiveTab] = useState("grades");
  const [localBulletinModel, setLocalBulletinModel] = useState<string>(bulletinModel || 'A');
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  useEffect(() => {
    if (businessId) {
      TemplateRepository.getTemplates(businessId, 'school').then(templates => {
        setCustomTemplates(templates.filter(t => t.type === 'report_card'));
      });
    }
  }, [businessId]);

  useEffect(() => {
    if (bulletinModel) {
      setLocalBulletinModel(bulletinModel);
    }
  }, [bulletinModel]);




  // ── Workflow selection: Period → Class → Subject ──────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0].value);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // Data fetching
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const { data: allSubjects = [] } = useSubjects();

  // Filter subjects by selected class (many-to-many via school_subject_classes)
  const subjectsForClass = useMemo(() => {
    if (!selectedClassId) return allSubjects;
    return allSubjects.filter((s: any) => {
      // Support the many-to-many junction table
      if (s.school_subject_classes && Array.isArray(s.school_subject_classes)) {
        return s.school_subject_classes.some((sc: any) => sc.class_id === selectedClassId);
      }
      // Fallback: direct class_id on subject
      return s.class_id === selectedClassId;
    });
  }, [allSubjects, selectedClassId]);

  // Exams for selected class/year (filtered by period + subject on the frontend)
  const { data: exams = [], isLoading: isLoadingExams, refetch: refetchExams } = useExams(
    selectedClassId,
    activeAcademicYear?.id || ""
  );

  // Find the existing exam for the current period + class + subject
  const matchingExam = useMemo(() => {
    if (!selectedPeriod || !selectedSubjectId) return null;
    return exams.find(
      (e) =>
        e.subject_id === selectedSubjectId &&
        (e as any).period_name === selectedPeriod
    ) || null;
  }, [exams, selectedPeriod, selectedSubjectId]);

  const selectedExamId = matchingExam?.id || "";

  // Grades for the matching exam
  const { data: studentGrades = [], isLoading: isLoadingGrades } = useExamGrades(
    selectedClassId,
    selectedExamId
  );

  // Class Report Cards
  const { data: reportCards = [], isLoading: isLoadingReportCards, refetch: refetchReportCards } =
    useClassReportCards(selectedClassId, activeAcademicYear?.id || "");

  // Mutations
  const createExamMutation = useCreateExam();
  const updateExamMutation = useUpdateExam();
  const deleteExamMutation = useDeleteExam();
  const saveGradesMutation = useSaveGrades();

  // ── New Exam dialog state (auto-prefilled) ────────────────────────────────
  const [isCreateExamDialogOpen, setIsCreateExamDialogOpen] = useState(false);
  const [isEditExamDialogOpen, setIsEditExamDialogOpen] = useState(false);
  const [examName, setExamName] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [coefficient, setCoefficient] = useState("1");
  const [examDate, setExamDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSavingExam, setIsSavingExam] = useState(false);

  // Local grade inputs
  const [gradeInputs, setGradeInputs] = useState<Record<string, { points: string; note: string }>>({});

  // Report Card Dialog
  const [reportCardDialog, setReportCardDialog] = useState<{ open: boolean; student: any }>({ open: false, student: null });

  // Palmares
  const [isPalmaresDialogOpen, setIsPalmaresDialogOpen] = useState(false);
  const { data: palmaresData, isFetching: isFetchingPalmares } = usePalmares(
    selectedClassId, 
    selectedSubjectId, 
    activeAcademicYear?.id || ""
  );

  // ── Default selects ───────────────────────────────────────────────────────
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (subjectsForClass.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjectsForClass[0].id);
    } else if (subjectsForClass.length > 0 && !subjectsForClass.find(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjectsForClass[0].id);
    }
  }, [subjectsForClass, selectedSubjectId]);

  // Reset grade inputs when exam changes
  useEffect(() => {
    setGradeInputs({});
  }, [selectedExamId]);

  const syncAttemptedRef = useRef<Record<string, boolean>>({});

  // Auto-sync missing exams: if current period has no exam, but another period does, auto-create it
  useEffect(() => {
    if (!exams || !selectedSubjectId || !selectedPeriod || !selectedClassId || !activeAcademicYear) return;
    
    // Find all exams for the selected subject
    const subjectExams = exams.filter(e => e.subject_id === selectedSubjectId);
    if (subjectExams.length === 0) return; // No exam exists for this subject at all
    
    // Check if the current period is missing an exam
    const hasCurrentPeriodExam = subjectExams.some(e => (e as any).period_name === selectedPeriod);
    
    const syncKey = `${selectedClassId}_${selectedSubjectId}_${selectedPeriod}`;

    if (!hasCurrentPeriodExam && !isSavingExam && !syncAttemptedRef.current[syncKey]) {
      // Mark as attempted so we don't loop
      syncAttemptedRef.current[syncKey] = true;
      
      // Find a template exam from another period
      const templateExam = subjectExams.find(e => (e as any).period_name === 'Etape 1') || subjectExams[0];
      
      if (templateExam) {
        setIsSavingExam(true);
        const baseName = templateExam.name.includes(' – ') ? templateExam.name.split(' – ')[1] : templateExam.name;
        
        createExamMutation.mutateAsync({
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          academic_year_id: activeAcademicYear.id,
          name: `${selectedPeriod} – ${baseName}`,
          max_points: templateExam.max_points,
          coefficient: templateExam.coefficient,
          exam_date: templateExam.exam_date || format(new Date(), "yyyy-MM-dd"),
          period_name: selectedPeriod,
        } as any).then(() => {
          toast.success(`Évaluation automatiquement synchronisée pour ${selectedPeriod}`);
          return refetchExams();
        }).catch((err) => {
          console.error("Auto-sync error:", err);
        }).finally(() => {
          setIsSavingExam(false);
        });
      }
    }
  }, [selectedPeriod, selectedSubjectId, exams, selectedClassId, activeAcademicYear, isSavingExam]);

  // Pre-fill exam dialog fields based on current selections
  const openCreateExamDialog = () => {
    const selectedSubjectName = allSubjects.find(s => s.id === selectedSubjectId)?.name || "";
    setExamName(`${selectedPeriod} – ${selectedSubjectName}`);
    setMaxPoints("100");
    setCoefficient("1");
    setExamDate(format(new Date(), "yyyy-MM-dd"));
    setIsCreateExamDialogOpen(true);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !selectedSubjectId || !examName.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsSavingExam(true);
    try {
      // Create exams for all periods that don't have one yet for this subject
      const isTrimestre = settings.evaluation_period_type === 'trimester';
      const allPeriods = isTrimestre ? TRIMESTER_PERIODS : STEPS_PERIODS;
      
      const existingPeriods = (exams || [])
        .filter(ex => ex.subject_id === selectedSubjectId)
        .map(ex => (ex as any).period_name);

      const periodsToCreate = allPeriods.filter(p => !existingPeriods.includes(p));
      
      // If the current period is somehow not in the periodsToCreate (shouldn't happen), add it
      if (!existingPeriods.includes(selectedPeriod) && !periodsToCreate.includes(selectedPeriod)) {
        periodsToCreate.push(selectedPeriod);
      }

      const selectedSubjectName = allSubjects.find(s => s.id === selectedSubjectId)?.name || "";
      const baseName = examName.includes(' – ') ? examName.split(' – ')[1] : selectedSubjectName;

      const promises = periodsToCreate.map(period => 
        createExamMutation.mutateAsync({
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          academic_year_id: activeAcademicYear!.id,
          name: `${period} – ${baseName}`,
          max_points: parseFloat(coefficient) || 1,
          coefficient: parseFloat(coefficient) || 1,
          exam_date: examDate,
          period_name: period,
        } as any)
      );

      await Promise.all(promises);

      toast.success("Évaluation créée pour toutes les périodes !");
      setIsCreateExamDialogOpen(false);
      refetchExams();
    } catch (error: any) {
      toast.error("Erreur de création", { description: error.message });
    } finally {
      setIsSavingExam(false);
    }
  };

  const openEditExamDialog = () => {
    if (matchingExam) {
      setExamName(matchingExam.name);
      setCoefficient(String(matchingExam.coefficient));
      setExamDate(matchingExam.exam_date || format(new Date(), "yyyy-MM-dd"));
      setIsEditExamDialogOpen(true);
    }
  };

  const handleEditExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchingExam) return;
    setIsSavingExam(true);
    try {
      await updateExamMutation.mutateAsync({
        id: matchingExam.id,
        payload: {
          name: examName,
          coefficient: parseFloat(coefficient) || 1,
          max_points: parseFloat(coefficient) || 1,
          exam_date: examDate,
        }
      });
      toast.success("Évaluation mise à jour avec succès !");
      setIsEditExamDialogOpen(false);
      refetchExams();
    } catch (error: any) {
      toast.error("Erreur de modification", { description: error.message });
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!matchingExam) return;
    if (!confirm("Voulez-vous supprimer cette évaluation et toutes ses notes ?")) return;
    try {
      await deleteExamMutation.mutateAsync({
        id: matchingExam.id!,
        classId: selectedClassId,
        academicYearId: activeAcademicYear!.id,
      });
      toast.success("Évaluation supprimée.");
      refetchExams();
    } catch {
      toast.error("Erreur de suppression");
    }
  };

  const handleGradeInputChange = (studentId: string, field: "points" | "note", value: string) => {
    setGradeInputs((prev) => ({
      ...prev,
      [studentId]: {
        points: field === "points" ? value : (prev[studentId]?.points ?? ""),
        note: field === "note" ? value : (prev[studentId]?.note ?? ""),
      },
    }));
  };

  const [isProcessingWorkflow, setIsProcessingWorkflow] = useState(false);
  const [submittedExamsList, setSubmittedExamsList] = useState<any[]>([]);
  const [isLoadingSubmittedExams, setIsLoadingSubmittedExams] = useState(false);

  const [viewingExamDetails, setViewingExamDetails] = useState<any | null>(null);
  const [viewingGradesList, setViewingGradesList] = useState<any[]>([]);
  const [isLoadingViewingGrades, setIsLoadingViewingGrades] = useState(false);

  const fetchSubmittedExams = async () => {
    if (!businessId || !activeAcademicYear?.id) return;
    try {
      setIsLoadingSubmittedExams(true);
      const { data, error } = await supabase
        .from("school_exams")
        .select(`
          *,
          class:school_classes(name),
          subject:school_subjects(name)
        `)
        .eq("business_id", businessId)
        .eq("academic_year_id", activeAcademicYear.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setSubmittedExamsList(data || []);
    } catch (err: any) {
      console.error("Error fetching submitted exams:", err);
    } finally {
      setIsLoadingSubmittedExams(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pending_validation") {
      fetchSubmittedExams();
    }
  }, [activeTab, businessId, activeAcademicYear]);

  const handleOpenExamPalmares = async (exam: any) => {
    setViewingExamDetails(exam);
    try {
      setIsLoadingViewingGrades(true);
      
      // 1. Fetch class active students
      const { data: enrollments } = await supabase
        .from("school_enrollments")
        .select("student:student_id(id, first_name, last_name, matricule)")
        .eq("class_id", exam.class_id)
        .eq("status", "active");
      
      const activeStudents = (enrollments || [])
        .filter((e: any) => e.student)
        .map((e: any) => e.student)
        .sort((a: any, b: any) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

      // 2. Fetch grades
      const { data: gradesData } = await supabase
        .from("school_grades")
        .select("student_id, points_obtained, note")
        .eq("exam_id", exam.id);

      const gradesMap = new Map(gradesData?.map(g => [g.student_id, g]) || []);
      const fullGrades = activeStudents.map((s: any) => {
        const gradeRecord = gradesMap.get(s.id);
        return {
          student_id: s.id,
          student_name: `${s.first_name} ${s.last_name}`,
          matricule: s.matricule || "",
          grade: gradeRecord ? gradeRecord.points_obtained : null,
          note: gradeRecord?.note || ""
        };
      });

      setViewingGradesList(fullGrades);
    } catch (err) {
      console.error("Error loading palmares grades:", err);
      toast.error("Erreur lors du chargement des notes.");
    } finally {
      setIsLoadingViewingGrades(false);
    }
  };

  const handleValidateExamInModal = async (examId: string) => {
    if (!user?.id) return;
    try {
      setIsProcessingWorkflow(true);
      await gradeService.validateExamGrades(examId, user.id);
      toast.success("Évaluation validée avec succès.");
      setViewingExamDetails(null);
      fetchSubmittedExams();
      refetchExams();
      refetchReportCards();
    } catch (err: any) {
      toast.error("Erreur de validation : " + err.message);
    } finally {
      setIsProcessingWorkflow(false);
    }
  };

  const handleRejectExamInModal = async (examId: string) => {
    if (!confirm("Voulez-vous vraiment renvoyer cette évaluation à l'enseignant pour correction ?")) return;
    try {
      setIsProcessingWorkflow(true);
      await gradeService.rejectExamGrades(examId);
      toast.success("Évaluation renvoyée au professeur.");
      setViewingExamDetails(null);
      fetchSubmittedExams();
      refetchExams();
      refetchReportCards();
    } catch (err: any) {
      toast.error("Erreur lors du rejet : " + err.message);
    } finally {
      setIsProcessingWorkflow(false);
    }
  };

  const handleValidateExam = async () => {
    if (!matchingExam?.id || !user?.id) return;
    try {
      setIsProcessingWorkflow(true);
      await gradeService.validateExamGrades(matchingExam.id, user.id);
      toast.success("Évaluation validée avec succès.");
      refetchExams();
      refetchReportCards();
    } catch (err: any) {
      toast.error("Erreur lors de la validation : " + err.message);
    } finally {
      setIsProcessingWorkflow(false);
    }
  };

  const handleRejectExam = async () => {
    if (!confirm("Voulez-vous vraiment renvoyer cette évaluation à l'enseignant pour correction ?")) return;
    if (!matchingExam?.id) return;
    try {
      setIsProcessingWorkflow(true);
      await gradeService.rejectExamGrades(matchingExam.id);
      toast.success("Évaluation renvoyée au professeur.");
      refetchExams();
      refetchReportCards();
    } catch (err: any) {
      toast.error("Erreur lors du rejet : " + err.message);
    } finally {
      setIsProcessingWorkflow(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!selectedExamId) return;

    if (matchingExam?.status === 'submitted' || matchingExam?.status === 'validated') {
      toast.error("Ces notes sont verrouillées. Veuillez d'abord déverrouiller/rejeter l'évaluation.");
      return;
    }

    const maxVal = matchingExam?.coefficient || 100;

    const gradesPayload = studentGrades
      .map((sg) => {
        const input = gradeInputs[sg.student_id];
        const pointsStr = input ? input.points : String(sg.points_obtained);
        if (pointsStr === "") return null;
        const points = parseFloat(pointsStr) || 0;
        if (points > maxVal) {
          toast.error(`Note (${points}) dépasse le max autorisé (${maxVal})`);
          throw new Error("Validation failed");
        }
        return {
          student_id: sg.student_id,
          points_obtained: points,
          note: input ? input.note : sg.note,
        };
      })
      .filter(Boolean) as any[];

    try {
      await saveGradesMutation.mutateAsync({
        examId: selectedExamId,
        grades: gradesPayload,
        classId: selectedClassId,
      });
      toast.success("Notes enregistrées avec succès !");
      setGradeInputs({});
      refetchReportCards();
    } catch (error: any) {
      if (error.message !== "Validation failed") {
        toast.error("Erreur d'enregistrement des notes");
      }
    }
  };

  // ── Is everything selected? ───────────────────────────────────────────────
  const isReadyToGrade = !!selectedPeriod && !!selectedClassId && !!selectedSubjectId;

  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name || "";
  const selectedSubjectName = allSubjects.find((s) => s.id === selectedSubjectId)?.name || "";

  // ── Bulletin haïtien : trois modèles (A, B, C) ──────────────────────────
  const renderBulletin = (student: any) => {
    const subjectsList: any[] = student.subjects || [];
    const isGrouped = subjectsList.some((s) => s.domain_name);
    // Determine effective model: B forced when domains exist unless C is chosen
    const effectiveModel: 'A' | 'B' | 'C' | 'CUSTOM' = localBulletinModel === 'CUSTOM' ? 'CUSTOM'
      : localBulletinModel === 'C' ? 'C'
      : (isGrouped || localBulletinModel === 'B') ? 'B'
      : 'A';

    // ── Calculs globaux ──
    let grandTotalCoef = 0;
    let grandTotalNote = 0;
    subjectsList.forEach((s) => {
      if (s.average !== null) {
        grandTotalCoef += Number(s.coef);
        grandTotalNote += Number(s.average);
      }
    });
    const grandAvg = grandTotalCoef > 0
      ? Number(((grandTotalNote / grandTotalCoef) * 10).toFixed(2))
      : null;

    const decision = grandAvg !== null && grandAvg >= 5.0 ? "Admis(e)" : "Ajourné(e)";
    const tardiness = student.tardiness_count ?? 0;

    // ════════════════════════════════════════════════
    // MODÈLE SUR MESURE (CUSTOM - DRAG & DROP)
    // ════════════════════════════════════════════════
    if (effectiveModel === 'CUSTOM') {
      return (
        <div className="font-sans text-sm text-black bg-white w-full max-w-[800px] mx-auto p-[10mm] border border-gray-200 min-h-[1131px] print:border-none print:shadow-none shadow-lg">
          {customTemplate.map(block => {
            const { type, settings } = block;

            if (type === 'header') {
              return (
                <div key={block.id} className={`mb-6`}>
                  <div className="flex items-center justify-between">
                    {settings.showLogo ? (
                      <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs shrink-0 border">
                        LOGO
                      </div>
                    ) : <div className="w-16"></div>}
                    
                    <div className={`flex-1 text-${settings.alignment || 'center'} px-4`}>
                      <div className="font-extrabold text-xl uppercase">{settings?.name || "Établissement Scolaire"}</div>
                      {settings.showAddress && <div className="text-sm">{settings?.address || "Adresse"}</div>}
                      {settings.showPhone && <div className="text-sm">Tél : {settings?.phone || ""}</div>}
                    </div>

                    {settings.showRightLogo ? (
                      <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs shrink-0 border">
                        LOGO 2
                      </div>
                    ) : <div className="w-16"></div>}
                  </div>
                </div>
              );
            }

            if (type === 'studentInfo') {
              return (
                <div key={block.id} className={`flex ${settings.layout === 'row' ? 'flex-row items-center gap-4' : 'flex-col gap-2'} border p-4 border-gray-300 mb-6`}>
                  {settings.showPhoto && <div className="h-24 w-24 bg-gray-200 border text-gray-400 flex items-center justify-center text-xs">[PHOTO]</div>}
                  <div className="flex-1 space-y-1 text-sm">
                    <div><span className="font-semibold">Nom de l'élève :</span> {student.student_name}</div>
                    <div><span className="font-semibold">Classe :</span> {student.className}</div>
                    <div><span className="font-semibold">Année :</span> {activeAcademicYear?.name || ""}</div>
                  </div>
                </div>
              );
            }

            if (type === 'gradesTable') {
              const borderColor = settings.tableBorderColor || '#000000';
              const borderSize = `${settings.tableBorderSize || 1}px`;
              const borderStyle = { borderColor, borderWidth: borderSize };
              const cellStyle = { borderColor, borderWidth: borderSize, borderStyle: 'solid' };

              const renderTable = () => {
                if (settings.tableStyle === 'grouped' || settings.tableStyle === 'haitian_full') {
                  const domainGroups: Record<string, { name: string; display_order: number; subjects: any[] }> = {};
                  subjectsList.forEach((sub) => {
                    const dName = sub.domain_name || "Autres";
                    if (!domainGroups[dName]) {
                      domainGroups[dName] = { name: dName, display_order: sub.display_order ?? 99, subjects: [] };
                    }
                    domainGroups[dName].subjects.push(sub);
                  });
                  const sortedDomains = Object.values(domainGroups).sort((a, b) => a.display_order - b.display_order);
              
                  const getDomainTotals = (subs: any[]) => {
                    let noteSum = 0; let coefSum = 0;
                    subs.forEach((s) => { if (s.average !== null) { noteSum += Number(s.average); coefSum += Number(s.coef); } });
                    const avg = coefSum > 0 ? Number(((noteSum / coefSum) * 10).toFixed(2)) : null;
                    return { noteSum: Number(noteSum.toFixed(1)), coefSum: Number(coefSum.toFixed(0)), avg };
                  };

                  return (
                    <table className="w-full border-collapse text-sm" style={borderStyle}>
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left" style={cellStyle}>Disciplines</th>
                          {settings.showCoef && <th className="p-2 text-center w-24" style={cellStyle}>Coef.</th>}
                          <th className="p-2 text-center w-24" style={cellStyle}>Notes</th>
                          {settings.showAppreciation && <th className="p-2 text-left w-32" style={cellStyle}>Appréciations</th>}
                          {settings.showRank && <th className="p-2 text-center w-20" style={cellStyle}>Rang</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDomains.map((dom) => {
                          const { noteSum, coefSum, avg } = getDomainTotals(dom.subjects);
                          return (
                            <React.Fragment key={`dom-${dom.name}`}>
                              <tr>
                                <td colSpan={5} className="bg-gray-100 font-bold p-1 text-center" style={cellStyle}>{dom.name}</td>
                              </tr>
                              {dom.subjects.map((sub: any) => (
                                <tr key={sub.subject_id}>
                                  <td className="p-2 uppercase text-xs" style={cellStyle}>{sub.subject_name}</td>
                                  {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>{sub.coef}</td>}
                                  <td className="p-2 text-center font-bold" style={cellStyle}>{sub.average !== null ? sub.average : "-"}</td>
                                  {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}></td>}
                                  {settings.showRank && <td className="p-2 text-center" style={cellStyle}></td>}
                                </tr>
                              ))}
                              <tr className="font-bold bg-gray-50">
                                <td className="p-2 text-right text-xs" style={cellStyle}>Total {dom.name}</td>
                                {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>{coefSum}</td>}
                                <td className="p-2 text-center" style={cellStyle}>{noteSum}</td>
                                {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                                {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        
                        {(settings.showTotalRow ?? true) && (
                          <tr className="font-bold bg-gray-100 mt-2">
                            <td className="p-2 text-right" style={cellStyle}>GRAND TOTAL</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>{grandTotalCoef}</td>}
                            <td className="p-2 text-center" style={cellStyle}>{Number(grandTotalNote.toFixed(1))}</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                        )}
                        {(settings.showAverageRow ?? true) && (
                          <tr className="font-bold bg-gray-100">
                            <td className="p-2 text-right" style={cellStyle}>MOYENNE</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center text-lg" style={cellStyle}>{grandAvg ?? "-"}</td>
                            {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>{mention}</td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                        )}
                        {settings.showConductRow && (
                          <tr>
                            <td className="p-2 text-right font-medium" style={cellStyle}>CONDUITE</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center font-bold" style={cellStyle}>{conductGrade} / 10</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                        )}
                        {settings.showAbsenceRow && (
                          <>
                            <tr>
                              <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Absences non justifiées</td>
                              {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                              <td className="p-2 text-center" style={cellStyle}>{absences} j.</td>
                              {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                              {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                            </tr>
                            <tr>
                              <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Absences justifiées</td>
                              {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                              <td className="p-2 text-center" style={cellStyle}>{student.excused_absences_count ?? 0} j.</td>
                              {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                              {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                            </tr>
                            <tr>
                              <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Taux de présence</td>
                              {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                              <td className="p-2 text-center" style={cellStyle}>{student.presence_percentage ?? 100}%</td>
                              {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                              {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                            </tr>
                            <tr>
                              <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Total jours de cours</td>
                              {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                              <td className="p-2 text-center" style={cellStyle}>{student.total_school_days ?? 0} j.</td>
                              {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                              {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                            </tr>
                          </>
                        )}
                        {settings.showTardinessRow && (
                          <tr>
                            <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Retards</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center" style={cellStyle}>{student.tardiness_count ?? 0}</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                        )}
                        {(settings.customRows || []).map((row: any, index: number) => (
                          <tr key={`custom-${index}`}>
                            <td className="p-2 text-right font-medium" style={cellStyle}>{row.label}</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center font-bold" style={cellStyle}>{row.value}</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                }

                // Standard Style
                return (
                  <table className="w-full border-collapse text-sm" style={borderStyle}>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left" style={cellStyle}>Disciplines</th>
                        {settings.showCoef && <th className="p-2 text-center w-24" style={cellStyle}>Coef.</th>}
                        <th className="p-2 text-center w-24" style={cellStyle}>Notes</th>
                        {settings.showAppreciation && <th className="p-2 text-left w-32" style={cellStyle}>Appréciations</th>}
                        {settings.showRank && <th className="p-2 text-center w-20" style={cellStyle}>Rang</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {subjectsList.map((sub: any) => (
                        <tr key={sub.subject_id}>
                          <td className="p-2 uppercase text-xs" style={cellStyle}>{sub.subject_name}</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>{sub.coef}</td>}
                          <td className="p-2 text-center font-bold" style={cellStyle}>{sub.average !== null ? sub.average : "-"}</td>
                          {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}></td>}
                          {settings.showRank && <td className="p-2 text-center" style={cellStyle}></td>}
                        </tr>
                      ))}
                      {(settings.showTotalRow ?? true) && (
                        <tr className="font-bold bg-gray-50">
                          <td className="p-2 text-right" style={cellStyle}>TOTAL</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}>{grandTotalCoef}</td>}
                          <td className="p-2 text-center" style={cellStyle}>{Number(grandTotalNote.toFixed(1))}</td>
                          {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                          {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                        </tr>
                      )}
                      {(settings.showAverageRow ?? true) && (
                        <tr className="font-bold bg-gray-50">
                          <td className="p-2 text-right" style={cellStyle}>MOYENNE</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                          <td className="p-2 text-center text-lg" style={cellStyle}>{grandAvg ?? "-"}</td>
                          {settings.showAppreciation && <td className="p-2 text-sm italic" style={cellStyle}>{mention}</td>}
                          {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                        </tr>
                      )}
                      {settings.showConductRow && (
                        <tr>
                          <td className="p-2 text-right font-medium" style={cellStyle}>CONDUITE</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                          <td className="p-2 text-center font-bold" style={cellStyle}>{conductGrade} / 10</td>
                          {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                          {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                        </tr>
                      )}
                      {settings.showAbsenceRow && (
                        <>
                          <tr>
                            <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Absences non justifiées</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center" style={cellStyle}>{absences} j.</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                          <tr>
                            <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Absences justifiées</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center" style={cellStyle}>{student.excused_absences_count ?? 0} j.</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                          <tr>
                            <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Taux de présence</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center" style={cellStyle}>{student.presence_percentage ?? 100}%</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                          <tr>
                            <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Total jours de cours</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center" style={cellStyle}>{student.total_school_days ?? 0} j.</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
                        </>
                      )}
                      {settings.showTardinessRow && (
                        <tr>
                          <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Retards</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                          <td className="p-2 text-center" style={cellStyle}>{student.tardiness_count ?? 0}</td>
                          {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                          {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                        </tr>
                      )}
                      {(settings.customRows || []).map((row: any, index: number) => (
                        <tr key={`custom-${index}`}>
                          <td className="p-2 text-right font-medium" style={cellStyle}>{row.label}</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                          <td className="p-2 text-center font-bold" style={cellStyle}>{row.value}</td>
                          {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                          {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              };

              if (settings.tableStyle === 'haitian_full') {
                return (
                  <div key={block.id} className="flex w-full mb-6" style={{ border: `${borderSize} solid ${borderColor}` }}>
                    <div className="flex-1 border-r" style={{ borderColor }}>
                      {renderTable()}
                    </div>
                    <div className="w-24 sm:w-32 flex flex-col bg-white">
                      <div className="flex-1 flex items-center justify-center border-b" style={{ borderColor }}>
                        <div className="transform -rotate-90 whitespace-nowrap font-bold text-gray-600 uppercase tracking-widest text-xs">
                          Signatures
                        </div>
                      </div>
                      <div className="h-32 flex items-center justify-center border-b" style={{ borderColor }}>
                        <div className="transform -rotate-90 whitespace-nowrap text-xs">
                          Direction
                        </div>
                      </div>
                      <div className="h-24 flex items-center justify-center border-b" style={{ borderColor }}>
                        <div className="transform -rotate-90 whitespace-nowrap text-xs">
                          Absences : <span className="font-bold">{absences}</span>
                        </div>
                      </div>
                      <div className="h-24 flex items-center justify-center">
                        <div className="transform -rotate-90 whitespace-nowrap text-xs">
                          Retards : <span className="font-bold">{student.tardiness_count ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={block.id} className="mb-6">
                  {renderTable()}
                </div>
              );
            }

            if (type === 'text') {
              return (
                <div key={block.id} style={{ fontSize: `${settings.fontSize || 12}px`, fontWeight: settings.bold ? 'bold' : 'normal', textAlign: settings.alignment || 'left' }} className="whitespace-pre-wrap mb-4">
                  {settings.content || ''}
                </div>
              );
            }

            if (type === 'signatures') {
              return (
                <div key={block.id} className="flex justify-between items-end pt-12 px-8">
                  <div className="text-center">
                    <div className="font-semibold mb-12">{settings.leftLabel || 'Le Directeur'}</div>
                    <div className="border-t border-black w-48"></div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold mb-12">{settings.rightLabel || 'Les Parents'}</div>
                    <div className="border-t border-black w-48"></div>
                  </div>
                </div>
              );
            }

            if (type === 'divider') {
              return <hr key={block.id} style={{ borderTopWidth: `${settings.thickness || 1}px`, borderTopStyle: settings.style || 'solid', borderColor: settings.color || '#000' }} className="my-4" />;
            }

            if (type === 'spacer') {
              return <div key={block.id} style={{ height: `${settings.height || 20}px` }} className="w-full"></div>;
            }

            return null;
          })}
        </div>
      );
    }

    const mention =
      grandAvg === null ? "-"
      : grandAvg >= 8.5 ? "Très Bien"
      : grandAvg >= 7.5 ? "Bien"
      : grandAvg >= 6.5 ? "Assez Bien"
      : grandAvg >= 5.0 ? "Passable"
      : "Insuffisant";

    const conductGrade = student.behavior_grade ?? 10;
    const absences = student.absences_count ?? 0;

    // ════════════════════════════════════════════════
    // MODÈLE C : DOUBLE PAYSAGE (2 bulletins / feuille)
    // ════════════════════════════════════════════════
    if (effectiveModel === 'C') {
      const decision = grandAvg !== null && grandAvg >= 5.0 ? "Admis(e)" : "Ajourné(e)";
      const singleBulletin = (
        <div className="flex-1 border border-gray-300 font-sans text-xs text-black bg-white flex flex-col">
          {/* En-tête structuré */}
          <div className="flex flex-col items-center justify-center p-2 text-center border-b-[3px] border-double border-gray-800 bg-gray-50">
            <h1 className="font-black text-sm uppercase tracking-wider">{settings?.name || "Établissement Scolaire"}</h1>
            {settings?.slogan && <p className="text-[9px] italic mb-0.5">{settings.slogan}</p>}
            <p className="text-[9px]">{settings?.address || ""} {settings?.phone ? `| Tél: ${settings.phone}` : ""}</p>
          </div>

          <div className="px-2 py-1.5 border-b border-gray-400 flex justify-between items-start text-[9px]">
            <div>
              <p><span className="font-bold text-gray-500 uppercase">Élève:</span> <span className="font-black text-xs uppercase">{student.student_name}</span></p>
              <p><span className="font-bold text-gray-500 uppercase">Classe:</span> {student.className}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold text-gray-500 uppercase">Année:</span> {activeAcademicYear?.name || ""}</p>
              <p><span className="font-bold text-gray-500 uppercase">Période:</span> <span className="font-bold text-primary">{selectedPeriod}</span></p>
            </div>
          </div>
          
          <div className="text-center py-1">
            <h2 className="font-black text-[10px] uppercase tracking-widest text-gray-800">Bulletin Scolaire</h2>
          </div>

          {/* Tableau compact */}
          <div className="px-2 flex-1">
            <table className="w-full border-collapse border border-gray-800 text-[9px]">
              <thead>
                <tr className="bg-gray-200 border-b border-gray-800 uppercase">
                  <th className="p-1 text-left border-r border-gray-800 font-black">Disciplines</th>
                  <th className="p-1 text-center border-r border-gray-800 font-black w-10">Coef.</th>
                  <th className="p-1 text-center font-black w-12">Notes</th>
                </tr>
              </thead>
              <tbody>
                {subjectsList.map((sub, idx) => (
                  <tr key={sub.subject_id} className={`border-b border-gray-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="p-1 border-r border-gray-800 font-medium">{sub.subject_name}</td>
                    <td className="p-1 border-r border-gray-800 text-center font-semibold text-gray-600">{sub.coef}</td>
                    <td className="p-1 text-center font-bold">{sub.average !== null ? sub.average : "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-[3px] border-gray-800">
                <tr className="bg-gray-100 font-bold text-[10px]">
                  <td className="p-1 text-right border-r border-gray-800 uppercase">Grand Total</td>
                  <td className="p-1 text-center border-r border-gray-800">{grandTotalCoef}</td>
                  <td className="p-1 text-center">{Number(grandTotalNote.toFixed(1))}</td>
                </tr>
                <tr className="bg-gray-200 font-black text-[11px]">
                  <td className="p-1 text-right border-r border-gray-800 uppercase">Moyenne Générale</td>
                  <td className="p-1 text-center border-r border-gray-800 text-[8px] font-bold text-gray-500">/ 10</td>
                  <td className="p-1 text-center">{grandAvg ?? "-"}</td>
                </tr>
              </tfoot>
            </table>

            {/* Section Résultats */}
            <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
              <div className="border border-gray-800 p-1.5 space-y-0.5 bg-gray-50 rounded-sm">
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Mention:</span> <span className="font-bold">{mention}</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Conduite:</span> <span className="font-bold">{conductGrade}/10</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Décision:</span> <span className="font-black text-primary uppercase">{decision}</span></p>
              </div>
              <div className="border border-gray-800 p-1.5 space-y-0.5 bg-white rounded-sm text-[8px] leading-tight">
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Abs. Non Justifiées:</span> <span className="font-bold">{absences} j.</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Abs. Justifiées:</span> <span className="font-bold">{student.excused_absences_count ?? 0} j.</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Retards:</span> <span className="font-bold">{student.tardiness_count ?? 0}</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Présence:</span> <span className="font-bold">{student.presence_percentage ?? 100}%</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Jours de Classe:</span> <span className="font-bold">{student.total_school_days ?? 0} j.</span></p>
              </div>
            </div>

            {/* Signature compacte */}
            <div className="mt-3 mb-2 flex justify-between px-2 text-[9px]">
              <div className="text-center">
                <p className="font-bold mb-6 text-gray-600">Direction</p>
                <div className="border-t border-gray-800 w-16 mx-auto"></div>
              </div>
              <div className="text-center">
                <p className="font-bold mb-6 text-gray-600">Titulaire</p>
                <div className="border-t border-gray-800 w-16 mx-auto"></div>
              </div>
              <div className="text-center">
                <p className="font-bold mb-6 text-gray-600">Parents</p>
                <div className="border-t border-gray-800 w-16 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      );
      return (
        <div>
          {/* CSS impression paysage */}
          <style>{`@media print { @page { size: landscape; margin: 8mm; } }`}</style>
          <div className="flex gap-4">
            {singleBulletin}
            <div className="w-px bg-gray-400 border-l border-dashed border-gray-400 mx-1 print:border-gray-300" />
            {singleBulletin}
          </div>
          <p className="text-center text-xs text-gray-400 mt-2 print:hidden">← Trait de coupe au milieu →</p>
        </div>
      );
    }

    // ════════════════════════════════════════════════
    // MODÈLE A : PLAT (Portrait Simple - 5.5 x 8.5)
    // ════════════════════════════════════════════════
    if (effectiveModel === 'A') {
      const decision = grandAvg !== null && grandAvg >= 5.0 ? "Admis(e)" : "Ajourné(e)";
      return (
        <div className="font-sans text-xs text-black bg-white mx-auto border border-gray-300 print:border-none">
          <style>{`@media print { @page { size: 5.5in 8.5in; margin: 0.2in; } }`}</style>
          
          {/* HEADER */}
          <div className="flex flex-col items-center justify-center p-4 text-center border-b-[3px] border-double border-gray-800 bg-gray-50">
            <h1 className="font-black text-lg uppercase tracking-wider">{settings?.name || "Établissement Scolaire"}</h1>
            {settings?.slogan && <p className="text-[10px] italic mb-1">{settings.slogan}</p>}
            <p className="text-[10px]">{settings?.address || ""} {settings?.phone ? `| Tél: ${settings.phone}` : ""}</p>
          </div>

          <div className="px-4 py-3 border-b border-gray-400 flex justify-between items-start">
            <div className="space-y-1">
              <p><span className="font-bold text-gray-500 uppercase">Élève:</span> <span className="font-black text-sm uppercase">{student.student_name}</span></p>
              <p><span className="font-bold text-gray-500 uppercase">Classe:</span> {student.className}</p>
            </div>
            <div className="space-y-1 text-right">
              <p><span className="font-bold text-gray-500 uppercase">Année:</span> {activeAcademicYear?.name || ""}</p>
              <p><span className="font-bold text-gray-500 uppercase">Période:</span> <span className="font-bold text-primary">{selectedPeriod}</span></p>
            </div>
          </div>

          <div className="text-center py-2 bg-white">
            <h2 className="font-black text-sm uppercase tracking-widest text-gray-800">Bulletin Scolaire</h2>
          </div>

          {/* CORPS DU BULLETIN */}
          <div className="px-4 pb-4">
            <table className="w-full border-collapse border border-gray-800 text-[11px]">
              <thead>
                <tr className="bg-gray-200 border-b border-gray-800 uppercase">
                  <th className="p-1.5 text-left border-r border-gray-800 font-black w-1/2">Disciplines</th>
                  <th className="p-1.5 text-center border-r border-gray-800 font-black w-16">Coef.</th>
                  <th className="p-1.5 text-center font-black w-20">Note</th>
                </tr>
              </thead>
              <tbody>
                {subjectsList.map((sub, idx) => (
                  <tr key={sub.subject_id} className={`border-b border-gray-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="p-1.5 border-r border-gray-800 font-medium">{sub.subject_name}</td>
                    <td className="p-1.5 border-r border-gray-800 text-center font-semibold text-gray-600">{sub.coef}</td>
                    <td className="p-1.5 text-center font-bold">{sub.average !== null ? sub.average : "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-[3px] border-gray-800">
                <tr className="bg-gray-100 font-bold">
                  <td className="p-2 text-right border-r border-gray-800 uppercase text-[10px]">Grand Total</td>
                  <td className="p-2 text-center border-r border-gray-800">{grandTotalCoef}</td>
                  <td className="p-2 text-center">{Number(grandTotalNote.toFixed(1))}</td>
                </tr>
                <tr className="bg-gray-200 font-black text-[13px]">
                  <td className="p-2 text-right border-r border-gray-800 uppercase">Moyenne Générale</td>
                  <td className="p-2 text-center border-r border-gray-800 text-[9px] font-bold text-gray-500">SUR 10</td>
                  <td className="p-2 text-center">{grandAvg ?? "-"}</td>
                </tr>
              </tfoot>
            </table>

            {/* SECTION RÉSULTATS & OBSERVATIONS */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
              <div className="border border-gray-800 p-2 space-y-1 bg-gray-50 rounded-sm">
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Mention:</span> <span className="font-bold">{mention}</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Conduite:</span> <span className="font-bold">{conductGrade} / 10</span></p>
                <div className="border-t border-gray-300 my-1 pt-1 flex justify-between">
                  <span className="font-semibold text-gray-600">Décision:</span> <span className="font-black text-primary uppercase">{decision}</span>
                </div>
              </div>
              <div className="border border-gray-800 p-2 space-y-1 bg-white rounded-sm text-[10px]">
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Abs. Non Justifiées:</span> <span className="font-bold">{absences} j.</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Abs. Justifiées:</span> <span className="font-bold">{student.excused_absences_count ?? 0} j.</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Retards:</span> <span className="font-bold">{student.tardiness_count ?? 0}</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Présence:</span> <span className="font-bold">{student.presence_percentage ?? 100}%</span></p>
                <p className="flex justify-between"><span className="font-semibold text-gray-600">Jours de Classe:</span> <span className="font-bold">{student.total_school_days ?? 0} j.</span></p>
              </div>
            </div>

            <div className="mt-6 flex justify-between px-2 text-[10px]">
              <div className="text-center">
                <p className="font-bold mb-8 text-gray-600">La Direction</p>
                <div className="border-t border-gray-800 w-20 mx-auto"></div>
              </div>
              <div className="text-center">
                <p className="font-bold mb-8 text-gray-600">Le Titulaire</p>
                <div className="border-t border-gray-800 w-20 mx-auto"></div>
              </div>
              <div className="text-center">
                <p className="font-bold mb-8 text-gray-600">Les Parents</p>
                <div className="border-t border-gray-800 w-20 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ════════════════════════════════════════════════
    // MODÈLE B : GROUPÉ (Portrait Groupé par Domaines - 5.5 x 8.5)
    // ════════════════════════════════════════════════
    if (effectiveModel === 'B') {
        const domainGroups: Record<string, { name: string; display_order: number; subjects: any[] }> = {};
        subjectsList.forEach((sub) => {
          const dName = sub.domain_name || "Autres";
          if (!domainGroups[dName]) {
            domainGroups[dName] = { name: dName, display_order: sub.display_order ?? 99, subjects: [] };
          }
          domainGroups[dName].subjects.push(sub);
        });
        const sortedDomains = Object.values(domainGroups).sort((a, b) => a.display_order - b.display_order);

        const getDomainTotals = (subs: any[]) => {
          let noteSum = 0; let coefSum = 0;
          subs.forEach((s) => { if (s.average !== null) { noteSum += Number(s.average); coefSum += Number(s.coef); } });
          const avg = coefSum > 0 ? Number(((noteSum / coefSum) * 10).toFixed(2)) : null;
          return { noteSum: Number(noteSum.toFixed(1)), coefSum: Number(coefSum.toFixed(0)), avg };
        };

        const decision = grandAvg !== null && grandAvg >= 5.0 ? "Admis(e)" : "Ajourné(e)";

        return (
          <div className="font-sans text-[11px] text-black bg-white mx-auto border border-gray-300 print:border-none p-4 max-w-[21cm]">
            <style>{`@media print { @page { size: A4 portrait; margin: 0.5cm; } }`}</style>
            
            {/* HEADER */}
            <div className="flex justify-between items-center mb-2">
              <div className="w-16 h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                <span className="text-gray-400 text-[8px] uppercase">Logo G.</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <h1 className="font-black text-lg text-primary tracking-wide">{settings?.name || "Établissement Scolaire"}</h1>
                <p className="text-[10px] text-gray-600">{settings?.address || ""} | Tél: {settings?.phone || ""}</p>
                <div className="mt-2 font-bold text-sm">
                  Année académique: {activeAcademicYear?.name || ""}
                </div>
                <div className="font-black text-md">Bulletin Scolaire</div>
              </div>
              <div className="w-16 h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                <span className="text-gray-400 text-[8px] uppercase">Logo D.</span>
              </div>
            </div>

            <div className="mb-2 flex justify-between items-center text-[11px] font-bold">
              <div>Nom et Prénom : <span className="text-[13px] ml-1">{student.student_name}</span></div>
              <div>Classe : <span className="ml-1">{student.className}</span></div>
            </div>

            {/* CORPS DU BULLETIN */}
            <table className="w-full border-collapse border border-gray-800 text-[11px]">
              <thead>
                <tr className="border-b-[2px] border-gray-800">
                  <th colSpan={2} className="p-1.5 text-center border-r border-gray-800 font-black text-[12px]">Matières</th>
                  <th className="p-1.5 text-center border-r border-gray-800 font-black w-24 text-[12px]">Coefficient</th>
                  <th className="p-1.5 text-center font-black w-24 text-[12px]">
                    <div className="border-b border-gray-800 pb-0.5 mb-0.5">{selectedPeriod}</div>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDomains.map((dom) => {
                  const { noteSum, coefSum, avg } = getDomainTotals(dom.subjects);
                  return (
                    <React.Fragment key={dom.name}>
                      {/* SUBJECTS */}
                      {dom.subjects.map((sub: any, idx: number) => (
                        <tr key={sub.subject_id} className="border-b border-gray-800">
                          {idx === 0 && (
                            <td 
                              rowSpan={dom.subjects.length + 2} 
                              className="p-1 px-2 border-r border-gray-800 font-bold italic w-28 bg-white align-middle text-left"
                            >
                              {dom.name}
                            </td>
                          )}
                          <td className="p-1 px-2 border-r border-gray-800 font-medium">{sub.subject_name}</td>
                          <td className="p-1 border-r border-gray-800 text-center">{sub.coef}</td>
                          <td className="p-1 text-center">{sub.average !== null ? sub.average : "-"}</td>
                        </tr>
                      ))}
                      {/* DOMAIN TOTALS */}
                      <tr className="border-b border-gray-800 font-bold bg-white">
                        <td className="p-1 px-2 border-r border-gray-800">Total</td>
                        <td className="p-1 text-center border-r border-gray-800">{coefSum}</td>
                        <td className="p-1 text-center">{noteSum}</td>
                      </tr>
                      {/* DOMAIN MOYENNE */}
                      <tr className="border-b-[2px] border-gray-800 font-bold bg-gray-50">
                        <td className="p-1 px-2 border-r border-gray-800 text-gray-700">Moyenne</td>
                        <td className="p-1 text-center border-r border-gray-800 text-gray-600">10</td>
                        <td className="p-1 text-center">{avg !== null ? avg : "-"}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t-[3px] border-gray-800 font-bold">
                <tr className="border-b border-gray-800">
                  <td colSpan={2} className="p-1.5 px-2 border-r border-gray-800">Grand Total</td>
                  <td className="p-1.5 text-center border-r border-gray-800">{grandTotalCoef}</td>
                  <td className="p-1.5 text-center">{Number(grandTotalNote.toFixed(1))}</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td colSpan={2} className="p-1.5 px-2 border-r border-gray-800">Moyenne</td>
                  <td className="p-1.5 text-center border-r border-gray-800">10</td>
                  <td className="p-1.5 text-center">{grandAvg ?? "-"}</td>
                </tr>
                <tr className="border-b border-gray-800 bg-gray-50">
                  <td colSpan={2} className="p-1.5 px-2 border-r border-gray-800">Mention</td>
                  <td colSpan={2} className="p-1.5 text-center uppercase tracking-wider">{mention}</td>
                </tr>
                {['Etape 4', 'Trimestre 3'].includes(selectedPeriod) && (
                  <>
                    <tr className="border-b border-gray-800 bg-gray-100">
                      <td colSpan={2} className="p-1.5 px-2 border-r border-gray-800 text-[12px]">Moyenne Générale</td>
                      <td className="p-1.5 text-center border-r border-gray-800">10</td>
                      <td className="p-1.5 text-center text-[12px]">{grandAvg ?? "-"}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="p-1.5 px-2 border-r border-gray-800">Décision de fin d'année</td>
                      <td colSpan={2} className="p-1.5 text-center uppercase">{decision}</td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>

            {/* OBSERVATIONS */}
            <div className="mt-4 border-[2px] border-gray-800 bg-white">
              <div className="bg-gray-100 p-1 px-2 border-b border-gray-800 font-bold uppercase text-left text-[10px]">
                Assiduité & Discipline
              </div>
              <div className="p-2 grid grid-cols-5 gap-2 text-center text-[10px] font-medium">
                <div><span className="font-semibold block">Abs. Non Justifiées</span> {absences} j.</div>
                <div><span className="font-semibold block">Abs. Justifiées</span> {student.excused_absences_count ?? 0} j.</div>
                <div><span className="font-semibold block">Retards</span> {student.tardiness_count ?? 0}</div>
                <div><span className="font-semibold block">Taux Présence</span> {student.presence_percentage ?? 100}%</div>
                <div><span className="font-semibold block">Jours de Classe</span> {student.total_school_days ?? 0} j.</div>
              </div>
            </div>

            {/* SIGNATURES */}
            <div className="mt-6 text-center font-bold text-[12px]">Signatures</div>
            <div className="mt-4 mb-4 flex justify-between px-4 text-[11px]">
              <div className="flex items-end gap-2">
                <span className="font-bold">La Direction :</span>
                <div className="border-b border-gray-800 w-32"></div>
              </div>
              <div className="flex items-end gap-2">
                <span className="font-bold">Responsable :</span>
                <div className="border-b border-gray-800 w-40"></div>
              </div>
            </div>
          </div>
        );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="print:hidden">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Carnet de Notes &amp; {engine.terminology.get("reportCards")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enregistrez les notes par période, classe et matière — conformément au système scolaire haïtien
          </p>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent print:hidden">
            <TabsTrigger
              value="grades"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Saisie Classique
            </TabsTrigger>
            <TabsTrigger
              value="bulk"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Saisie Groupée (Excel)
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
              onClick={() => refetchReportCards()}
            >
              <GraduationCap className="h-4 w-4 mr-2" /> {engine.terminology.get("reportCards")} &amp; Classements
            </TabsTrigger>
            <TabsTrigger
              value="pending_validation"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Palmarès à Valider
            </TabsTrigger>
          </TabsList>

          {/* ══════════════ TAB 1: SAISIE DES NOTES ══════════════ */}
          <TabsContent value="grades" className="space-y-4">

            {/* ── Filters: Period → Class → Subject ── */}
            <Card className="p-4 bg-muted/30">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-3 font-medium">
                <span className="text-xs uppercase tracking-wider">Workflow</span>
                <ChevronRight className="h-3 w-3" />
                <span className={selectedPeriod ? "text-primary font-semibold" : ""}>Période</span>
                <ChevronRight className="h-3 w-3" />
                <span className={selectedClassId ? "text-primary font-semibold" : ""}>
                  {engine.terminology.get("class")}
                </span>
                <ChevronRight className="h-3 w-3" />
                <span className={selectedSubjectId ? "text-primary font-semibold" : ""}>
                  {engine.terminology.get("subject")}
                </span>
                <ChevronRight className="h-3 w-3" />
                <span className={isReadyToGrade ? "text-green-500 font-semibold" : ""}>Carnet de notes</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Period */}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                    1. Période d'évaluation
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {periods.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setSelectedPeriod(p.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          selectedPeriod === p.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Class */}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                    2. {engine.terminology.get("class")}
                  </Label>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {isLoadingClasses ? (
                      <p className="text-xs text-muted-foreground">Chargement...</p>
                    ) : (
                      classes.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClassId(c.id);
                            setSelectedSubjectId("");
                          }}
                          className={`w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                            selectedClassId === c.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                    3. {engine.terminology.get("subject")}
                  </Label>
                  {!selectedClassId ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Choisissez d'abord une classe
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {subjectsForClass.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          Aucune matière assignée à cette classe
                        </p>
                      ) : (
                        subjectsForClass.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSubjectId(s.id)}
                            className={`w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                              selectedSubjectId === s.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input bg-background text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {s.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ── Grade Sheet ── */}
            {!isReadyToGrade ? (
              <Card className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <BookOpen className="h-8 w-8 opacity-40" />
                <p className="font-medium">Sélectionnez une période, une classe et une matière</p>
                <p className="text-xs">Le carnet de notes s'ouvrira automatiquement.</p>
              </Card>
            ) : isLoadingExams ? (
              <Card className="p-8 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Recherche de l'évaluation...</p>
              </Card>
            ) : !matchingExam ? (
              /* ── No exam yet: propose to create ── */
              <Card className="border-dashed border-2 border-amber-500/40 bg-amber-500/5 p-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <AlertCircle className="h-8 w-8 text-amber-500" />
                  </div>
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">Aucune évaluation trouvée pour :</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-semibold text-primary">{selectedPeriod}</span>
                    {" · "}
                    <span className="font-semibold">{selectedClassName}</span>
                    {" · "}
                    <span className="font-semibold">{selectedSubjectName}</span>
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button onClick={openCreateExamDialog}>
                    <Plus className="h-4 w-4 mr-2" /> Créer maintenant
                  </Button>
                </div>
              </Card>
            ) : (
              /* ── Exam found: show grade sheet ── */
              <Card>
                <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/10">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{matchingExam.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedPeriod} · {selectedClassName} · {selectedSubjectName}
                        {" · "}Coef. {matchingExam.coefficient}
                        {" · "}Date : {matchingExam.exam_date ? new Date(matchingExam.exam_date).toLocaleDateString("fr-FR") : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {matchingExam.status === 'submitted' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                            Soumis (Attente de validation)
                          </span>
                        )}
                        {matchingExam.status === 'validated' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-500/10 px-2 py-0.5 rounded">
                            Validé par la direction
                          </span>
                        )}
                        {(matchingExam.status === 'draft' || !matchingExam.status) && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded">
                            Brouillon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Saisie / {matchingExam.coefficient} pts
                    </span>
                    {matchingExam.status === 'submitted' && (
                      <>
                        <Button variant="outline" size="sm" className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200" onClick={handleValidateExam} disabled={isProcessingWorkflow}>
                          Valider
                        </Button>
                        <Button variant="outline" size="sm" className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200" onClick={handleRejectExam} disabled={isProcessingWorkflow}>
                          Renvoyer
                        </Button>
                      </>
                    )}
                    {matchingExam.status === 'validated' && (
                      <Button variant="outline" size="sm" className="text-amber-700 hover:bg-amber-50 border-amber-200" onClick={handleRejectExam} disabled={isProcessingWorkflow}>
                        Déverrouiller
                      </Button>
                    )}
                    {(!matchingExam.status || matchingExam.status === 'draft') && (
                      <>
                        <Button variant="ghost" size="icon" className="text-primary" onClick={openEditExamDialog} title="Modifier l'évaluation">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDeleteExam} title="Supprimer l'évaluation">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">N°</TableHead>
                        <TableHead>{engine.terminology.get("student")}</TableHead>
                        <TableHead className="w-48 text-right">
                          Note / {matchingExam.coefficient}
                        </TableHead>
                        <TableHead>Remarques</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingGrades ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Chargement des élèves...
                          </TableCell>
                        </TableRow>
                      ) : studentGrades.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Aucun élève trouvé dans cette classe.
                          </TableCell>
                        </TableRow>
                      ) : (
                        studentGrades.map((sg, index) => {
                          const local = gradeInputs[sg.student_id];
                          const pointsVal = local
                            ? local.points
                            : sg.points_obtained === ""
                            ? ""
                            : String(sg.points_obtained);
                          const noteVal = local ? local.note : sg.note;
                          const isReadOnly = matchingExam.status === 'submitted' || matchingExam.status === 'validated';
                           return (
                            <TableRow key={sg.student_id}>
                              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="font-medium">{sg.student_name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={matchingExam.coefficient}
                                  placeholder="Note"
                                  value={pointsVal}
                                  onChange={(e) =>
                                    handleGradeInputChange(sg.student_id, "points", e.target.value)
                                  }
                                  disabled={isReadOnly}
                                  className="h-8 w-32 ml-auto text-right font-semibold"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  placeholder="Remarque..."
                                  value={noteVal}
                                  onChange={(e) =>
                                    handleGradeInputChange(sg.student_id, "note", e.target.value)
                                  }
                                  disabled={isReadOnly}
                                  className="h-8"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>

                <div className="p-4 border-t flex justify-end gap-3">
                  <Button variant="outline" size="lg" onClick={() => setIsPalmaresDialogOpen(true)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Télécharger Palmarès
                  </Button>
                  {!(matchingExam.status === 'submitted' || matchingExam.status === 'validated') && (
                    <Button size="lg" onClick={handleSaveGrades} disabled={saveGradesMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {saveGradesMutation.isPending ? "Enregistrement..." : "Enregistrer les notes"}
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ══════════════ TAB 2: BULLETINS & CLASSEMENTS ══════════════ */}
          <TabsContent value="bulk" className="space-y-4">
            <Card className="p-4 bg-muted/30 print:hidden">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1.5 min-w-[200px]">
                  <Label>Classe</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 min-w-[200px]">
                  <Label>Période d'évaluation</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    {periods.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
            {businessId && activeAcademicYear?.id && selectedClassId && selectedPeriod && (
              <BulkGradesGrid 
                businessId={businessId} 
                academicYearId={activeAcademicYear.id} 
                classId={selectedClassId} 
                periodName={selectedPeriod} 
              />
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1.5 min-w-[200px]">
                  <Label>{engine.terminology.get("class")}</Label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 min-w-[200px]">
                  <Label>Modèle de bulletin</Label>
                  <select
                    value={localBulletinModel}
                    onChange={(e) => setLocalBulletinModel(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="A">Modèle A (Portrait Simple)</option>
                    <option value="B">Modèle B (Portrait Groupé)</option>
                    <option value="C">Modèle C (Double Paysage)</option>
                    <option value="CUSTOM">Modèle Personnalisé (Constructeur)</option>
                    {customTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (Modèle Importé)</option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => refetchReportCards()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Générer le classement
                </Button>
              </div>
            </Card>

            {isLoadingReportCards ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                Analyse des moyennes...
              </div>
            ) : reportCards.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Award className="h-8 w-8 opacity-45" />
                <p>Aucune note enregistrée pour cette classe.</p>
                <p className="text-xs">Saisissez d'abord des notes dans le premier onglet.</p>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Classement Général de la Classe</CardTitle>
                  <CardDescription>
                    Moyennes calculées sur un barème de 10 points.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-center">Rang</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>{engine.terminology.get("student")}</TableHead>
                        <TableHead className="text-center">Sexe</TableHead>
                        <TableHead className="text-right font-bold text-primary">
                          Moy. Générale (/10)
                        </TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportCards.map((card) => (
                        <TableRow
                          key={card.student_id}
                          className={card.rank === 1 ? "bg-amber-500/5" : undefined}
                        >
                          <TableCell className="text-center font-bold">
                            {card.rank} {card.rank === 1 ? "🏆" : ""}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {card.matricule}
                          </TableCell>
                          <TableCell className="font-semibold">{card.student_name}</TableCell>
                          <TableCell className="text-center">{card.gender}</TableCell>
                          <TableCell className="text-right font-bold text-primary text-base">
                            {card.overallAverage !== null
                              ? `${card.overallAverage} / 10`
                              : "Pas de note"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setReportCardDialog({ open: true, student: card })
                              }
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />{" "}
                              {engine.terminology.get("reportCard")} PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══════════════ TAB 4: PALMARÈS À VALIDER ══════════════ */}
          <TabsContent value="pending_validation" className="space-y-4">
            {isLoadingSubmittedExams ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                Chargement des évaluations soumises...
              </div>
            ) : submittedExamsList.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
                <p className="font-semibold text-lg text-foreground">Tout est en ordre !</p>
                <p>Aucune évaluation n'est actuellement en attente de validation.</p>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Évaluations en attente de validation</CardTitle>
                  <CardDescription>
                    Vérifiez les notes saisies par les enseignants avant de les valider officiellement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Classe</TableHead>
                        <TableHead>Matière</TableHead>
                        <TableHead>Nom de l'Évaluation</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead className="text-center">Barème</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submittedExamsList.map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-semibold">{exam.class?.name || "—"}</TableCell>
                          <TableCell>{exam.subject?.name || "—"}</TableCell>
                          <TableCell>{exam.name}</TableCell>
                          <TableCell className="font-medium text-primary">{exam.period_name}</TableCell>
                          <TableCell className="text-center font-bold">{exam.max_points} pts</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                              onClick={() => handleOpenExamPalmares(exam)}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Voir le Palmarès
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>


        {/* ══════════════ DIALOG: Palmarès Soumis – Consultation & Validation ══════════════ */}
        <Dialog open={!!viewingExamDetails} onOpenChange={(open) => { if (!open) setViewingExamDetails(null); }}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Palmarès — {viewingExamDetails?.name}
              </DialogTitle>
              {viewingExamDetails && (
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded-md font-medium">Classe : {viewingExamDetails.class?.name}</span>
                  <span className="bg-muted px-2 py-0.5 rounded-md font-medium">Matière : {viewingExamDetails.subject?.name}</span>
                  <span className="bg-muted px-2 py-0.5 rounded-md font-medium">Période : {viewingExamDetails.period_name}</span>
                  <span className="bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-md font-bold">/ {viewingExamDetails.max_points} pts</span>
                </div>
              )}
            </DialogHeader>

            {/* Table des notes */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingViewingGrades ? (
                <div className="text-center py-16 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                  Chargement des notes...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead className="text-center font-bold">Note obtenue</TableHead>
                      <TableHead className="text-center">Sur</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead>Appréciation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingGradesList.map((g, idx) => {
                      const pct = viewingExamDetails?.max_points && g.grade !== null
                        ? Math.round((g.grade / viewingExamDetails.max_points) * 100)
                        : null;
                      const badgeColor = pct === null ? "text-muted-foreground" : pct >= 70 ? "text-green-600 bg-green-50" : pct >= 50 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
                      return (
                        <TableRow key={g.student_id} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-semibold">{g.student_name}</TableCell>
                          <TableCell className="text-center">
                            {g.grade !== null ? (
                              <span className={`font-bold text-base px-2 py-0.5 rounded ${badgeColor}`}>{g.grade}</span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">Absent / Non noté</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{viewingExamDetails?.max_points}</TableCell>
                          <TableCell className="text-center">
                            {pct !== null ? <span className={`text-sm font-medium ${badgeColor} px-1.5 py-0.5 rounded`}>{pct}%</span> : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground italic">{g.note || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Footer – boutons de validation */}
            <div className="border-t pt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{viewingGradesList.filter(g => g.grade !== null).length}</span> élèves notés sur {viewingGradesList.length}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                  disabled={isProcessingWorkflow}
                  onClick={() => viewingExamDetails && handleRejectExamInModal(viewingExamDetails.id)}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Renvoyer à l'enseignant
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isProcessingWorkflow}
                  onClick={() => viewingExamDetails && handleValidateExamInModal(viewingExamDetails.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isProcessingWorkflow ? "Validation..." : "Valider officiellement"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ══════════════ DIALOG: Modifier Évaluation ══════════════ */}
        <Dialog open={isEditExamDialogOpen} onOpenChange={setIsEditExamDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier l'évaluation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditExam} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nom de l'évaluation</Label>
                <Input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Ex: Étape 1 – Anglais"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Coefficient (Sur combien ?)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={coefficient}
                  onChange={(e) => setCoefficient(e.target.value)}
                  placeholder="Ex: 200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date de l'évaluation</Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setIsEditExamDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSavingExam}>
                  {isSavingExam ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ══════════════ DIALOG: Créer Évaluation ══════════════ */}
        <Dialog open={isCreateExamDialogOpen} onOpenChange={setIsCreateExamDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Créer une évaluation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateExam} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nom de l'évaluation</Label>
                <Input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Ex: Étape 1 – Anglais"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Coefficient (Sur combien ?)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={coefficient}
                  onChange={(e) => setCoefficient(e.target.value)}
                  placeholder="Ex: 200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date de l'évaluation</Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setIsCreateExamDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSavingExam}>
                  {isSavingExam ? "Création..." : "Créer l'évaluation"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ══════════════ DIALOG: Bulletin ══════════════ */}
        <Dialog
          open={reportCardDialog.open}
          onOpenChange={(open) => setReportCardDialog((p) => ({ ...p, open }))}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-zinc-300">
            <DialogHeader className="sr-only">
              <DialogTitle>Bulletin de notes</DialogTitle>
            </DialogHeader>
            {(() => {
              if (!reportCardDialog.student) return null;
              const student = reportCardDialog.student;
              return (
                <div className="space-y-4">
                  <div id="student-bulletin-printable">
                    {useDocumentEngine && !['A', 'B', 'C'].includes(localBulletinModel) ? (
                      <DocumentEngineWrapper 
                        moduleName="school" 
                        contextId={student.id} 
                        templateId={localBulletinModel !== 'CUSTOM' ? localBulletinModel : undefined}
                        fallback={renderBulletin(student)} 
                      />
                    ) : (
                      renderBulletin(student)
                    )}
                  </div>

                  <div className="flex justify-end gap-3 font-sans">
                    <Button
                      variant="outline"
                      onClick={() => setReportCardDialog({ open: false, student: null })}
                    >
                      Fermer
                    </Button>
                    <Button onClick={() => window.print()}>
                      <Printer className="h-4 w-4 mr-2" /> Imprimer le{" "}
                      {engine.terminology.get("reportCard").toLowerCase()}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ══════════════ DIALOG: Palmarès ══════════════ */}
        <Dialog open={isPalmaresDialogOpen} onOpenChange={setIsPalmaresDialogOpen}>
          <DialogContent className="max-w-6xl w-[90vw] h-[90vh] flex flex-col p-0 bg-white border-zinc-300">
            <DialogHeader className="p-6 pb-2 shrink-0 flex flex-row items-center justify-between border-b bg-gray-50">
              <DialogTitle className="text-xl">Aperçu du Palmarès</DialogTitle>
              <div className="flex gap-2">
                <Button onClick={() => window.print()} className="print:hidden">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer / PDF
                </Button>
                <Button variant="outline" onClick={() => setIsPalmaresDialogOpen(false)} className="print:hidden">
                  Fermer
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto bg-gray-200 p-8 print:p-0 print:bg-white print:overflow-visible flex justify-center">
              {isFetchingPalmares ? (
                <div className="text-center py-20 text-gray-500">Chargement des données du palmarès...</div>
              ) : palmaresData ? (
                <div className="bg-white shadow-lg print:shadow-none print:m-0 w-full max-w-5xl">
                  <PalmaresPrintView palmaresData={palmaresData} academicYearName={activeAcademicYear?.name || ""} />
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500">Aucune donnée disponible.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
