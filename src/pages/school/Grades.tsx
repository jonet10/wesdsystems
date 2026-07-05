import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileSpreadsheet, FileText, Plus, Save, Trash2, Printer, GraduationCap, Award, RefreshCw,
  ChevronRight, BookOpen, AlertCircle, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import {
  useClasses, useSubjects, useExams, useCreateExam, useDeleteExam,
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
  const { profile } = useAuth();
  const { engine, evaluationPeriodType, bulletinModel, useDocumentEngine } = useSchool();
  const businessId = profile?.business_id;

  const periods = evaluationPeriodType === "trimestres" ? TRIMESTRE_PERIODS : STEPS_PERIODS;

  const [activeTab, setActiveTab] = useState("grades");
  const [localBulletinModel, setLocalBulletinModel] = useState<string>(bulletinModel || 'A');
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  useEffect(() => {
    if (useDocumentEngine && businessId) {
      TemplateRepository.getTemplates(businessId, 'school').then(templates => {
        setCustomTemplates(templates.filter(t => t.type === 'report_card'));
      });
    }
  }, [useDocumentEngine, businessId]);

  useEffect(() => {
    if (bulletinModel) {
      setLocalBulletinModel(bulletinModel);
    }
  }, [bulletinModel]);

  // Load custom template if needed
  const [customTemplate, setCustomTemplate] = useState<any[]>([]);

  useEffect(() => {
    const fetchCustomTemplate = async () => {
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      if (!profile?.business_id) return;
      
      const { data } = await supabase
        .from('school_report_templates')
        .select('layout_json')
        .eq('business_id', profile.business_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data && data.layout_json) {
        setCustomTemplate(data.layout_json);
      }
    };
    fetchCustomTemplate();
  }, []);


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
  const deleteExamMutation = useDeleteExam();
  const saveGradesMutation = useSaveGrades();

  // ── New Exam dialog state (auto-prefilled) ────────────────────────────────
  const [isCreateExamDialogOpen, setIsCreateExamDialogOpen] = useState(false);
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
      
      const existingPeriods = (allExams || [])
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
          max_points: parseFloat(maxPoints) || 100,
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

  const handleSaveGrades = async () => {
    if (!selectedExamId) return;

    const maxVal = matchingExam?.max_points || 100;

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
                          <tr>
                            <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Jours d'absence</td>
                            {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                            <td className="p-2 text-center" style={cellStyle}>{absences}</td>
                            {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                            {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                          </tr>
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
                        <tr>
                          <td className="p-2 text-right font-medium text-gray-600" style={cellStyle}>Jours d'absence</td>
                          {settings.showCoef && <td className="p-2 text-center" style={cellStyle}></td>}
                          <td className="p-2 text-center" style={cellStyle}>{absences}</td>
                          {settings.showAppreciation && <td className="p-2" style={cellStyle}></td>}
                          {settings.showRank && <td className="p-2" style={cellStyle}></td>}
                        </tr>
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
        <div className="flex-1 border border-gray-400 font-sans text-sm text-black bg-white">
          {/* En-tête compact */}
          <div className="bg-amber-50 border-b border-gray-300 text-center py-1.5 px-2">
            <p className="font-extrabold text-xs">{settings?.name || "Établissement Scolaire"}</p>
            {settings?.address && <p className="text-[9px]">{settings.address}</p>}
            {settings?.phone && <p className="text-[9px]">Tél : {settings.phone}</p>}
          </div>
          <div className="text-center border-b border-gray-300 py-1 px-2 text-[10px]">
            <p><strong>{student.student_name}</strong> — Classe : <strong>{student.className}</strong></p>
            <p>Année : <strong>{activeAcademicYear?.name || ""}</strong></p>
          </div>
          <div className="text-center border-b border-gray-400 py-1">
            <hr className="border-black border-t mx-3 mb-0.5" />
            <p className="font-extrabold text-xs tracking-wide">Bulletin Scolaire</p>
            <hr className="border-black border-t mx-3 mt-0.5" />
          </div>
          {/* Tableau compact */}
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="border-r border-gray-300 text-center p-1 font-bold w-6">No.</th>
                <th className="border-r border-gray-300 text-left p-1 font-bold">Disciplines</th>
                <th className="border-r border-gray-300 text-center p-1 font-bold w-20">Coefficients</th>
                <th className="text-center p-1 font-bold w-16">Notes</th>
              </tr>
            </thead>
            <tbody>
              {subjectsList.map((sub, idx) => (
                <tr key={sub.subject_id} className="border-b border-gray-200">
                  <td className="border-r border-gray-300 text-center p-1">{idx + 1}</td>
                  <td className="border-r border-gray-300 p-1 uppercase text-[10px] font-medium">{sub.subject_name}</td>
                  <td className="border-r border-gray-300 text-center p-1 font-semibold">{sub.coef}</td>
                  <td className="text-center p-1 font-bold">{sub.average !== null ? sub.average : "-"}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-400 font-bold bg-gray-50 text-[11px]">
                <td colSpan={2} className="border-r border-gray-400 p-1">Total</td>
                <td className="border-r border-gray-400 text-center p-1">{grandTotalCoef}</td>
                <td className="text-center p-1">{Number(grandTotalNote.toFixed(1))}</td>
              </tr>
              <tr className="font-bold bg-gray-50 text-[11px]">
                <td colSpan={2} className="border-r border-gray-400 p-1">Moyenne</td>
                <td className="border-r border-gray-400 text-center p-1"></td>
                <td className="text-center p-1 font-extrabold">{grandAvg ?? "-"}</td>
              </tr>
            </tbody>
          </table>
          {/* Signature compacte */}
          <div className="p-3 text-[10px] space-y-2">
            <div>La direction : <span className="inline-block border-b border-gray-400 w-32">&nbsp;</span></div>
            <div>Responsable : <span className="inline-block border-b border-gray-400 w-32">&nbsp;</span></div>
          </div>
        </div>
      );
      return (
        <div>
          {/* CSS impression paysage */}
          <style>{`@media print { @page { size: landscape; margin: 8mm; } }`}</style>
          <div className="flex gap-4">
            {singleBulletin}
            <div className="w-px bg-gray-400 border-l border-dashed border-gray-400 mx-1" />
            {singleBulletin}
          </div>
          <p className="text-center text-xs text-gray-400 mt-2 print:hidden">← Trait de coupe au milieu →</p>
        </div>
      );
    }

    // ════════════════════════════════════════════════
    // MODÈLE A : PLAT (École Nationale de Sempera)
    // ════════════════════════════════════════════════
    if (effectiveModel === 'A') {
      const decision = grandAvg !== null && grandAvg >= 5.0 ? "Admis(e)" : "Ajourné(e)";
      return (
        <div className="font-sans text-sm text-black bg-white">
          {/* En-tête école */}
          <div className="bg-amber-50 border border-gray-300 text-center p-3 mb-0">
            <p className="font-extrabold text-base">{settings?.name || "Établissement Scolaire"}</p>
            {settings?.address && <p className="text-xs">{settings.address}</p>}
            {settings?.phone && <p className="text-xs">Téléphones : {settings.phone}</p>}
          </div>

          {/* Infos élève */}
          <div className="text-center border-x border-gray-300 py-2 px-4">
            <p className="text-sm font-medium">
              Nom et Prénom : <strong>{student.student_name}</strong>
              {"  "}Classe : <strong>{student.className}</strong>
            </p>
            <p className="text-sm">Année académique : <strong>{activeAcademicYear?.name || ""}</strong></p>
          </div>

          {/* Titre */}
          <div className="text-center border-x border-t border-gray-300 py-2">
            <hr className="border-black border-t-2 mb-1 mx-4" />
            <p className="text-lg font-extrabold tracking-wide">Bulletin Scolaire</p>
            <hr className="border-black border-t-2 mt-1 mx-4" />
          </div>

          {/* Tableau */}
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="border-r border-gray-400 text-left p-2 font-bold text-base" rowSpan={2}>
                  Matières
                </th>
                <th className="text-center p-2 font-bold" colSpan={2}>
                  {selectedPeriod}
                </th>
              </tr>
              <tr className="border-b border-gray-400">
                <th className="border-r border-l border-gray-400 text-center p-1.5 font-bold w-32">
                  Coefficient
                </th>
                <th className="text-center p-1.5 font-bold w-28">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {subjectsList.map((sub) => (
                <tr key={sub.subject_id} className="border-b border-gray-300">
                  <td className="border-r border-gray-300 p-2" style={{ color: "#8B0000" }}>{sub.subject_name}</td>
                  <td className="border-r border-gray-300 text-center p-2 font-semibold">{sub.coef}</td>
                  <td className="text-center p-2 font-bold" style={{ color: "#8B0000" }}>
                    {sub.average !== null ? sub.average : "-"}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-gray-400 font-bold">
                <td className="border-r border-gray-400 p-2">Total</td>
                <td className="border-r border-gray-400 text-center p-2">{grandTotalCoef}</td>
                <td className="text-center p-2">{Number(grandTotalNote.toFixed(1))}</td>
              </tr>
              <tr className="border-b border-gray-400 font-bold">
                <td className="border-r border-gray-400 p-2">Moyenne</td>
                <td className="border-r border-gray-400 text-center p-2">10</td>
                <td className="text-center p-2 font-extrabold">{grandAvg ?? "-"}</td>
              </tr>
              <tr className="font-bold">
                <td className="border-r border-gray-400 p-2">Décision de fin d'année</td>
                <td className="text-center p-2 font-extrabold" colSpan={2}>{decision}</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="border border-t-0 border-gray-300 p-8 space-y-8 text-sm">
            <p className="text-center font-semibold">Signatures</p>
            <div className="flex flex-col gap-6">
              <div>
                <span className="font-semibold">La direction : </span>
                <span className="inline-block border-b border-gray-500 w-72">&nbsp;</span>
              </div>
              <div>
                <span className="font-semibold">Personne Responsable : </span>
                <span className="inline-block border-b border-gray-500 w-64">&nbsp;</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ════════════════════════════════════════════════
    // MODÈLE 1 : GROUPÉ (École Diocésaine St Vincent de Paul)
    // ════════════════════════════════════════════════
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
      return { noteSum: Number(noteSum.toFixed(0)), coefSum: Number(coefSum.toFixed(0)), avg };
    };

    return (
      <div className="flex gap-0 font-sans text-sm text-black bg-white border border-gray-400">
        {/* ── Tableau principal gauche ── */}
        <div className="flex-1">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="border-r border-gray-400 text-center p-1.5 font-bold" colSpan={2}>Matières</th>
                <th className="border-r border-gray-400 text-center p-1.5 font-bold w-20">Coefficient</th>
                <th className="text-center p-1.5 font-bold w-20">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedDomains.map((dom) => {
                const { noteSum, coefSum, avg } = getDomainTotals(dom.subjects);
                return [
                  /* Subject rows */
                  ...dom.subjects.map((sub, idx) => (
                    <tr key={sub.subject_id} className="border-b border-gray-200">
                      {idx === 0 && (
                        <td
                          rowSpan={dom.subjects.length + 2}
                          className="border-r border-gray-400 text-center align-middle font-bold text-[10px] uppercase p-1 bg-gray-50 w-16"
                          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                        >
                          {dom.name}
                        </td>
                      )}
                      <td className="border-r border-gray-300 p-1.5">{sub.subject_name}</td>
                      <td className="border-r border-gray-300 text-center p-1.5 font-semibold">{sub.coef}</td>
                      <td className="text-center p-1.5 font-bold text-red-700">
                        {sub.average !== null ? sub.average : "-"}
                      </td>
                    </tr>
                  )),
                  /* Total row */
                  <tr key={`${dom.name}-t`} className="border-b border-gray-400 bg-gray-50 font-bold text-[11px]">
                    <td className="border-r border-gray-300 p-1 pl-2">Total</td>
                    <td className="border-r border-gray-300 text-center p-1">{coefSum}</td>
                    <td className="text-center p-1 text-red-700">{noteSum}</td>
                  </tr>,
                  /* Moyenne row */
                  <tr key={`${dom.name}-m`} className="border-b border-gray-400 bg-gray-50 font-bold text-[11px]">
                    <td className="border-r border-gray-300 p-1 pl-2">Moyenne</td>
                    <td className="border-r border-gray-300 text-center p-1">10</td>
                    <td className="text-center p-1 text-red-700 font-extrabold">{avg ?? "-"}</td>
                  </tr>,
                ];
              })}

              {/* Grand Total */}
              <tr className="border-t-2 border-gray-500 bg-gray-100 font-bold text-[11px]">
                <td className="border-r border-gray-400 p-1 pl-2 uppercase italic" colSpan={2}>Grand Total</td>
                <td className="border-r border-gray-400 text-center p-1">{grandTotalCoef}</td>
                <td className="text-center p-1 text-red-700">{Number(grandTotalNote.toFixed(0))}</td>
              </tr>
              <tr className="bg-gray-100 font-bold text-[11px]">
                <td className="border-r border-gray-400 p-1 pl-2 uppercase italic" colSpan={2}>Moyenne</td>
                <td className="border-r border-gray-400 text-center p-1">10</td>
                <td className="text-center p-1 text-red-700 font-extrabold">{grandAvg ?? "-"}</td>
              </tr>
              <tr className="border-t border-gray-400 text-[11px]">
                <td className="border-r border-gray-400 p-1 pl-2 font-semibold" colSpan={2}>Conduite</td>
                <td className="border-r border-gray-400 text-center p-1"></td>
                <td className="text-center p-1 font-bold">{conductGrade}</td>
              </tr>
              <tr className="text-[11px]">
                <td className="border-r border-gray-400 p-1 pl-2 font-semibold" colSpan={2}>Mention</td>
                <td className="border-r border-gray-400 text-center p-1 font-bold text-primary" colSpan={2}>{mention}</td>
              </tr>
              <tr className="border-t border-gray-300 text-[11px]">
                <td className="border-r border-gray-400 p-1 pl-2 font-semibold" colSpan={2}>Moyenne Générale</td>
                <td className="border-r border-gray-400 text-center p-1">10</td>
                <td className="text-center p-1 font-extrabold text-red-700">{grandAvg ?? "-"}</td>
              </tr>
              <tr className="border-t border-gray-300 text-[11px] font-bold">
                <td className="border-r border-gray-400 p-1 pl-2" colSpan={2}>Décision de fin d'année</td>
                <td className="text-center p-1 font-extrabold text-red-700 italic" colSpan={2}>{decision}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Colonnes latérales (signatures, absences, retards) ── */}
        <div className="flex border-l border-gray-400 text-[10px]">
          {/* Colonne Personne Responsable */}
          <div className="w-10 border-r border-gray-400 flex items-center justify-center p-1">
            <span className="font-bold uppercase" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
              Personne Responsable
            </span>
          </div>
          {/* Colonne Nombre d'absences */}
          <div className="w-10 border-r border-gray-400 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-1 border-b border-gray-300">
              <span className="font-bold uppercase" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
                Nombre d'absences
              </span>
            </div>
            <div className="p-1 text-center">
              <p className="font-bold">{absences}</p>
            </div>
          </div>
          {/* Colonne Signatures */}
          <div className="w-10 border-r border-gray-400 flex items-center justify-center p-1">
            <span className="font-bold uppercase" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
              Signatures
            </span>
          </div>
          {/* Colonne La direction */}
          <div className="w-10 border-r border-gray-400 flex items-center justify-center p-1">
            <span className="font-bold uppercase" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
              La direction
            </span>
          </div>
          {/* Colonne Nombre de Retards */}
          <div className="w-10 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-1 border-b border-gray-300">
              <span className="font-bold uppercase" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
                Nombre de Retards
              </span>
            </div>
            <div className="p-1 text-center">
              <p className="font-bold">{tardiness}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div>
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
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger
              value="grades"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Saisie des Notes
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
              onClick={() => refetchReportCards()}
            >
              <GraduationCap className="h-4 w-4 mr-2" /> {engine.terminology.get("reportCards")} &amp; Classements
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Saisie / {matchingExam.max_points} pts
                    </span>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDeleteExam}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">N°</TableHead>
                        <TableHead>{engine.terminology.get("student")}</TableHead>
                        <TableHead className="w-48 text-right">
                          Note / {matchingExam.max_points}
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
                          return (
                            <TableRow key={sg.student_id}>
                              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="font-medium">{sg.student_name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={matchingExam.max_points}
                                  placeholder="Note"
                                  value={pointsVal}
                                  onChange={(e) =>
                                    handleGradeInputChange(sg.student_id, "points", e.target.value)
                                  }
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
                  <Button size="lg" onClick={handleSaveGrades} disabled={saveGradesMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveGradesMutation.isPending ? "Enregistrement..." : "Enregistrer les notes"}
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ══════════════ TAB 2: BULLETINS & CLASSEMENTS ══════════════ */}
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
        </Tabs>



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
