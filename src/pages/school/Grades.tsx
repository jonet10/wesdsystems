import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  FileSpreadsheet, FileText, Plus, Search, Save, Trash2, Printer, CheckCircle2, ChevronRight, GraduationCap, Award, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import {
  useClasses, useSubjects, useExams, useCreateExam, useDeleteExam,
  useExamGrades, useSaveGrades, useClassReportCards
} from "@/hooks/useSchoolData";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { format } from "date-fns";

export default function SchoolGrades() {
  const { settings, activeAcademicYear } = useSchoolSettings();

  const [activeTab, setActiveTab] = useState("grades");

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");

  // Data fetching
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const { data: subjects = [] } = useSubjects();

  // Exams for selected class/subject
  const { data: exams = [], isLoading: isLoadingExams } = useExams(selectedClassId, activeAcademicYear?.id || "");
  const filteredExams = exams.filter(e => e.subject_id === selectedSubjectId);

  // Grades for selected exam
  const { data: studentGrades = [], isLoading: isLoadingGrades } = useExamGrades(selectedClassId, selectedExamId);

  // Class Report Cards
  const { data: reportCards = [], isLoading: isLoadingReportCards, refetch: refetchReportCards } = useClassReportCards(
    selectedClassId,
    activeAcademicYear?.id || ""
  );

  // Mutations
  const createExamMutation = useCreateExam();
  const deleteExamMutation = useDeleteExam();
  const saveGradesMutation = useSaveGrades();

  // Dialog State (New Exam)
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [examName, setExamName] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [coefficient, setCoefficient] = useState("1");
  const [examDate, setExamDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSavingExam, setIsSavingExam] = useState(false);

  // Local state for grading inputs
  const [gradeInputs, setGradeInputs] = useState<Record<string, { points: string; note: string }>>({});

  // Report Card Dialog State
  const [reportCardDialog, setReportCardDialog] = useState<{ open: boolean; student: any }>({ open: false, student: null });

  // Default select first class/subject
  if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id);
  if (subjects.length > 0 && !selectedSubjectId) setSelectedSubjectId(subjects[0].id);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !selectedSubjectId || !examName.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsSavingExam(true);
    try {
      const created = await createExamMutation.mutateAsync({
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        academic_year_id: activeAcademicYear!.id,
        name: examName.trim(),
        max_points: parseFloat(maxPoints) || 100,
        coefficient: parseFloat(coefficient) || 1,
        exam_date: examDate,
      });

      toast.success("Évaluation créée avec succès !");
      setIsExamDialogOpen(false);
      setExamName("");
      setSelectedExamId(created.id!);
      setGradeInputs({});
    } catch (error: any) {
      toast.error("Erreur de création");
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("Voulez-vous supprimer cette évaluation et toutes ses notes ?")) return;
    try {
      await deleteExamMutation.mutateAsync({ id, classId: selectedClassId, academicYearId: activeAcademicYear!.id });
      toast.success("Évaluation supprimée.");
      if (selectedExamId === id) setSelectedExamId("");
    } catch (error: any) {
      toast.error("Erreur de suppression");
    }
  };

  const handleGradeInputChange = (studentId: string, field: "points" | "note", value: string) => {
    setGradeInputs(prev => ({
      ...prev,
      [studentId]: {
        points: field === "points" ? value : (prev[studentId]?.points ?? ""),
        note: field === "note" ? value : (prev[studentId]?.note ?? ""),
      }
    }));
  };

  const handleSaveGrades = async () => {
    if (!selectedExamId) return;

    const exam = exams.find(e => e.id === selectedExamId);
    const maxVal = exam?.max_points || 100;

    // Build payload
    const gradesPayload = studentGrades.map(sg => {
      const input = gradeInputs[sg.student_id];
      const pointsStr = input ? input.points : String(sg.points_obtained);

      if (pointsStr === "") return null; // skip unsaved students

      const points = parseFloat(pointsStr) || 0;
      if (points > maxVal) {
        toast.error(`La note saisie (${points}) dépasse le maximum autorisé (${maxVal})`);
        throw new Error("Validation failed");
      }

      return {
        student_id: sg.student_id,
        points_obtained: points,
        note: input ? input.note : sg.note,
      };
    }).filter(Boolean) as any[];

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

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" /> Carnet de Notes & Bulletins
            </h1>
            <p className="text-muted-foreground">Enregistrez les évaluations scolaires et dressez les bulletins de notes trimestriels</p>
          </div>
        </div>

        {/* ── Tabs selector ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger value="grades" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Saisie des Notes
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3" onClick={() => refetchReportCards()}>
              <GraduationCap className="h-4 w-4 mr-2" /> Bulletins & Classements
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: GRADE ENTRY ── */}
          <TabsContent value="grades" className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label>Classe</Label>
                  <select
                    value={selectedClassId}
                    onChange={e => { setSelectedClassId(e.target.value); setSelectedExamId(""); setGradeInputs({}); }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Matière</Label>
                  <select
                    value={selectedSubjectId}
                    onChange={e => { setSelectedSubjectId(e.target.value); setSelectedExamId(""); setGradeInputs({}); }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                  >
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Évaluation (Examen)</Label>
                  <div className="flex gap-2">
                    <select
                      value={selectedExamId}
                      onChange={e => { setSelectedExamId(e.target.value); setGradeInputs({}); }}
                      disabled={filteredExams.length === 0}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none flex-1"
                    >
                      <option value="">-- Choisir un examen --</option>
                      {filteredExams.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name} (Max : {ex.max_points})</option>
                      ))}
                    </select>
                    {selectedExamId && (
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDeleteExam(selectedExamId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Dialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" variant="outline">
                        <Plus className="h-4 w-4 mr-2" /> Créer évaluation
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Nouvelle Évaluation</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateExam} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                          <Label>Nom de l'évaluation</Label>
                          <Input
                            placeholder="Ex: Devoir 1, Examen Sommatif 1"
                            value={examName}
                            onChange={e => setExamName(e.target.value)}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>Note Maximale</Label>
                            <Input
                              type="number"
                              value={maxPoints}
                              onChange={e => setMaxPoints(e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label>Coefficient</Label>
                            <Input
                              type="number"
                              value={coefficient}
                              onChange={e => setCoefficient(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Date de l'évaluation</Label>
                          <Input
                            type="date"
                            value={examDate}
                            onChange={e => setExamDate(e.target.value)}
                            required
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" type="button" onClick={() => setIsExamDialogOpen(false)}>Annuler</Button>
                          <Button type="submit" disabled={isSavingExam}>Créer</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Card>

            {/* Grades entry sheet */}
            {!selectedExamId ? (
              <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <FileSpreadsheet className="h-8 w-8 opacity-45" />
                <p>Aucune évaluation sélectionnée.</p>
                <p className="text-xs">Choisissez ou créez une évaluation pour commencer à saisir les notes des élèves.</p>
              </Card>
            ) : (
              <Card>
                <div className="p-4 border-b flex justify-between items-center bg-muted/10">
                  <div>
                    <h3 className="font-semibold">{selectedExam?.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Matière : {selectedExam?.subject?.name} · Coefficient : {selectedExam?.coefficient} · Date : {selectedExam?.exam_date ? new Date(selectedExam.exam_date).toLocaleDateString("fr-FR") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Saisie sur / {selectedExam?.max_points}</span>
                  </div>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">N°</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead className="w-48 text-right">Note obtenues / {selectedExam?.max_points}</TableHead>
                        <TableHead>Remarques / Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingGrades ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Chargement des fiches...</TableCell></TableRow>
                      ) : studentGrades.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun élève trouvé dans cette classe.</TableCell></TableRow>
                      ) : studentGrades.map((sg, index) => {
                        const local = gradeInputs[sg.student_id];
                        const pointsVal = local ? local.points : (sg.points_obtained === "" ? "" : String(sg.points_obtained));
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
                                max={selectedExam?.max_points}
                                placeholder="Saisir note"
                                value={pointsVal}
                                onChange={e => handleGradeInputChange(sg.student_id, "points", e.target.value)}
                                className="h-8 w-32 ml-auto text-right font-semibold"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Remarque libre..."
                                value={noteVal}
                                onChange={e => handleGradeInputChange(sg.student_id, "note", e.target.value)}
                                className="h-8"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
                <div className="p-4 border-t flex justify-end">
                  <Button size="lg" onClick={handleSaveGrades} disabled={saveGradesMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveGradesMutation.isPending ? "Enregistrement..." : "Enregistrer les notes"}
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── TAB 2: REPORT CARDS & RANKS ── */}
          <TabsContent value="reports" className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1.5 min-w-[200px]">
                  <Label>Classe</Label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Button onClick={() => refetchReportCards()}>
                  Générer le classement
                </Button>
              </div>
            </Card>

            {isLoadingReportCards ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                Analyse des moyennes et classement de la classe en cours...
              </div>
            ) : reportCards.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Award className="h-8 w-8 opacity-45" />
                <p>Aucune note enregistrée pour cette classe ou année académique active.</p>
                <p className="text-xs">Saisissez d'abord des notes dans le premier onglet.</p>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Classement Général de la Classe</CardTitle>
                  <CardDescription>Moyennes calculées sur un barème uniforme de 10 points (pour les moyennes de matière et globales).</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-center">Rang</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom de l'élève</TableHead>
                        <TableHead className="text-center">Sexe</TableHead>
                        <TableHead className="text-right font-bold text-primary">Moyenne Générale (/10)</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportCards.map((card) => (
                        <TableRow key={card.student_id} className={card.rank === 1 ? "bg-amber-500/5" : undefined}>
                          <TableCell className="text-center font-bold">
                            {card.rank} {card.rank === 1 ? "🏆" : ""}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{card.matricule}</TableCell>
                          <TableCell className="font-semibold">{card.student_name}</TableCell>
                          <TableCell className="text-center">{card.gender}</TableCell>
                          <TableCell className="text-right font-bold text-primary text-base">
                            {card.overallAverage !== null ? `${card.overallAverage} / 10` : "Pas de note"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setReportCardDialog({ open: true, student: card })}>
                              <FileText className="h-3.5 w-3.5 mr-1" /> Bulletin PDF
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

        {/* ── Report Card PDF Viewer / Printable Dialog ── */}
        <Dialog open={reportCardDialog.open} onOpenChange={open => setReportCardDialog(p => ({ ...p, open }))}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {reportCardDialog.student && (
              <div className="space-y-6">
                
                {/* Print Layout */}
                <div id="student-bulletin-printable" className="p-6 border rounded-xl space-y-6 bg-white dark:bg-zinc-950 font-serif">
                  <div className="flex justify-between border-b pb-4">
                    <div>
                      <h2 className="text-xl font-bold tracking-wide text-foreground uppercase">{settings?.name || "Établissement Scolaire"}</h2>
                      <p className="text-xs text-muted-foreground">{settings?.address || ""}</p>
                      <p className="text-xs text-muted-foreground">Tél : {settings?.phone || ""}</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-bold text-primary uppercase">Bulletin de Notes</h3>
                      <p className="text-xs text-muted-foreground">Année Académique : {activeAcademicYear?.name || ""}</p>
                      <p className="text-xs font-semibold text-foreground uppercase mt-1">Classe : {reportCardDialog.student.className}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border text-sm font-sans">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Nom de l'élève</p>
                      <p className="font-bold text-base text-foreground">{reportCardDialog.student.student_name}</p>
                      <p className="text-xs text-muted-foreground">Matricule : {reportCardDialog.student.matricule}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-muted-foreground">Sexe : {reportCardDialog.student.gender}</p>
                      <p className="text-xs text-muted-foreground">Rang de l'élève : <span className="font-bold text-sm text-foreground">{reportCardDialog.student.rank}e</span></p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground font-sans">Résultats par Matière</h4>
                    <Table className="border font-sans">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Matière</TableHead>
                          <TableHead className="text-center w-28">Coef. examens</TableHead>
                          <TableHead className="text-right w-36 font-semibold">Moyenne Élève (/10)</TableHead>
                          <TableHead className="text-right w-36">Moyenne Classe (/10)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportCardDialog.student.subjects.map((sub: any) => (
                          <TableRow key={sub.subject_id}>
                            <TableCell className="font-medium text-sm">{sub.subject_name}</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">{sub.coef}</TableCell>
                            <TableCell className="text-right font-bold text-sm text-foreground">
                              {sub.average !== null ? `${sub.average} / 10` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {sub.classAverage !== null ? `${sub.classAverage} / 10` : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center p-4 border rounded-xl bg-primary/5 font-sans border-primary/20">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Moyenne Générale</p>
                      <p className="text-2xl font-bold text-primary">{reportCardDialog.student.overallAverage !== null ? `${reportCardDialog.student.overallAverage} / 10` : "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase">Décision du conseil</p>
                      <p className="font-bold text-sm text-foreground">
                        {reportCardDialog.student.overallAverage !== null && reportCardDialog.student.overallAverage >= 5.0
                          ? "Tableau d'Honneur (Admis)"
                          : "Ajourné"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-10 text-xs font-sans text-center">
                    <div>
                      <p className="font-semibold border-b pb-1 w-32 mx-auto">La Direction</p>
                      <div className="h-16"></div>
                    </div>
                    <div>
                      <p className="font-semibold border-b pb-1 w-40 mx-auto">Signature des Parents</p>
                      <div className="h-16"></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 font-sans">
                  <Button variant="outline" onClick={() => setReportCardDialog({ open: false, student: null })}>Fermer</Button>
                  <Button onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" /> Imprimer le bulletin
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
