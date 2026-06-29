import { useTranslation } from "react-i18next";
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
import { Search, UserPlus, RepeatIcon, History, ArrowRight, GraduationCap, Sparkles, Upload, FileSpreadsheet, Loader2, Printer, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import type { SchoolStudent, SchoolClass, SchoolAcademicYear, SchoolEnrollment } from "@/modules/school/types";
import { enrollmentService } from "@/modules/school/services";
import { studentService } from "@/modules/school/services";
import { invoiceService } from "@/modules/school/services";
import { setBusinessId } from "@/modules/school/services/utils";
import { format } from "date-fns";

export default function EnrollmentsPage() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const { settings, activeAcademicYear } = useSchoolSettings();
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
  const [chargeEnrollmentFee, setChargeEnrollmentFee] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Quick enrollment (new student)
  const [quickFirstName, setQuickFirstName] = useState("");
  const [quickLastName, setQuickLastName] = useState("");
  const [quickGender, setQuickGender] = useState("F");
  const [quickClassId, setQuickClassId] = useState("");
  const [quickYearId, setQuickYearId] = useState("");
  const [quickStatus, setQuickStatus] = useState<"registered" | "active">("active");
  const [quickAutoInvoice, setQuickAutoInvoice] = useState(true);
  const [quickScholarshipType, setQuickScholarshipType] = useState<"none" | "half" | "full" | "custom">("none");
  const [quickCustomPercentage, setQuickCustomPercentage] = useState<number>(25);
  const [isQuickEnrolling, setIsQuickEnrolling] = useState(false);

  // CSV import
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [showImportNotice, setShowImportNotice] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvClassId, setCsvClassId] = useState("");
  const [csvYearId, setCsvYearId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payment slip
  const [paymentSlipOpen, setPaymentSlipOpen] = useState(false);
  const [paymentSlipData, setPaymentSlipData] = useState<{
    studentName: string;
    className: string;
    yearName: string;
    invoices: any[];
  } | null>(null);

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
    setQuickScholarshipType("none");
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
        scholarship_type: quickScholarshipType === 'custom' ? 'none' : quickScholarshipType,
        scholarship_percentage: quickScholarshipType === 'full' ? 100
          : quickScholarshipType === 'half' ? 50
          : quickScholarshipType === 'custom' ? Math.min(100, Math.max(0, quickCustomPercentage))
          : 0
      });
      const result = await enrollmentService.create({
        student_id: student.id,
        class_id: quickClassId,
        academic_year_id: quickYearId,
        status: quickStatus,
        auto_generate_invoice: quickAutoInvoice,
      });
      toast.success(`${quickFirstName} ${quickLastName} inscrit avec succès`, {
        description: "Complétez son dossier dans la page Élèves."
      });
      
      // Show payment slip
      if (quickAutoInvoice && result.invoices?.length > 0) {
        // Fetch full invoice details with items
        const fullInvoices = await Promise.all(result.invoices.map((inv: any) => invoiceService.getByIdWithItems(inv.id)));
        const cls = classes.find(c => c.id === quickClassId);
        const yr = academicYears.find(y => y.id === quickYearId);
        setPaymentSlipData({
          studentName: `${quickFirstName.trim()} ${quickLastName.trim()}`,
          className: cls ? `${cls.code || ''} ${cls.name}` : '',
          yearName: yr?.name || '',
          invoices: fullInvoices,
        });
        setPaymentSlipOpen(true);
      }
      
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
      const result = await enrollmentService.create({
        student_id: newStudentId,
        class_id: newClassId,
        academic_year_id: newYearId,
        status: newStatus,
        auto_generate_invoice: autoInvoice,
      });
      toast.success("Inscription réussie");

      // Show payment slip
      if (autoInvoice && result.invoices?.length > 0) {
        const fullInvoices = await Promise.all(result.invoices.map((inv: any) => invoiceService.getByIdWithItems(inv.id)));
        const student = students.find(s => s.id === newStudentId);
        const cls = classes.find(c => c.id === newClassId);
        const yr = academicYears.find(y => y.id === newYearId);
        setPaymentSlipData({
          studentName: student ? `${student.first_name} ${student.last_name}` : '',
          className: cls ? `${cls.code || ''} ${cls.name}` : '',
          yearName: yr?.name || '',
          invoices: fullInvoices,
        });
        setPaymentSlipOpen(true);
      }

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
    let unpaidDebtCount = 0;
    for (const id of transferStudentIds) {
      try {
        await enrollmentService.transfer(id, transferClassId, transferYearId, chargeEnrollmentFee);
        successCount++;
      } catch (err: any) {
        if (err?.message === "UNPAID_DEBT") {
          unpaidDebtCount++;
        }
        errorCount++;
      }
    }
    if (errorCount === 0) {
      toast.success(`${successCount} élève${successCount > 1 ? "s" : ""} transféré${successCount > 1 ? "s" : ""} avec succès`);
    } else {
      if (unpaidDebtCount > 0) {
        toast.error(`Transfert refusé pour ${unpaidDebtCount} élève(s)`, { description: "Ils doivent d'abord s'acquitter de leurs dettes (solde > 0)." });
      }
      if (errorCount > unpaidDebtCount) {
        toast.error(`${errorCount - unpaidDebtCount} transfert(s) ont échoué pour d'autres raisons.`);
      }
    }
    setTransferStudentIds([]);
    setTransferClassId("");
    setTransferYearId("");
    setChargeEnrollmentFee(false);
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
    if (success > 0) {
      setShowImportNotice(true);
    }
    if (errors.length === 0) {
      if (success > 0) {
        toast.success(`${success} élève(s) inscrit(s) avec succès`);
      }
      setCsvDialogOpen(false);
      setCsvText("");
      setCsvClassId("");
      setCsvYearId("");
      setImportResults({ success: 0, errors: [] });
      loadData();
    } else {
      if (success > 0) {
        toast.success(`${success} élève(s) inscrit(s) avec succès, mais avec des erreurs`);
        loadData();
      }
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
                          <Button variant="outline" onClick={() => { setCsvDialogOpen(false); setCsvText(""); setCsvClassId(""); setCsvYearId(""); setImportResults({ success: 0, errors: [] }); }}>{t("common.cancel")}</Button>
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
                    <Label>{t("common.status")}</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quickStatus} onChange={e => setQuickStatus(e.target.value as any)}>
                      <option value="active">Actif</option>
                      <option value="registered">Pré-inscrit</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bourse / Réduction</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quickScholarshipType} onChange={e => setQuickScholarshipType(e.target.value as any)}>
                      <option value="none">Aucune</option>
                      <option value="half">Demi-bourse (50%)</option>
                      <option value="full">Bourse complète (100%)</option>
                      <option value="custom">Pourcentage personnalisé</option>
                    </select>
                    {quickScholarshipType === 'custom' && (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={quickCustomPercentage}
                          onChange={e => setQuickCustomPercentage(Number(e.target.value))}
                          className="w-24 text-center"
                        />
                        <span className="text-sm font-medium text-muted-foreground">% de réduction</span>
                      </div>
                    )}
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
                    <Label>{t("common.status")}</Label>
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
                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" 
                    id="chargeEnrollmentFee" 
                    checked={chargeEnrollmentFee} 
                    onChange={e => setChargeEnrollmentFee(e.target.checked)} 
                    className="h-4 w-4" 
                  />
                  <Label htmlFor="chargeEnrollmentFee" className="text-sm cursor-pointer">Facturer les frais de réinscription</Label>
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
                      <TableHead>{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
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

        <Dialog open={showImportNotice} onOpenChange={setShowImportNotice}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-warning">
                <Sparkles className="h-5 w-5 text-warning" />
                Frais d'Inscription à percevoir
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm">
                L'importation de groupe a été effectuée avec succès !
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg text-sm text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">
                <strong>Action requise :</strong> Pensez à finaliser le paiement des frais d'inscription de ces élèves. 
                Vous pouvez gérer et imprimer leurs fiches de paiement séparées depuis la <strong>Fiche Financière</strong> de chaque élève.
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setShowImportNotice(false)}>Compris</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Slip Dialog — POS Receipt Style */}
        <Dialog open={paymentSlipOpen} onOpenChange={setPaymentSlipOpen}>
          <DialogContent className="max-w-sm max-h-[95vh] overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary text-sm">
                <FileText className="h-4 w-4" />
                Fiche d'Inscription
              </DialogTitle>
            </DialogHeader>
            {paymentSlipData && (
              <div className="space-y-3 pt-1">
                {/* Success banner */}
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded px-3 py-2 text-green-800 dark:text-green-300 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Inscription réussie — fiche à remettre au parent</span>
                </div>

                {/* ── POS RECEIPT ── */}
                <div
                  id="payment-slip-print-area"
                  className="bg-white text-black rounded border font-mono text-xs leading-tight"
                  style={{ width: "100%", maxWidth: "300px", margin: "0 auto", padding: "16px 8px", color: "#000" }}
                >
                  {/* Logo + School name — centered */}
                  <div style={{ textAlign: "center", marginBottom: "12px" }}>
                    {settings?.logo_url && (
                      <img
                        src={settings.logo_url}
                        alt="logo"
                        style={{ height: "48px", width: "48px", objectFit: "contain", margin: "0 auto 8px" }}
                      />
                    )}
                    <div style={{ fontWeight: "bold", fontSize: "14px", textTransform: "uppercase", marginBottom: "4px" }}>
                      {settings?.name || "ÉCOLE"}
                    </div>
                    {settings?.address && (
                      <div style={{ fontSize: "11px", marginBottom: "2px" }}>{settings.address}</div>
                    )}
                    <div style={{ fontSize: "11px" }}>
                      {[settings?.phone, settings?.email].filter(Boolean).join(" | ")}
                    </div>
                  </div>

                  {/* Dashed separator */}
                  <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

                  {/* Receipt title */}
                  <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>
                    *** FICHE D'INSCRIPTION ***
                  </div>
                  <div style={{ textAlign: "center", fontSize: "11px", marginBottom: "8px" }}>
                    Année : {paymentSlipData.yearName}
                  </div>

                  <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

                  {/* Student info */}
                  <div style={{ marginBottom: "8px", fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <span style={{ paddingRight: "8px" }}>Élève:</span>
                      <span style={{ fontWeight: "bold", textAlign: "right", wordBreak: "break-word" }}>{paymentSlipData.studentName}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <span style={{ paddingRight: "8px" }}>Classe:</span>
                      <span style={{ fontWeight: "bold", textAlign: "right", wordBreak: "break-word" }}>{paymentSlipData.className}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ paddingRight: "8px" }}>Date:</span>
                      <span style={{ textAlign: "right" }}>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                  </div>

                  {/* Invoices */}
                  {paymentSlipData.invoices.map((inv: any) => (
                    <div key={inv.id} style={{ marginTop: "12px" }}>
                      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
                      <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "6px" }}>
                        Facture #{inv.invoice_number}
                      </div>

                      {/* Line items */}
                      {inv.items && inv.items.length > 0 ? (
                        inv.items.map((item: any) => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px", fontSize: "11px" }}>
                            <span style={{ flex: 1, paddingRight: "8px", wordBreak: "break-word" }}>{item.description}</span>
                            <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>
                              {Number(item.amount).toLocaleString()} HTG
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px", fontSize: "11px" }}>
                          <span style={{ flex: 1, paddingRight: "8px" }}>Frais</span>
                          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{Number(inv.total_amount).toLocaleString()} HTG</span>
                        </div>
                      )}

                      {/* Subtotal line */}
                      <div style={{ borderTop: "1px solid #000", marginTop: "6px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11px" }}>
                        <span>Sous-total</span>
                        <span>{Number(inv.total_amount).toLocaleString()} HTG</span>
                      </div>

                      {/* Payment plan */}
                      {inv.plans && inv.plans.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <div style={{ fontSize: "11px", textTransform: "uppercase", marginBottom: "4px", fontWeight: "bold" }}>
                            Échéancier :
                          </div>
                          {inv.plans.map((plan: any) => (
                            <div key={plan.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "11px", marginBottom: "4px" }}>
                              <span style={{ flex: 1, paddingRight: "8px", wordBreak: "break-word" }}>
                                {plan.title}{plan.due_date ? ` (${format(new Date(plan.due_date), "dd/MM/yy")})` : ""}
                              </span>
                              <span style={{ whiteSpace: "nowrap" }}>{Number(plan.amount_due).toLocaleString()} HTG</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Grand total */}
                  <div style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000", margin: "12px 0", padding: "8px 0", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px" }}>
                    <span>TOTAL</span>
                    <span>{paymentSlipData.invoices.reduce((s: number, inv: any) => s + Number(inv.total_amount), 0).toLocaleString()} HTG</span>
                  </div>

                  {/* Signatures */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", fontSize: "11px" }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ borderTop: "1px solid #000", marginBottom: "4px", marginTop: "32px" }} />
                      Responsable
                    </div>
                    <div style={{ width: "16px" }} />
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ borderTop: "1px solid #000", marginBottom: "4px", marginTop: "32px" }} />
                      Parent/Tuteur
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ textAlign: "center", marginTop: "16px", fontSize: "11px" }}>
                    - Merci de conserver ce reçu -
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setPaymentSlipOpen(false)}>Fermer</Button>
                  <Button size="sm" onClick={() => window.print()}>
                    <Printer className="h-3.5 w-3.5 mr-2" />
                    Imprimer
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

