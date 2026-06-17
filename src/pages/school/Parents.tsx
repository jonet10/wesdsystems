import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, User as UserIcon, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { SchoolParent } from "@/modules/school/types";

export default function SchoolParents() {
  const { user, profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [parents, setParents] = useState<SchoolParent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadParents = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("school_parents")
        .select("*")
        .eq("business_id", businessId)
        .order("last_name", { ascending: true });

      if (error) throw error;
      setParents(data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadParents();
  }, [isAuthenticated, businessId]);

  // Form State
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
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setProfession("");
    setAddress("");
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
    if (!businessId) return;

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        profession: profession || null,
        address: address || null,
      };

      if (editingParent) {
        await supabase.from("school_parents").update(payload).eq("id", editingParent.id);
        toast.success("Parent mis à jour");
      } else {
        await supabase.from("school_parents").insert([payload]);
        toast.success("Parent ajouté");
      }

      setIsDialogOpen(false);
      resetForm();
      loadParents();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce dossier parent ?")) return;
    try {
      await supabase.from("school_parents").delete().eq("id", id);
      toast.success("Parent supprimé");
      loadParents();
    } catch (error: any) {
      toast.error("Impossible de supprimer", { description: "Ce parent est lié à un élève inscrit." });
    }
  };

  const filteredParents = parents.filter(p => 
    `${p.first_name} ${p.last_name} ${p.phone} ${p.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Parents / Responsables</h1>
            <p className="text-muted-foreground">
              Gérez les dossiers des parents d'élèves et leurs contacts
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Parent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingParent ? "Modifier le dossier" : "Ajouter un parent"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom de famille</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} required />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Profession</Label>
                  <Input value={profession} onChange={e => setProfession(e.target.value)} />
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
              placeholder="Rechercher par nom, email, ou téléphone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm border-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent / Tuteur</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filteredParents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Aucun parent trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParents.map((parent) => (
                    <TableRow key={parent.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{parent.first_name} {parent.last_name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground space-y-1">
                          {parent.phone && <span className="flex items-center"><Phone className="h-3 w-3 mr-1"/> {parent.phone}</span>}
                          {parent.email && <span className="flex items-center"><Mail className="h-3 w-3 mr-1"/> {parent.email}</span>}
                          {!parent.phone && !parent.email && "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {parent.profession || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(parent)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(parent.id)}>
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
