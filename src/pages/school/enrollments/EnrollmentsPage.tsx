import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, RepeatIcon, History, ArrowRight, GraduationCap, Sparkles, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import type { SchoolStudent, SchoolClass, SchoolAcademicYear, SchoolEnrollment } from "@/modules/school/types";
import { enrollmentService } from "@/modules/school/services";
import { studentService } from "@/modules/school/services";
import { setBusinessId } from "@/modules/school/services/utils";
import { format } from "date-fns";

export default function EnrollmentsPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const { activeAcademicYear } = useSchoolSettings();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<SchoolAcademicYear[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Existing student enrollment
  const [newStudentId, setNewStudentId] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [newYearId, setNewYearId] = useState("");
  const [newStatus, setNewStatus] = useState<"registered" | "active">("active");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Transfer state
  const [transferStudentIds, setTransferStudentIds] = useState<string[]>([]);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferClassId, setTransferClassId] = useState("");
  const [transferYearId, setTransferYearId] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Quick enrollment (new student)
  const [quickFirstName, setQuickFirstName] = useState("");
  const [quickLastName, setQuickLastName] = useState("");
  const [quickGender, setQuickGender] = useState("F");
  const [quickClassId, setQuickClassId] = useState("");
  const [quickYearId, setQuickYearId] = useState("");
  const [quickStatus, setQuickStatus] = useState<"registered" | "active">("active");
  const [quickAutoInvoice, setQuickAutoInvoice] = useState(true);
  const [isQuickEnrolling, setIsQuickEnrolling] = useState(false);

  // CSV import
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvClassId, setCsvClassId] = useState("");
  const [csvYearId, setCsvYearId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (businessId) setBusinessId(businessId);
  }, [businessId]);

  const loadData = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const [studRes, classRes, yearRes, enrRes] = await Promise.all([
        supabase.from("school_students").select("*").eq("business_id", businessId).order("last_name"),
        supabase.from("school_classes").select("*").eq("business_id", businessId).order("level_order"),
        supabase.from("school_academic_years").select("*").eq("business_id", businessId).order("name", { ascending: false }),
        supabase.from("school_enrollments")
          .select("*, student:student_id(*), school_class:class_id(*), academic_year:academic_year_id(*)")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
      ]);
      if (studRes.data) setStudents(studRes.data);
      if (classRes.data) setClasses(classRes.data);
      if (yearRes.data) setAcademicYears(yearRes.data);
      if (enrRes.data) setEnrollments(enrRes.data);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, businessId]);

  const resetQuickForm = () => {
    setQuickFirstName("");
    setQuickLastName("");
    setQuickGender("F");
    setQuickClassId("");
    setQuickYearId("");
    setQuickStatus("active");
    setQuickAutoInvoice(true);
  };

  const handleQuickEnroll = async () => {
    if (!quickFirstName.trim() || !quickLastName.trim() || !quickClassId || !quickYearId) {
      toast.error("Prénom, Nom, Classe et Année sont requis");
      return;
    }
    setIsQuickEnrolling(true);
    try {
      const student = await studentService.create({
        first_name: quickFirstName.trim(),
        last_name: quickLastName.trim(),
        gender: quickGender,
        class_level: classes.find(c => c.id === quickClassId)?.code || null,
      });
      await enrollmentService.create({
        student_id: student.id,
        class_id: quickClassId,
        academic_year_id: quickYearId,
        status: quickStatus,
        auto_generate_invoice: quickAutoInvoice,
      });
      toast.success(`${quickFirstName} ${quickLastName} inscrit avec succès`, {
        description: "Complétez son dossier dans la page Élèves."
      });
      resetQuickForm();
      loadData();
    } catch (error: any) {
      toast.error("Erreur d'inscription", { description: error.message });
    } finally {
      setIsQuickEnrolling(false);
    }
  };

  const handleEnroll = async () => {
    if (!newStudentId || !newClassId || !newYearId) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setIsEnrolling(true);
    try {
      await enrollmentService.create({
        student_id: newStudentId,
        class_id: newClassId,
        academic_year_id: newYearId,
        status: newStatus,
        auto_generate_invoice: autoInvoice,
      });
      toast.success("Inscription réussie");
      setNewStudentId(""); setNewClassId(""); setNewYearId("");
      loadData();
    } catch (error: any) {
      toast.error("Erreur d'inscription", { description: error.message });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleTransfer = async () => {
    if (transferStudentIds.length === 0 || !transferClassId || !transferYearId) {
      toast.error("Veuillez sélectionner au moins un élève et remplir tous les champs");
      return;
    }
    setIsTransferring(true);
    let successCount = 0;
    let errorCount = 0;
    for (const id of transferStudentIds) {
      try {
        await enrollmentService.transfer(id, transferClassId, transferYearId);
        successCount++;
      } catch {
        errorCount++;
      }
    }
    const student = students.find(s => s.id === transferStudentIds[0]);
    if (errorCount === 0) {
      toast.success(`${successCount} élève${successCount > 1 ? "s" : ""} transféré${successCount > 1 ? "s" : ""} avec succès`);
    } else {
      toast.error(`${errorCount} transfert${errorCount > 1 ? "s" : ""} ont échoué`, { description: `${successCount} réussi${successCount > 1 ? "s" : ""}` });
    }
    setTransferStudentIds([]);
    loadData();
    setIsTransferring(false);
  };

  const parseCSV = (text: string): { firstName: string; lastName: string; gender: string }[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const rows: { firstName: string; lastName: string; gender: string }[] = [];
    for (const line of lines) {
      const sep = line.includes(";") ? ";" : ",";
      const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 3) continue;
      const [lastName, firstName, gender] = parts;
      rows.push({ firstName, lastName, gender: gender.toUpperCase() === "M" ? "M" : "F" });
    }
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const header = "Nom;Prénom;Sexe\n";
    const sampleLines = ["Dupont;Alice;F", "Pierre;Jean;M", "Saintil;Marie;F"].join("\n");
    const blob = new Blob(["\uFEFF" + header + sampleLines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele_import_eleves.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = async () => {
    if (!csvText.trim()) { toast.error("Collez le CSV ou importez un fichier"); return; }
    if (!csvClassId) { toast.error("Veuillez sélectionner une classe"); return; }
    setIsImporting(true);
    const rows = parseCSV(csvText);
    if (rows.length === 0) { toast.error("Aucune ligne valide trouvée (format: Nom,Prénom,Sexe)"); setIsImporting(false); return; }
    const foundClass = classes.find(c => c.id === csvClassId);
    if (!foundClass) { toast.error("Classe sélectionnée introuvable"); setIsImporting(false); return; }
    const yearId = csvYearId || activeAcademicYear?.id;
    if (!yearId) { toast.error("Aucune année académique sélectionnée"); setIsImporting(false); return; }
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const student = await studentService.create({
          first_name: row.firstName,
          last_name: row.lastName,
          gender: row.gender,
          class_level: foundClass.code,
        });
        await enrollmentService.create({
          student_id: student.id,
          class_id: foundClass.id,
          academic_year_id: yearId,
          status: "active",
          auto_generate_invoice: true,
        });
        success++;
      } catch (err: any) {
        errors.push(`Ligne ${i + 1}: ${err.message}`);
      }
    }

    setImportResults({ success, errors });
    if (errors.length === 0) {
      toast.success(`${success} élève(s) inscrit(s) avec succès`);
      setCsvDialogOpen(false);
      setCsvText("");
      setCsvClassId("");
      setCsvYearId("");
      setImportResults({ success: 0, errors: [] });
      loadData();
    }
    setIsImporting(false);
  };

  const filteredEnrollments = enrollments.filter((e: any) => {
    const name = `${e.student?.first_name || ""} ${e.student?.last_name || ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Inscriptions</h1>
          <p className="text-muted-foreground">Inscrivez, transférez et suivez les inscriptions des élèves</p>
        </div>

        <Tabs defaultValue="nouvelle" className="space-y-6">
          <TabsList>
            <TabsTrigger value="nouvelle"><UserPlus className="h-4 w-4 mr-2" />Nouvelle Inscription</TabsTrigger>
            <TabsTrigger value="transfert"><RepeatIcon className="h-4 w-4 mr-2" />Transfert / Changement</TabsTrigger>
            <TabsTrigger value="historique"><History className="h-4 w-4 mr-2" />Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="nouvelle" className="space-y-6">
            {/* Quick enrollment — new student */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Inscription rapide — Nouvel élève
                  </CardTitle>
                  <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />Importer CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Import CSV</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Classe cible *</Label>
                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={csvClassId} onChange={e => setCsvClassId(e.target.value)}>
                              <option value="">Sélectionner une classe</option>
                              {classes.filter(c => c.active !== false).map(c => (
                                <option key={c.id} value={c.id}>{c.code} — {c.name}{c.section ? ` (${c.section})` : ""}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Année académique</Label>
                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={csvYearId} onChange={e => setCsvYearId(e.target.value)}>
                              <option value="">{activeAcademicYear?.name || "Active (défaut)"}</option>
                              {academicYears.map(y => (
                                <option key={y.id} value={y.id}>{y.name} {y.active ? "(Active)" : ""}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Fichier CSV (.csv) ou coller le texte</Label>
                            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" />Télécharger modèle
                            </Button>
                          </div>
                          <Input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileUpload} />
                        </div>
                        <div className="space-y-2">
                          <Label>Ou coller les données (Format: Nom;Prénom;Sexe)</Label>
                          <textarea
                            className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={csvText}
                            onChange={e => setCsvText(e.target.value)}
                            placeholder={`Dupont;Alice;F\nPierre;Jean;M\nSaintil;Marie;F`}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Format :</strong> Nom;Prénom;Sexe(F/M) — une ligne par élève (séparateur <code>;</code> ou <code>,</code>)</p>
                          <p>Tous les élèves seront importés dans la classe sélectionnée.</p>
                        </div>
                        {importResults.errors.length > 0 && (
                          <div className="bg-destructive/10 p-3 rounded-lg text-sm space-y-1">
                            <p className="font-semibold text-destructive">{importResults.success} réussie(s), {importResults.errors.length} erreur(s)</p>
                            {importResults.errors.map((err, i) => <p key={i} className="text-xs">{err}</p>)}
                          </div>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => { setCsvDialogOpen(false); setCsvText(""); setCsvClassId(""); setCsvYearId(""); setImportResults({ success: 0, errors: [] }); }}>Annuler</Button>
                          <Button onClick={handleCSVImport} disabled={isImporting || !csvClassId}>
                            {isImporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Import...</> : <><Upload className="h-4 w-4 mr-2" />Importer {parseCSV(csvText).length} élève(s)</>}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={quickFirstName} onChange={e => setQuickFirstName(e.target.value)} placeholder="Prénom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={quickLastName} onChange={e => setQuickLastName(e.target.value)} placeholder="Nom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexe *</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quickGender} onChange={e => setQuickGender(e.target.value)}>
                      <option value="F">Féminin</option>
                      <option value="M">Masculin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Classe *</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quickClassId} onChange={e => setQuickClassId(e.target.value)}>
                      <option value="">Sélectionner</option>
                      {classes.filter(c => c.active !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}{c.section ? ` (${c.section})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Année académique</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quickYearId} onChange={e => setQuickYearId(e.target.value)}>
                      <option value="">Sélectionner</option>
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>{y.name} {y.active ? "(Active)" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quickStatus} onChange={e => setQuickStatus(e.target.value as any)}>
                      <option value="active">Actif</option>
                      <option value="registered">Pré-inscrit</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="quickAutoInvoice" checked={quickAutoInvoice} onChange={e => setQuickAutoInvoice(e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="quickAutoInvoice" className="text-sm cursor-pointer">Générer automatiquement la facture</Label>
                </div>
                <Button onClick={handleQuickEnroll} disabled={isQuickEnrolling} className="mt-4">
                  {isQuickEnrolling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Inscription...</> : <><GraduationCap className="h-4 w-4 mr-2" />Inscrire l'élève</>}
                </Button>
              </CardContent>
            </Card>

            {/* Existing student enrollment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Inscrire un élève existant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Élève</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newStudentId} onChange={e => setNewStudentId(e.target.value)}>
                      <option value="">Sélectionner un élève</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name} {s.matricule ? `(${s.matricule})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Classe</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newClassId} onChange={e => setNewClassId(e.target.value)}>
                      <option value="">Sélectionner une classe</option>
                      {classes.filter(c => c.active !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.code} {c.name} {c.section ? `- Sect. ${c.section}` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Année académique</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newYearId} onChange={e => setNewYearId(e.target.value)}>
                      <option value="">Sélectionner</option>
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>{y.name} {y.active ? "(Active)" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newStatus} onChange={e => setNewStatus(e.target.value as any)}>
                      <option value="active">Actif</option>
                      <option value="registered">Pré-inscrit</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="autoInvoice" checked={autoInvoice} onChange={e => setAutoInvoice(e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="autoInvoice" className="text-sm cursor-pointer">Générer automatiquement la facture et les frais</Label>
                </div>
                <Button onClick={handleEnroll} disabled={isEnrolling}>
                  {isEnrolling ? "Inscription..." : <><GraduationCap className="h-4 w-4 mr-2" />Inscrire l'élève</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfert">
            <Card>
              <CardHeader>
                <CardTitle>Transfert / Changement de classe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Élèves à transférer</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher un élève..." value={transferSearch} onChange={e => setTransferSearch(e.target.value)} className="pl-9" />
                  </div>
                  <div className="border rounded-md max-h-48 overflow-y-auto space-y-1 p-1">
                    {students
                      .filter(s => !transferSearch || `${s.first_name} ${s.last_name} ${s.class_level || ""}`.toLowerCase().includes(transferSearch.toLowerCase()))
                      .map(s => (
                        <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={transferStudentIds.includes(s.id)}
                            onChange={() => {
                              setTransferStudentIds(prev =>
                                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                              );
                            }}
                            className="h-4 w-4"
                          />
                          <span>{s.first_name} {s.last_name}</span>
                          <span className="text-muted-foreground ml-auto text-xs">{s.class_level || "N/A"}</span>
                        </label>
                      ))}
                    {students.length === 0 && <p className="text-sm text-muted-foreground p-2">Aucun élève trouvé</p>}
                  </div>
                  {transferStudentIds.length > 0 && (
                    <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                      <span className="font-medium">{transferStudentIds.length} élève{transferStudentIds.length > 1 ? "s" : ""} sélectionné{transferStudentIds.length > 1 ? "s" : ""}</span>
                      {(() => {
                        const classesSet = [...new Set(transferStudentIds.map(id => students.find(s => s.id === id)?.class_level).filter(Boolean))];
                        return classesSet.length > 0 && (
                          <div className="text-muted-foreground">Classes actuelles : {classesSet.join(", ")}</div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nouvelle classe</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={transferClassId} onChange={e => setTransferClassId(e.target.value)}>
                      <option value="">Sélectionner</option>
                      {classes.filter(c => c.active !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.code} {c.name} {c.section ? `(${c.section})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Année académique</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={transferYearId} onChange={e => setTransferYearId(e.target.value)}>
                      <option value="">Sélectionner</option>
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button onClick={handleTransfer} disabled={isTransferring} variant="secondary">
                  {isTransferring ? "Transfert..." : <><RepeatIcon className="h-4 w-4 mr-2" />Effectuer le transfert</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historique" className="space-y-4">
            <Card>
              <div className="p-4 border-b">
                <div className="relative max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Année Académique</TableHead>
                      <TableHead>Date d'inscription</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell></TableRow>
                    ) : filteredEnrollments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune inscription trouvée</TableCell></TableRow>
                    ) : (
                      filteredEnrollments.map((enr: any) => (
                        <TableRow key={enr.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              {enr.student?.first_name} {enr.student?.last_name}
                              {enr.student?.matricule && <span className="text-xs text-muted-foreground">({enr.student.matricule})</span>}
                            </div>
                          </TableCell>
                          <TableCell>{enr.school_class?.name || enr.school_class?.code || "-"}</TableCell>
                          <TableCell>{enr.academic_year?.name || "-"}</TableCell>
                          <TableCell>{enr.enrollment_date ? format(new Date(enr.enrollment_date), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              enr.status === "active" ? "bg-success/10 text-success" :
                              enr.status === "registered" ? "bg-warning/10 text-warning" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {enr.status === "active" ? "Actif" : enr.status === "registered" ? "Pré-inscrit" : "Retiré"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
