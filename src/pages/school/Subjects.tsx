import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useClasses } from "@/hooks/useSchoolData";
import type { SchoolSubject } from "@/modules/school/types";
import { DomainsTab } from "./components/DomainsTab";

export default function SchoolSubjects() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SchoolSubject | null>(null);

  // Form
  const [name, setName] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: classes = [] } = useClasses();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const loadSubjects = async () => {
    if (!businessId) return;
    try {
      const { data, error } = await supabase
        .from("school_subjects")
        .select("*, school_subject_classes(class_id, school_classes(name))")
        .eq("business_id", businessId)
        .order("name", { ascending: true });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadSubjects();
  }, [isAuthenticated, businessId]);

  const resetForm = () => {
    setEditingSubject(null);
    setName("");
    setSelectedClassIds([]);
  };

  const handleEdit = (subject: SchoolSubject) => {
    setEditingSubject(subject);
    setName(subject.name);
    
    const linkedIds = subject.school_subject_classes?.map(sc => sc.class_id) || [];
    if (linkedIds.length === 0 && subject.class_id) {
      linkedIds.push(subject.class_id);
    }
    setSelectedClassIds(linkedIds);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Veuillez saisir le nom de la matière");
      return;
    }
    if (!businessId) return;

    setIsSaving(true);
    try {
      if (editingSubject) {
        // 1. Update subject name
        const { error: subjectError } = await supabase
          .from("school_subjects")
          .update({ name: name.trim() })
          .eq("id", editingSubject.id);

        if (subjectError) throw subjectError;

        // 2. Delete existing class relations
        const { error: deleteError } = await supabase
          .from("school_subject_classes")
          .delete()
          .eq("subject_id", editingSubject.id);

        if (deleteError) throw deleteError;

        // 3. Insert new class relations
        if (selectedClassIds.length > 0) {
          const insertPayload = selectedClassIds.map(cid => ({
            business_id: businessId,
            subject_id: editingSubject.id,
            class_id: cid
          }));
          const { error: insertError } = await supabase
            .from("school_subject_classes")
            .insert(insertPayload);
          
          if (insertError) throw insertError;
        }

        toast.success("Matière mise à jour");
      } else {
        // 1. Insert subject
        const { data: newSubject, error: subjectError } = await supabase
          .from("school_subjects")
          .insert([{ business_id: businessId, name: name.trim() }])
          .select("id")
          .single();

        if (subjectError) throw subjectError;

        // 2. Insert class relations
        if (selectedClassIds.length > 0 && newSubject) {
          const insertPayload = selectedClassIds.map(cid => ({
            business_id: businessId,
            subject_id: newSubject.id,
            class_id: cid
          }));
          const { error: insertError } = await supabase
            .from("school_subject_classes")
            .insert(insertPayload);
          
          if (insertError) throw insertError;
        }

        toast.success("Matière ajoutée");
      }
      setIsDialogOpen(false);
      resetForm();
      loadSubjects();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette matière ?\nCette action peut échouer si la matière est assignée à des cours.")) return;
    try {
      const { error } = await supabase
        .from("school_subjects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Matière supprimée");
      loadSubjects();
    } catch (error: any) {
      toast.error("Impossible de supprimer la matière", { description: error.message });
    }
  };

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    
    const subjectClassIds = s.school_subject_classes?.map(sc => sc.class_id) || [];
    if (subjectClassIds.length === 0 && s.class_id) {
      subjectClassIds.push(s.class_id);
    }

    const matchesClass = selectedClassFilter === "all"
      ? true
      : selectedClassFilter === "none"
        ? subjectClassIds.length === 0
        : subjectClassIds.includes(selectedClassFilter);
    return matchesSearch && matchesClass;
  });

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Catalogue des Matières</h1>
            <p className="text-muted-foreground">Gérez la liste globale des matières enseignées dans l'établissement</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouvelle Matière</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSubject ? "Modifier la matière" : "Ajouter une matière"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="space-y-2 font-medium">
                  <Label>Nom de la Matière</Label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ex: Français, Mathématiques, Physique..."
                    autoFocus 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Classes associées</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-zinc-800 rounded-md p-3 bg-zinc-900/40">
                    {classes.length === 0 ? (
                      <p className="text-xs text-muted-foreground col-span-2">Aucune classe disponible</p>
                    ) : (
                      classes.map((cls: any) => {
                        const isChecked = selectedClassIds.includes(cls.id);
                        return (
                          <div key={cls.id} className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              id={`class-${cls.id}`} 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClassIds(prev => [...prev, cls.id]);
                                } else {
                                  setSelectedClassIds(prev => prev.filter(id => id !== cls.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary"
                            />
                            <label htmlFor={`class-${cls.id}`} className="text-xs select-none cursor-pointer font-medium leading-none text-zinc-300">
                              {cls.name}
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="subjects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subjects">
              <BookOpen className="h-4 w-4 mr-2" /> Matières
            </TabsTrigger>
            <TabsTrigger value="domains">
              <Layers className="h-4 w-4 mr-2" /> Domaines de Compétences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher une matière..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="pl-9" 
                  />
                </div>
                <select
                  value={selectedClassFilter}
                  onChange={e => setSelectedClassFilter(e.target.value)}
                  className="flex h-10 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="all">Toutes les classes</option>
                  <option value="none">Générale / Non assignée</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                    ) : filteredSubjects.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Aucune matière trouvée.</TableCell></TableRow>
                    ) : (
                      filteredSubjects.map((subject) => (
                        <TableRow key={subject.id}>
                          <TableCell className="font-semibold flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-primary" />
                            </div>
                            {subject.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {(() => {
                              const linkedClasses = subject.school_subject_classes
                                ?.map(sc => sc.school_classes?.name)
                                .filter(Boolean) || [];
                              
                              if (linkedClasses.length === 0 && subject.class_id) {
                                const legacyClass = classes.find((c: any) => c.id === subject.class_id);
                                if (legacyClass) linkedClasses.push(legacyClass.name);
                              }

                              return linkedClasses.length > 0 
                                ? linkedClasses.join(", ") 
                                : "Générale / Non assignée";
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(subject)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(subject.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domains">
            <DomainsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
