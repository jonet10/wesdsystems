import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, User as UserIcon, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { SchoolStudent } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolStudents() {
  const { user, profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadStudents = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("school_students")
        .select("*")
        .eq("business_id", businessId)
        .order("last_name", { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadStudents();
  }, [isAuthenticated, businessId]);

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<SchoolStudent | null>(null);
  const [matricule, setMatricule] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("active");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setEditingStudent(null);
    setMatricule("");
    setFirstName("");
    setLastName("");
    setGender("");
    setDob("");
    setPhone("");
    setAddress("");
    setStatus("active");
  };

  const handleEdit = (s: SchoolStudent) => {
    setEditingStudent(s);
    setMatricule(s.matricule || "");
    setFirstName(s.first_name);
    setLastName(s.last_name);
    setGender(s.gender || "");
    setDob(s.dob ? s.dob.split("T")[0] : "");
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setStatus(s.status);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      toast.error("Erreur de session (businessId manquant)");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Veuillez saisir le prénom et le nom");
      return;
    }

    if (!status) {
      toast.error("Veuillez sélectionner un statut");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        matricule: matricule || null,
        first_name: firstName,
        last_name: lastName,
        gender: gender || null,
        dob: dob || null,
        phone: phone || null,
        address: address || null,
        status: status as any,
      };

      if (editingStudent) {
        await supabase.from("school_students").update(payload).eq("id", editingStudent.id);
        toast.success("Élève mis à jour");
      } else {
        await supabase.from("school_students").insert([payload]);
        toast.success("Élève ajouté");
      }

      setIsDialogOpen(false);
      resetForm();
      loadStudents();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet élève ? (Cette action effacera ses factures)")) return;
    try {
      await supabase.from("school_students").delete().eq("id", id);
      toast.success("Élève supprimé");
      loadStudents();
    } catch (error: any) {
      toast.error("Impossible de supprimer");
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.first_name} ${s.last_name} ${s.matricule}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dossiers des Élèves</h1>
            <p className="text-muted-foreground">
              Base de données des élèves inscrits dans votre établissement
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Dossier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingStudent ? "Modifier l'élève" : "Ajouter un élève"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom de famille</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Matricule (Optionnel)</Label>
                    <Input value={matricule} onChange={e => setMatricule(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de naissance</Label>
                    <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sexe</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={gender} onChange={e => setGender(e.target.value)}>
                      <option value="">Sélectionner</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                      <option value="graduated">Diplômé / Terminé</option>
                      <option value="transferred">Transféré</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Téléphone de contact</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} />
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
          <div className="p-4 border-b flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher par nom ou matricule..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm border-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Âge</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun élève trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <GraduationCap className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{student.first_name} {student.last_name}</div>
                            {student.gender && <div className="text-xs text-muted-foreground">{student.gender === 'M' ? 'Garçon' : 'Fille'}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.matricule || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.dob ? `${new Date().getFullYear() - new Date(student.dob).getFullYear()} ans` : "-"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${student.status === 'active' ? 'bg-success/10 text-success' : 
                            student.status === 'graduated' ? 'bg-primary/10 text-primary' : 
                            'bg-muted text-muted-foreground'}`}>
                          {student.status === 'active' ? 'Actif' : 
                           student.status === 'graduated' ? 'Diplômé' : 
                           student.status === 'transferred' ? 'Transféré' : 'Inactif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(student.id)}>
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
