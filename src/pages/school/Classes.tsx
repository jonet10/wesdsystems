import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { SchoolClass } from "@/modules/school/types";

export default function SchoolClasses() {
  const { user, profile, isAuthenticated } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  // Form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cycle, setCycle] = useState("");
  const [level, setLevel] = useState("");
  const [levelOrder, setLevelOrder] = useState("");
  const [section, setSection] = useState("");
  const [maxStudents, setMaxStudents] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const loadClasses = async () => {
    if (!businessId) return;
    try {
      const { data, error } = await supabase
        .from("school_classes")
        .select("*")
        .eq("business_id", businessId)
        .order("level_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadClasses();
    }
  }, [isAuthenticated, businessId]);

  const resetForm = () => {
    setEditingClass(null);
    setName("");
    setCode("");
    setCycle("");
    setLevel("");
    setLevelOrder("");
    setSection("");
    setMaxStudents("");
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
    if (!businessId) {
      toast.error("Erreur de session (businessId manquant)");
      return;
    }

    if (!name.trim()) {
      toast.error("Veuillez saisir le nom de la classe");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        name,
        code: code || null,
        cycle: cycle || null,
        level: level || null,
        level_order: levelOrder ? parseInt(levelOrder) : null,
        section: section || null,
        max_students: maxStudents ? parseInt(maxStudents) : null,
      };

      if (editingClass) {
        const { error } = await supabase
          .from("school_classes")
          .update(payload)
          .eq("id", editingClass.id);
        if (error) throw error;
        toast.success("Classe mise à jour");
      } else {
        const { error } = await supabase
          .from("school_classes")
          .insert([payload]);
        if (error) throw error;
        toast.success("Classe ajoutée");
      }

      setIsDialogOpen(false);
      resetForm();
      loadClasses();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette classe ?")) return;
    try {
      const { error } = await supabase
        .from("school_classes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Classe supprimée");
      loadClasses();
    } catch (error: any) {
      toast.error("Impossible de supprimer", { description: "Cette classe contient des élèves ou des plans de paiements." });
    }
  };

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Classes & Niveaux</h1>
            <p className="text-muted-foreground">
              Configurez les différentes salles de classe de l'établissement
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
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
                    <Label htmlFor="cycle">Cycle</Label>
                    <select
                      id="cycle"
                      value={cycle}
                      onChange={e => setCycle(e.target.value)}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Sélectionner un cycle...</option>
                      <option value="Préscolaire">Préscolaire</option>
                      <option value="Fondamental 1er Cycle">Fondamental 1er Cycle</option>
                      <option value="Fondamental 2e Cycle">Fondamental 2e Cycle</option>
                      <option value="Fondamental 3e Cycle">Fondamental 3e Cycle</option>
                      <option value="Secondaire Nouveau">Secondaire Nouveau</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section">Section</Label>
                    <Input id="section" value={section} onChange={e => setSection(e.target.value)} placeholder="ex: A, B, C..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="levelOrder">Ordre d'affichage</Label>
                    <Input id="levelOrder" type="number" value={levelOrder} onChange={e => setLevelOrder(e.target.value)} placeholder="ex: 10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStudents">Capacité (Optionnel)</Label>
                    <Input id="maxStudents" type="number" min="1" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} placeholder="ex: 40" />
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

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : classes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucune classe configurée.
                    </TableCell>
                  </TableRow>
                ) : (
                  classes.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {cls.code || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                          {cls.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cls.cycle || cls.level || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cls.section ? (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                            {cls.section}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          {cls.max_students ? `${cls.max_students} places` : "Non défini"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(cls)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cls.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
