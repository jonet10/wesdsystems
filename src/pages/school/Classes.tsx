import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Layers, Users, EyeOff, Eye, Loader2, Landmark, Library, Milestone, CalendarClock, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/useSchool";
import { SchoolCapability } from "@/modules/school/engine/types";
import { classService } from "@/modules/school/services/classService";
import { DEFAULT_CLASSES, CYCLES } from "@/modules/school/defaultClasses";
import { setBusinessId } from "@/modules/school/services/utils";
import type { SchoolClass } from "@/modules/school/types";
import { ClassCurriculumDialog } from "./components/ClassCurriculumDialog";

export default function SchoolClasses() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const { engine } = useSchool();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [activeTab, setActiveTab] = useState("groups");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // School Engine Metadata Lists
  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);

  // Dialog & Form States for Study Groups (classes)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [cycleFilter, setCycleFilter] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  
  // Curriculum Dialog
  const [isCurriculumDialogOpen, setIsCurriculumDialogOpen] = useState(false);
  const [selectedClassForCurriculum, setSelectedClassForCurriculum] = useState<SchoolClass | null>(null);

  // Group Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cycle, setCycle] = useState("");
  const [section, setSection] = useState("");
  const [maxStudents, setMaxStudents] = useState<string>("");
  const [levelOrder, setLevelOrder] = useState("");
  const [selectedBaseClass, setSelectedBaseClass] = useState("");
  
  // Extended group form options
  const [groupExtValues, setGroupExtValues] = useState<Record<string, any>>({});
  const [groupFieldOptions, setGroupFieldOptions] = useState<Record<string, any[]>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Dialog & Form States for University/Vocational Metadata
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataType, setMetadataType] = useState<"faculty" | "department" | "program" | "semester" | "promotion">("faculty");
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [metadataName, setMetadataName] = useState("");
  const [metadataCode, setMetadataCode] = useState("");
  const [metadataParentId, setMetadataParentId] = useState("");

  useEffect(() => {
    if (businessId) setBusinessId(businessId);
  }, [businessId]);

  const loadData = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      await Promise.all([
        loadClasses(),
        loadMetadata()
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClasses = async () => {
    const [clsRes, enrollRes] = await Promise.all([
      supabase.from("school_classes")
        .select("*, program:program_id(name), option:option_id(name), semester:semester_id(name), promotion:promotion_id(name)")
        .eq("business_id", businessId)
        .order("level_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("school_enrollments")
        .select("class_id")
        .eq("business_id", businessId)
        .eq("status", "active"),
    ]);

    if (clsRes.error) throw clsRes.error;

    // Seeding is ONLY for CLASSIC type schools
    if (clsRes.data && clsRes.data.length === 0 && engine.getSchoolType() === "CLASSIC") {
      await seedClasses();
      return;
    }

    setClasses(clsRes.data || []);
    if (enrollRes.data) {
      const counts: Record<string, number> = {};
      enrollRes.data.forEach(e => { counts[e.class_id] = (counts[e.class_id] || 0) + 1; });
      setClassCounts(counts);
    }
  };

  const loadMetadata = async () => {
    if (!businessId) return;
    const [facs, depts, progs, sems, proms] = await Promise.all([
      engine.hasCapability(SchoolCapability.MANAGE_FACULTIES) ? supabase.from("school_faculties").select("*").eq("business_id", businessId).order("name") : null,
      engine.hasCapability(SchoolCapability.MANAGE_DEPARTMENTS) ? supabase.from("school_departments").select("*, faculty:faculty_id(name)").eq("business_id", businessId).order("name") : null,
      engine.hasCapability(SchoolCapability.MANAGE_PROGRAMS) ? supabase.from("school_programs").select("*, department:department_id(name)").eq("business_id", businessId).order("name") : null,
      engine.hasCapability(SchoolCapability.MANAGE_SEMESTERS) ? supabase.from("school_semesters").select("*").eq("business_id", businessId).order("name") : null,
      engine.hasCapability(SchoolCapability.MANAGE_COHORTS) ? supabase.from("school_promotions").select("*").eq("business_id", businessId).order("name", { ascending: false }) : null,
    ]);

    if (facs?.data) setFaculties(facs.data);
    if (depts?.data) setDepartments(depts.data);
    if (progs?.data) setPrograms(progs.data);
    if (sems?.data) setSemesters(sems.data);
    if (proms?.data) setPromotions(proms.data);
  };

  const seedClasses = async () => {
    setIsSeeding(true);
    try {
      const payloads = DEFAULT_CLASSES.map((c, i) => ({
        business_id: businessId,
        code: c.code,
        name: c.name,
        cycle: c.cycle,
        level_order: i + 1,
        section: null,
        max_students: null,
        active: true,
      }));

      const { error } = await supabase.from("school_classes").insert(payloads);
      if (error) throw error;
      toast.success("Classes initialisées par défaut");
      await loadClasses();
    } catch (err: any) {
      toast.error("Erreur de semence", { description: err.message });
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && businessId) {
      loadData();
    }
  }, [isAuthenticated, businessId, activeTab]);

  // Load dynamic select values for class dialog
  const classExtFields = engine.forms.getClassFormSchema();
  useEffect(() => {
    const fetchOptions = async () => {
      const opts: Record<string, any[]> = {};
      for (const field of classExtFields) {
        if (field.fetchOptions && businessId) {
          opts[field.name] = await field.fetchOptions(businessId, supabase);
        }
      }
      setGroupFieldOptions(opts);
    };
    if (isDialogOpen) fetchOptions();
  }, [isDialogOpen, businessId]);

  const resetForm = () => {
    setEditingClass(null);
    setName("");
    setCode("");
    setCycle("");
    setSection("");
    setMaxStudents("");
    setLevelOrder("");
    setSelectedBaseClass("");
    setGroupExtValues({});
  };

  const handleEditGroup = (cls: SchoolClass) => {
    setEditingClass(cls);
    setName(cls.name);
    setCode(cls.code || "");
    setCycle(cls.cycle || "");
    setSection(cls.section || "");
    setMaxStudents(cls.max_students ? cls.max_students.toString() : "");
    setLevelOrder(cls.level_order ? cls.level_order.toString() : "");

    const ext: Record<string, any> = {};
    classExtFields.forEach(f => {
      ext[f.name] = (cls as any)[f.name] || "";
    });
    setGroupExtValues(ext);

    setIsDialogOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    if (!name.trim()) { toast.error("Nom de groupe obligatoire"); return; }

    setIsSaving(true);
    try {
      const payload: any = {
        business_id: businessId,
        name,
        code: code || null,
        cycle: cycle || null,
        section: section || null,
        max_students: maxStudents ? parseInt(maxStudents) : null,
        level_order: levelOrder ? parseInt(levelOrder) : null,
      };

      classExtFields.forEach(f => {
        payload[f.name] = groupExtValues[f.name] || null;
      });

      // Verify custom plugin validations
      const validationError = engine.validation.validateClass(payload);
      if (validationError) {
        toast.error(validationError);
        setIsSaving(false);
        return;
      }

      if (editingClass) {
        const { error } = await supabase.from("school_classes").update(payload).eq("id", editingClass.id);
        if (error) throw error;
        toast.success("Mis à jour avec succès");
      } else {
        payload.active = true;
        const { error } = await supabase.from("school_classes").insert([payload]);
        if (error) throw error;
        toast.success("Ajouté avec succès");
      }

      setIsDialogOpen(false);
      resetForm();
      loadClasses();
    } catch (err: any) {
      toast.error("Erreur d'enregistrement", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (cls: SchoolClass) => {
    try {
      await classService.toggleActive(cls.id, !cls.active);
      toast.success(cls.active ? "Désactivé" : "Activé");
      loadClasses();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Voulez-vous supprimer définitivement ce groupe ?")) return;
    try {
      await classService.remove(id);
      toast.success("Supprimé");
      loadClasses();
    } catch (err: any) {
      toast.error("Suppression impossible, des inscriptions dépendent de ce groupe.");
    }
  };

  // CRUD for Metadata
  const openMetadataForm = (type: typeof metadataType, editing: any = null) => {
    setMetadataType(type);
    if (editing) {
      setEditingMetadataId(editing.id);
      setMetadataName(editing.name);
      setMetadataCode(editing.code || "");
      setMetadataParentId(editing.faculty_id || editing.department_id || "");
    } else {
      setEditingMetadataId(null);
      setMetadataName("");
      setMetadataCode("");
      setMetadataParentId("");
    }
    setMetadataDialogOpen(true);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadataName.trim()) return;

    const tableMap = {
      faculty: "school_faculties",
      department: "school_departments",
      program: "school_programs",
      semester: "school_semesters",
      promotion: "school_promotions"
    };

    const tableName = tableMap[metadataType];
    const payload: any = {
      business_id: businessId,
      name: metadataName,
      code: metadataCode || null
    };

    if (metadataType === "department") {
      payload.faculty_id = metadataParentId;
    } else if (metadataType === "program") {
      payload.department_id = metadataParentId || null;
    }

    try {
      if (editingMetadataId) {
        const { error } = await supabase.from(tableName).update(payload).eq("id", editingMetadataId);
        if (error) throw error;
        toast.success("Élément modifié");
      } else {
        const { error } = await supabase.from(tableName).insert([payload]);
        if (error) throw error;
        toast.success("Élément ajouté");
      }
      setMetadataDialogOpen(false);
      loadMetadata();
    } catch (err: any) {
      toast.error("Erreur d'enregistrement", { description: err.message });
    }
  };

  const handleDeleteMetadata = async (type: typeof metadataType, id: string) => {
    if (!confirm("Voulez-vous supprimer définitivement cet élément ?")) return;
    const tableMap = {
      faculty: "school_faculties",
      department: "school_departments",
      program: "school_programs",
      semester: "school_semesters",
      promotion: "school_promotions"
    };
    try {
      const { error } = await supabase.from(tableMap[type]).delete().eq("id", id);
      if (error) throw error;
      toast.success("Élément supprimé");
      loadMetadata();
    } catch (err: any) {
      toast.error("Erreur de suppression, des éléments enfants en dépendent.");
    }
  };

  const hasSpecializedMetadata =
    engine.hasCapability(SchoolCapability.MANAGE_FACULTIES) ||
    engine.hasCapability(SchoolCapability.MANAGE_DEPARTMENTS) ||
    engine.hasCapability(SchoolCapability.MANAGE_PROGRAMS) ||
    engine.hasCapability(SchoolCapability.MANAGE_COHORTS);

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Structures & Groupes d'études</h1>
            <p className="text-muted-foreground">Configurez la structure académique de votre établissement</p>
          </div>
        </div>

        {hasSpecializedMetadata ? (
          <Tabs defaultValue="groups" onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="groups"><Layers className="h-4 w-4 mr-2" />Groupes d'études</TabsTrigger>
              {engine.hasCapability(SchoolCapability.MANAGE_FACULTIES) && <TabsTrigger value="faculties"><Landmark className="h-4 w-4 mr-2" />Facultés</TabsTrigger>}
              {engine.hasCapability(SchoolCapability.MANAGE_DEPARTMENTS) && <TabsTrigger value="departments"><Library className="h-4 w-4 mr-2" />Départements</TabsTrigger>}
              {engine.hasCapability(SchoolCapability.MANAGE_PROGRAMS) && <TabsTrigger value="programs"><Layers className="h-4 w-4 mr-2" />Programmes</TabsTrigger>}
              {engine.hasCapability(SchoolCapability.MANAGE_SEMESTERS) && <TabsTrigger value="semesters"><CalendarClock className="h-4 w-4 mr-2" />Semestres</TabsTrigger>}
              {engine.hasCapability(SchoolCapability.MANAGE_COHORTS) && <TabsTrigger value="promotions"><Milestone className="h-4 w-4 mr-2" />Promotions</TabsTrigger>}
            </TabsList>

            {/* TAB: GROUPS */}
            <TabsContent value="groups" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Groupes d'études ({classes.length})</h3>
                <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouveau Groupe</Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Section</TableHead>
                        {engine.hasCapability(SchoolCapability.MANAGE_PROGRAMS) && <TableHead>Programme</TableHead>}
                        {engine.hasCapability(SchoolCapability.MANAGE_COHORTS) && <TableHead>Cohorte</TableHead>}
                        <TableHead>Membres</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classes.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun groupe créé.</TableCell></TableRow>
                      ) : (
                        classes.map((cls) => {
                          const used = classCounts[cls.id] || 0;
                          return (
                            <TableRow key={cls.id}>
                              <TableCell className="font-medium text-muted-foreground">{cls.code || "-"}</TableCell>
                              <TableCell className="font-bold">{cls.name}</TableCell>
                              <TableCell>{cls.section || "-"}</TableCell>
                              {engine.hasCapability(SchoolCapability.MANAGE_PROGRAMS) && <TableCell>{(cls as any).program?.name || "-"}</TableCell>}
                              {engine.hasCapability(SchoolCapability.MANAGE_COHORTS) && <TableCell>{(cls as any).promotion?.name || "-"}</TableCell>}
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" /> {used} {cls.max_students ? `/ ${cls.max_students}` : ""}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={cls.active !== false ? "success" : "outline"}>{cls.active !== false ? "Actif" : "Inactif"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleEditGroup(cls)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleToggleActive(cls)}>{cls.active !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: FACULTIES */}
            <TabsContent value="faculties" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Facultés</h3>
                <Button onClick={() => openMetadataForm("faculty")}><Plus className="h-4 w-4 mr-2" />Nouvelle Faculté</Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faculties.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8">Aucune faculté.</TableCell></TableRow>
                      ) : (
                        faculties.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-bold">{f.name}</TableCell>
                            <TableCell>{f.code || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openMetadataForm("faculty", f)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMetadata("faculty", f.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: DEPARTMENTS */}
            <TabsContent value="departments" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Départements d'études</h3>
                <Button onClick={() => openMetadataForm("department")}><Plus className="h-4 w-4 mr-2" />Nouveau Département</Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Faculté de rattachement</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8">Aucun département.</TableCell></TableRow>
                      ) : (
                        departments.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-bold">{d.name}</TableCell>
                            <TableCell>{d.faculty?.name || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openMetadataForm("department", d)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMetadata("department", d.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: PROGRAMS */}
            <TabsContent value="programs" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Programmes académiques / Filières</h3>
                <Button onClick={() => openMetadataForm("program")}><Plus className="h-4 w-4 mr-2" />Nouveau Programme</Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Département associé</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {programs.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8">Aucun programme.</TableCell></TableRow>
                      ) : (
                        programs.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-bold">{p.name}</TableCell>
                            <TableCell>{p.department?.name || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openMetadataForm("program", p)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMetadata("program", p.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: SEMESTERS */}
            <TabsContent value="semesters" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Semestres</h3>
                <Button onClick={() => openMetadataForm("semester")}><Plus className="h-4 w-4 mr-2" />Nouveau Semestre</Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semesters.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8">Aucun semestre.</TableCell></TableRow>
                      ) : (
                        semesters.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-bold">{s.name}</TableCell>
                            <TableCell>{s.code || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openMetadataForm("semester", s)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMetadata("semester", s.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: PROMOTIONS */}
            <TabsContent value="promotions" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-sans">Promotions / Cohortes</h3>
                <Button onClick={() => openMetadataForm("promotion")}><Plus className="h-4 w-4 mr-2" />Nouvelle Promotion</Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom de la promotion</TableHead>
                        <TableHead>Code de cohorte</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promotions.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8">Aucune promotion.</TableCell></TableRow>
                      ) : (
                        promotions.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-bold">{p.name}</TableCell>
                            <TableCell>{p.code || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openMetadataForm("promotion", p)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMetadata("promotion", p.id)}><Trash2 className="h-4 w-4" /></Button>
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
        ) : (
          /* CLASSIC SINGLE TABLE VIEW */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Classes ({classes.length})</h3>
              <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle Classe</Button>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Membres</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => {
                      const used = classCounts[cls.id] || 0;
                      return (
                        <TableRow key={cls.id}>
                          <TableCell className="font-medium text-muted-foreground">{cls.code || "-"}</TableCell>
                          <TableCell className="font-bold">{cls.name}</TableCell>
                          <TableCell>{cls.cycle || "-"}</TableCell>
                          <TableCell>{cls.section || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" /> {used} {cls.max_students ? `/ ${cls.max_students}` : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={cls.active !== false ? "success" : "outline"}>{cls.active !== false ? "Active" : "Inactive"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" title="Programme" onClick={() => { setSelectedClassForCurriculum(cls); setIsCurriculumDialogOpen(true); }}>
                              <BookOpen className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEditGroup(cls)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(cls)}>{cls.active !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── DIALOG FOR GROUP (STUDY CLASS) ── */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingClass ? "Modifier" : "Créer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveGroup} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="ex: 7ème AF" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="ex: 7AF" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input id="section" value={section} onChange={e => setSection(e.target.value)} placeholder="ex: A" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStudents">Capacité Max</Label>
                  <Input id="maxStudents" type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} />
                </div>
              </div>

              {engine.getSchoolType() === "CLASSIC" && (
                <div className="space-y-2">
                  <Label htmlFor="cycle">Cycle</Label>
                  <select
                    id="cycle"
                    value={cycle}
                    onChange={e => setCycle(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner</option>
                    {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Dynamic Plugin Fields (Faculty, Program, Semester, etc.) */}
              {classExtFields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                  <select
                    value={groupExtValues[field.name] || ""}
                    onChange={(e) => setGroupExtValues(p => ({ ...p, [field.name]: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required={field.required}
                  >
                    <option value="">Sélectionner</option>
                    {(groupFieldOptions[field.name] || field.options || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex justify-end pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement..." : "Soumettre"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── DIALOG FOR UNIVERSITY/VOCATIONAL METADATA ── */}
        <Dialog open={metadataDialogOpen} onOpenChange={setMetadataDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMetadataId ? "Modifier" : "Créer"} {
                  metadataType === "faculty" ? "la Faculté" :
                  metadataType === "department" ? "le Département" :
                  metadataType === "program" ? "le Programme" :
                  metadataType === "semester" ? "le Semestre" : "la Promotion"
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveMetadata} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="metaName">Nom</Label>
                <Input id="metaName" value={metadataName} onChange={e => setMetadataName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaCode">Code / Réf</Label>
                <Input id="metaCode" value={metadataCode} onChange={e => setMetadataCode(e.target.value)} />
              </div>

              {metadataType === "department" && (
                <div className="space-y-2">
                  <Label>Faculté de rattachement</Label>
                  <select
                    value={metadataParentId}
                    onChange={e => setMetadataParentId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {metadataType === "program" && engine.hasCapability(SchoolCapability.MANAGE_DEPARTMENTS) && (
                <div className="space-y-2">
                  <Label>Département de rattachement</Label>
                  <select
                    value={metadataParentId}
                    onChange={e => setMetadataParentId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner (optionnel)</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.faculty?.name})</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setMetadataDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit">Soumettre</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* CURRICULUM DIALOG */}
        {selectedClassForCurriculum && (
          <ClassCurriculumDialog
            open={isCurriculumDialogOpen}
            onOpenChange={setIsCurriculumDialogOpen}
            classId={selectedClassForCurriculum.id}
            className={selectedClassForCurriculum.name}
            businessId={businessId!}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
