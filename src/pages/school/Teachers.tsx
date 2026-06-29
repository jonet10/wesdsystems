import { useTranslation } from "react-i18next";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, UserCheck, BookOpen, Phone } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ExportButtons } from "@/components/school/ExportButtons";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { useTeachers, useCreateTeacher, useUpdateTeacher, useDeleteTeacher } from "@/hooks/useSchoolData";
import type { SchoolTeacher } from "@/modules/school/types";

export default function SchoolTeachers() {
  const { t } = useTranslation();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const { format: formatAmount } = useCurrency();

  const { data: teachers = [], isLoading } = useTeachers();
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();

  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<SchoolTeacher | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subjects, setSubjects] = useState("");
  const [salary, setSalary] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setEditingTeacher(null);
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setSubjects("");
    setSalary("");
    setHireDate("");
    setActive(true);
  };

  const handleEdit = (t: SchoolTeacher) => {
    setEditingTeacher(t);
    setFirstName(t.first_name);
    setLastName(t.last_name);
    setPhone(t.phone || "");
    setEmail(t.email || "");
    setSubjects(t.subjects?.join(", ") || "");
    setSalary(t.salary ? t.salary.toString() : "");
    setHireDate(t.hire_date ? t.hire_date.split("T")[0] : "");
    setActive(t.active);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { toast.error("Veuillez saisir le prénom et le nom"); return; }
    setIsSaving(true);
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        subjects: subjects ? subjects.split(",").map(s => s.trim()).filter(s => s) : null,
        salary: salary ? parseFloat(salary) : 0,
        hire_date: hireDate || null,
        active,
      };
      if (editingTeacher) {
        await updateTeacher.mutateAsync({ id: editingTeacher.id, data: payload });
        toast.success("Professeur mis à jour");
      } else {
        await createTeacher.mutateAsync(payload);
        toast.success("Professeur ajouté");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce professeur ?")) return;
    try {
      await deleteTeacher.mutateAsync(id);
      toast.success("Professeur supprimé");
    } catch (error: any) {
      toast.error("Impossible de supprimer");
    }
  };

  const allSubjects = Array.from(new Set(teachers.flatMap(t => t.subjects || []))).sort();
  const filteredTeachers = teachers.filter(t => {
    if (search && !`${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSubject !== "all" && !(t.subjects || []).includes(filterSubject)) return false;
    if (filterStatus !== "all" && (filterStatus === "active" ? !t.active : t.active)) return false;
    return true;
  });

  const exportColumns = [
    { header: "Prénom", accessorKey: "first_name" },
    { header: "Nom", accessorKey: "last_name" },
    { header: "Téléphone", accessorKey: "phone", cell: (t: any) => t.phone || "-" },
    { header: "Email", accessorKey: "email", cell: (t: any) => t.email || "-" },
    { header: "Matières", accessorKey: "subjects", cell: (t: any) => t.subjects?.join(", ") || "-" },
    { header: "Actif", accessorKey: "active", cell: (t: any) => t.active ? "Oui" : "Non" },
  ];

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Corps Enseignant</h1>
            <p className="text-muted-foreground">Gérez les dossiers des professeurs et leurs matières</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouveau Professeur</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingTeacher ? "Modifier le dossier" : "Ajouter un professeur"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Prénom</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Nom de famille</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{t("common.phone")}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
                  <div className="space-y-2"><Label>{t("common.email")}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Matières enseignées (séparées par une virgule)</Label>
                  <Input value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="Mathématiques, Physique..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Salaire</Label><Input type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Date d'embauche</Label><Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} /></div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg mt-2">
                  <div className="space-y-0.5">
                    <Label>Professeur Actif</Label>
                    <p className="text-sm text-muted-foreground">Est-ce qu'il donne toujours cours ?</p>
                  </div>
                  <Switch checked={active} onCheckedChange={setActive} />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement..." : "Enregistrer"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4 bg-muted/30">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="all">Toutes les matières</option>
                {allSubjects.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>
            <ExportButtons data={filteredTeachers} columns={exportColumns} title="Liste des Professeurs" schoolSettings={settings} academicYearName={activeAcademicYear?.name || null} />
          </div>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professeur</TableHead>
                  <TableHead>Matières</TableHead>
                  <TableHead>Salaire / Frais</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                ) : filteredTeachers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun professeur trouvé.</TableCell></TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <UserCheck className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{teacher.first_name} {teacher.last_name}</div>
                            {teacher.phone && <div className="text-xs text-muted-foreground flex items-center mt-1"><Phone className="h-3 w-3 mr-1" /> {teacher.phone}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <BookOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-muted-foreground">{teacher.subjects?.length ? teacher.subjects.join(", ") : "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{teacher.salary ? formatAmount(teacher.salary) : "-"}</TableCell>
                      <TableCell>
                        {teacher.active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">Actif</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Inactif</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(teacher)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(teacher.id)}><Trash2 className="h-4 w-4" /></Button>
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
