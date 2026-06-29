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
import { Plus, Pencil, Trash2, Layers, Users, EyeOff, Eye, Sparkles, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { classService } from "@/modules/school/services/classService";
import { DEFAULT_CLASSES, CYCLES } from "@/modules/school/defaultClasses";
import { setBusinessId } from "@/modules/school/services/utils";
import type { SchoolClass } from "@/modules/school/types";

export default function SchoolClasses() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [cycleFilter, setCycleFilter] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cycle, setCycle] = useState("");
  const [level, setLevel] = useState("");
  const [levelOrder, setLevelOrder] = useState("");
  const [section, setSection] = useState("");
  const [maxStudents, setMaxStudents] = useState<string>("");
  const [selectedBaseClass, setSelectedBaseClass] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const defaultClassesForCycle = cycle
    ? DEFAULT_CLASSES.filter(c => c.cycle === cycle)
    : [];

  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  useEffect(() => {
    if (businessId) setBusinessId(businessId);
  }, [businessId]);

  const loadClasses = async () => {
    if (!businessId) return;
    try {
      const [clsRes, enrollRes] = await Promise.all([
        supabase.from("school_classes")
          .select("*")
          .eq("business_id", businessId)
          .order("level_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("school_enrollments")
          .select("class_id")
          .eq("business_id", businessId)
          .eq("status", "active"),
      ]);
      if (clsRes.error) throw clsRes.error;

      if (clsRes.data && clsRes.data.length === 0) {
        await seedClasses();
        return;
      }

      setClasses(clsRes.data || []);
      if (enrollRes.data) {
        const counts: Record<string, number> = {};
        enrollRes.data.forEach(e => { counts[e.class_id] = (counts[e.class_id] || 0) + 1; });
        setClassCounts(counts);
      }
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const seedClasses = async () => {
    if (!businessId) return;
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

      const { error } = await supabase
        .from("school_classes")
        .insert(payloads);
      if (error) throw error;
      toast.success("16 classes du système haïtien ajoutées", {
        description: "Vous pouvez maintenant ajouter des sections (A, B, C...)."
      });
      loadClasses();
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
      setIsLoading(false);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadClasses();
  }, [isAuthenticated, businessId]);

  const handleBaseClassChange = (val: string) => {
    setSelectedBaseClass(val);
    if (val) {
      const found = DEFAULT_CLASSES.find(c => c.code === val);
      if (found) {
        setName(found.name);
        setCode(found.code);
        setLevelOrder(found.level_order.toString());
      }
    }
  };

  const resetForm = () => {
    setEditingClass(null);
    setName("");
    setCode("");
    setCycle("");
    setLevel("");
    setLevelOrder("");
    setSection("");
    setMaxStudents("");
    setSelectedBaseClass("");
  };

  const handleEdit = (cls: SchoolClass) => {
    setEditingClass(cls);
    setName(cls.name);
    setCode(cls.code || "");
    setCycle(cls.cycle || "");
    setLevel(cls.level || "");
    setLevelOrder(cls.level_order ? cls.level_order.toString() : "");
    setSection(cls.section || "");
    setMaxStudents(cls.max_students ? cls.max_students.toString() : "");
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) { toast.error("Erreur de session"); return; }
    if (!name.trim()) { toast.error("Veuillez saisir le nom de la classe"); return; }

    setIsSaving(true);
    try {
      const payload: Partial<SchoolClass> = {
        name,
        code: code || null,
        cycle: cycle || null,
        level: level || null,
        level_order: levelOrder ? parseInt(levelOrder) : null,
        section: section || null,
        max_students: maxStudents ? parseInt(maxStudents) : null,
      };

      if (editingClass) {
        await classService.update(editingClass.id, payload);
        toast.success("Classe mise à jour");
      } else {
        await classService.create({ ...payload, active: true });
        toast.success("Classe ajoutée");
      }

      setIsDialogOpen(false);
      resetForm();
      loadClasses();
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (cls: SchoolClass) => {
    try {
      await classService.toggleActive(cls.id, !cls.active);
      toast.success(cls.active ? "Classe désactivée" : "Classe activée");
      loadClasses();
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer définitivement cette classe ?")) return;
    try {
      await classService.remove(id);
      toast.success("Classe supprimée");
      loadClasses();
    } catch (error: any) {
      toast.error("Impossible de supprimer", { description: "Cette classe contient des inscriptions." });
    }
  };

  const filteredClasses = classes.filter(c => {
    if (cycleFilter && c.cycle !== cycleFilter) return false;
    if (!showInactive && c.active === false) return false;
    return true;
  });

  const isActive = (cls: SchoolClass) => cls.active !== false;

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Classes & Niveaux</h1>
            <p className="text-muted-foreground">
              Configurez les classes selon le système éducatif haïtien
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Classe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingClass ? "Modifier la classe" : "Ajouter une classe"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="cycle">Cycle</Label>
                    <select
                      id="cycle"
                      value={cycle}
                      onChange={e => {
                        setCycle(e.target.value);
                        setSelectedBaseClass("");
                        if (!editingClass) { setName(""); setCode(""); setLevelOrder(""); }
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Sélectionner un cycle...</option>
                      {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {!editingClass && defaultClassesForCycle.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="baseClass">Classe de base</Label>
                      <select
                        id="baseClass"
                        value={selectedBaseClass}
                        onChange={e => handleBaseClassChange(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Choisir une classe...</option>
                        {defaultClassesForCycle.map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">Sélectionnez une classe de base ou saisissez manuellement.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom de la classe</Label>
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
                      <Input id="section" value={section} onChange={e => setSection(e.target.value)} placeholder="ex: A, B, C..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxStudents">Capacité max</Label>
                      <Input id="maxStudents" type="number" min="1" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} placeholder="ex: 40" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="levelOrder">Ordre d'affichage</Label>
                      <Input id="levelOrder" type="number" value={levelOrder} onChange={e => setLevelOrder(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <button
              onClick={() => setCycleFilter("")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!cycleFilter ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
            >Tous</button>
            {CYCLES.map(c => (
              <button
                key={c}
                onClick={() => setCycleFilter(c)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${cycleFilter === c ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
              >{c}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="showInactive" className="text-xs text-muted-foreground">Masquées</Label>
            <Switch id="showInactive" checked={showInactive} onCheckedChange={setShowInactive} />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Élèves</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isSeeding ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {isSeeding ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Ajout des classes par défaut...</span>
                      ) : "Chargement..."}
                    </TableCell>
                  </TableRow>
                ) : filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune classe trouvée pour ce filtre.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((cls) => {
                    const used = classCounts[cls.id] || 0;
                    const capacity = cls.max_students || 0;
                    const isFull = capacity > 0 && used >= capacity;
                    return (
                      <TableRow key={cls.id} className={!isActive(cls) ? "opacity-50" : ""}>
                        <TableCell className="font-medium text-muted-foreground">
                          {cls.code || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                            {cls.name}
                            {cls.section && <Badge variant="outline" className="ml-2 text-xs">{cls.section}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {cls.cycle || "-"}
                        </TableCell>
                        <TableCell>{cls.section || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className={isFull ? "text-destructive font-bold" : "font-medium"}>{used}</span>
                            {capacity > 0 && <span className="text-xs text-muted-foreground">/ {capacity}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isActive(cls) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              <EyeOff className="h-3 w-3 mr-1" />Inactive
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                              <Eye className="h-3 w-3 mr-1" />Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(cls)} title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleActive(cls)} title={isActive(cls) ? "Désactiver" : "Activer"}>
                            {isActive(cls) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cls.id)} title="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Classes par défaut :</strong> {DEFAULT_CLASSES.length} classes du système éducatif haïtien ajoutées automatiquement.</p>
          <p><strong>Sections :</strong> Créez des sections comme "7AF A", "7AF B" en modifiant le nom et la section.</p>
          <p><strong>Désactivation :</strong> Utilisez l'icône œil pour masquer une classe sans perdre les inscriptions liées.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
