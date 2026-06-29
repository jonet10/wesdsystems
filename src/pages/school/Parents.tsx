import { useTranslation } from "react-i18next";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, User as UserIcon, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { ExportButtons } from "@/components/school/ExportButtons";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { useParents, useCreateParent, useUpdateParent, useDeleteParent } from "@/hooks/useSchoolData";
import type { SchoolParent } from "@/modules/school/types";

export default function SchoolParents() {
  const { t } = useTranslation();
  const { settings, activeAcademicYear } = useSchoolSettings();

  const { data: parents = [], isLoading } = useParents();
  const createParent = useCreateParent();
  const updateParent = useUpdateParent();
  const deleteParent = useDeleteParent();

  const [search, setSearch] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<SchoolParent | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setEditingParent(null);
    setFirstName(""); setLastName(""); setPhone(""); setEmail(""); setProfession(""); setAddress("");
  };

  const handleEdit = (p: SchoolParent) => {
    setEditingParent(p);
    setFirstName(p.first_name);
    setLastName(p.last_name);
    setPhone(p.phone || "");
    setEmail(p.email || "");
    setProfession(p.profession || "");
    setAddress(p.address || "");
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { toast.error("Veuillez saisir le prénom et le nom"); return; }
    setIsSaving(true);
    try {
      const payload = { first_name: firstName, last_name: lastName, phone: phone || null, email: email || null, profession: profession || null, address: address || null };
      if (editingParent) {
        await updateParent.mutateAsync({ id: editingParent.id, data: payload });
        toast.success("Parent mis à jour");
      } else {
        await createParent.mutateAsync(payload);
        toast.success("Parent ajouté");
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
    if (!confirm("Voulez-vous vraiment supprimer ce dossier parent ?")) return;
    try {
      await deleteParent.mutateAsync(id);
      toast.success("Parent supprimé");
    } catch (error: any) {
      toast.error("Impossible de supprimer", { description: "Ce parent est lié à un élève inscrit." });
    }
  };

  const filteredParents = parents.filter(p =>
    `${p.first_name} ${p.last_name} ${p.phone} ${p.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const exportColumns = [
    { header: "Prénom", accessorKey: "first_name" },
    { header: "Nom", accessorKey: "last_name" },
    { header: "Téléphone", accessorKey: "phone", cell: (p: any) => p.phone || "-" },
    { header: "Email", accessorKey: "email", cell: (p: any) => p.email || "-" },
    { header: "Profession", accessorKey: "profession", cell: (p: any) => p.profession || "-" },
    { header: "Adresse", accessorKey: "address", cell: (p: any) => p.address || "-" },
  ];

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Parents / Responsables</h1>
            <p className="text-muted-foreground">Gérez les dossiers des parents d'élèves et leurs contacts</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouveau Parent</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingParent ? "Modifier le dossier" : "Ajouter un parent"}</DialogTitle>
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
                <div className="space-y-2"><Label>Profession</Label><Input value={profession} onChange={e => setProfession(e.target.value)} /></div>
                <div className="space-y-2"><Label>Adresse</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement..." : "Enregistrer"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <div className="p-4 border-b flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, email, ou téléphone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <ExportButtons data={filteredParents} columns={exportColumns} title="Liste des Parents / Responsables" schoolSettings={settings} academicYearName={activeAcademicYear?.name || null} />
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent / Tuteur</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                ) : filteredParents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun parent trouvé.</TableCell></TableRow>
                ) : (
                  filteredParents.map((parent) => (
                    <TableRow key={parent.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>{parent.first_name} {parent.last_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground space-y-1">
                          {parent.phone && <span className="flex items-center"><Phone className="h-3 w-3 mr-1" /> {parent.phone}</span>}
                          {parent.email && <span className="flex items-center"><Mail className="h-3 w-3 mr-1" /> {parent.email}</span>}
                          {!parent.phone && !parent.email && "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{parent.profession || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(parent)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(parent.id)}><Trash2 className="h-4 w-4" /></Button>
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
