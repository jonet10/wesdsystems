import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CalendarDays, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { SchoolAcademicYear, SchoolFee } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolAcademicYears() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const [years, setYears] = useState<SchoolAcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<SchoolAcademicYear | null>(null);

  // Form
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const loadYears = async () => {
    if (!businessId) return;
    try {
      const { data, error } = await supabase
        .from("school_academic_years")
        .select("*")
        .eq("business_id", businessId)
        .order("name", { ascending: false });

      if (error) throw error;
      setYears(data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadYears();
  }, [isAuthenticated, businessId]);

  const generateYears = async () => {
    if (!businessId) return;
    if (!confirm("Générer 5 années académiques à partir de 2026-2027 ?")) return;
    setIsGenerating(true);
    try {
      const baseYear = 2026;
      const payloads = Array.from({ length: 5 }, (_, i) => {
        const start = baseYear + i;
        const end = start + 1;
        return {
          business_id: businessId,
          name: `${start}-${end}`,
          start_date: `${start}-09-01`,
          end_date: `${end}-08-31`,
          active: i === 0,
        };
      });

      const { error } = await supabase
        .from("school_academic_years")
        .insert(payloads);

      if (error) throw error;
      toast.success("5 années générées avec succès (2026-2031)");
      loadYears();
    } catch (error: any) {
      toast.error("Erreur de génération", { description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setEditingYear(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setActive(false);
  };

  const handleEdit = (year: SchoolAcademicYear) => {
    setEditingYear(year);
    setName(year.name);
    setStartDate(year.start_date?.split("T")[0] || "");
    setEndDate(year.end_date?.split("T")[0] || "");
    setActive(year.active);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) { toast.error("Erreur de session (businessId manquant)"); return; }

    setIsSaving(true);
    try {
      if (active) {
        await supabase
          .from("school_academic_years")
          .update({ active: false })
          .eq("business_id", businessId);
      }

      const payload = {
        business_id: businessId,
        name,
        start_date: startDate || null,
        end_date: endDate || null,
        active,
      };

      if (editingYear) {
        const { error } = await supabase
          .from("school_academic_years")
          .update(payload)
          .eq("id", editingYear.id);
        if (error) throw error;
        toast.success("Année académique mise à jour");
      } else {
        const { error } = await supabase
          .from("school_academic_years")
          .insert([payload]);
        if (error) throw error;
        toast.success("Année académique ajoutée");
      }

      setIsDialogOpen(false);
      resetForm();
      loadYears();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette année académique ?")) return;
    try {
      const { error } = await supabase
        .from("school_academic_years")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Année supprimée");
      loadYears();
    } catch (error: any) {
      toast.error("Impossible de supprimer", { description: "Cette année est liée à des inscriptions." });
    }
  };

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Années Académiques</h1>
            <p className="text-muted-foreground">
              Gérez les années scolaires et définissez l'année en cours
            </p>
          </div>

          <div className="flex gap-2">
            {years.length === 0 && !isLoading && (
              <Button variant="outline" onClick={generateYears} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Générer 2026-2031
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Année
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingYear ? "Modifier l'année" : "Ajouter une année"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom (ex: 2026-2027)</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="2026-2027" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Date de début</Label>
                      <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Date de fin</Label>
                      <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg mt-2">
                    <div className="space-y-0.5">
                      <Label>Année en cours</Label>
                      <p className="text-sm text-muted-foreground">
                        Définir comme année académique active
                      </p>
                    </div>
                    <Switch checked={active} onCheckedChange={setActive} />
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
        </div>

        {!isLoading && years.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">Aucune année académique</p>
              <p className="text-sm mb-6">Cliquez sur "Générer 2026-2031" pour créer les 5 prochaines années ou ajoutez-les manuellement.</p>
            </CardContent>
          </Card>
        )}

        {years.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom de l'année</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {years.map((year) => (
                    <TableRow key={year.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                          {year.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {year.start_date && year.end_date
                          ? `${format(new Date(year.start_date), "dd/MM/yyyy")} au ${format(new Date(year.end_date), "dd/MM/yyyy")}`
                          : "Non défini"
                        }
                      </TableCell>
                      <TableCell>
                        {year.active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                            En cours
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            Archivé / Futur
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(year)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(year.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
