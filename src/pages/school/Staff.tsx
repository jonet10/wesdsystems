import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  school_admin: "Directeur/Admin",
  manager: "Gestionnaire",
  accountant: "Comptable",
  cashier: "Caissier(ère)",
  teacher: "Enseignant(e)",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  school_admin: "destructive",
  manager: "default",
  accountant: "secondary",
  cashier: "outline",
  teacher: "secondary",
};

interface SchoolStaff {
  id: string;
  business_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  pin_code?: string | null;
  is_active: boolean;
  created_at: string;
}

function generatePin(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export default function SchoolStaffPage() {
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [data, setData] = useState<SchoolStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolStaff | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "cashier", pin_code: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<SchoolStaff | null>(null);
  const [createdResult, setCreatedResult] = useState<{ pin: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const { data: staffData, error } = await supabase.rpc("school_list_staff", { p_business_id: businessId });
      if (error) throw error;
      setData(staffData || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => {
    setEditing(null);
    const pin = generatePin();
    setForm({ name: "", email: "", phone: "", role: "cashier", pin_code: pin });
    setCreatedResult(null);
    setOpen(true);
  };

  const openEdit = (staff: SchoolStaff) => {
    setEditing(staff);
    setForm({ name: staff.name, email: staff.email || "", phone: staff.phone || "", role: staff.role, pin_code: "" });
    setCreatedResult(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    
    setIsSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.rpc("update_school_staff", {
          p_id: editing.id,
          p_business_id: businessId,
          p_name: form.name,
          p_email: form.email || null,
          p_phone: form.phone || null,
          p_role: form.role,
          p_pin_code: form.pin_code || null,
        });
        if (error) throw error;
        toast.success("Utilisateur modifié");
        setOpen(false);
      } else {
        const { error } = await supabase.rpc("create_school_staff", {
          p_business_id: businessId,
          p_name: form.name,
          p_email: form.email || null,
          p_phone: form.phone || null,
          p_role: form.role,
          p_pin_code: form.pin_code,
        });
        if (error) throw error;
        setCreatedResult({ pin: form.pin_code });
        toast.success("Utilisateur créé");
      }
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || !businessId) return;
    try {
      const { error } = await supabase.rpc("delete_school_staff", { p_id: deleteConfirm.id, p_business_id: businessId });
      if (error) throw error;
      toast.success("Utilisateur supprimé");
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleStatus = async (staff: SchoolStaff) => {
    if (!businessId) return;
    try {
      const { error } = await supabase.rpc("update_school_staff", {
        p_id: staff.id,
        p_business_id: businessId,
        p_is_active: !staff.is_active,
      });
      if (error) throw error;
      toast.success(`Utilisateur ${!staff.is_active ? "activé" : "désactivé"}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="school_admin" title="Utilisateurs" subtitle="Gestion du personnel (Caissiers, Comptables, etc.)">
      <StaggerContainer className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
              <p className="text-muted-foreground">{data.length} compte(s) utilisateur(s)</p>
            </div>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Créer un compte</Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Code PIN</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</TableCell></TableRow>
                ) : (
                  data.map((staff) => (
                    <TableRow key={staff.id} className={!staff.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell><Badge variant={ROLE_COLORS[staff.role] || "default"}>{ROLE_LABELS[staff.role] || staff.role}</Badge></TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {staff.phone && <div>{staff.phone}</div>}
                          {staff.email && <div className="text-muted-foreground text-xs">{staff.email}</div>}
                          {!staff.phone && !staff.email && <span className="text-muted-foreground italic">Non renseigné</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono bg-muted px-2 py-1 rounded text-xs tracking-widest">
                            {staff.pin_code ? "******" : "Aucun"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={staff.is_active ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => toggleStatus(staff)}
                          className={staff.is_active ? "text-green-600 border-green-200" : ""}
                        >
                          {staff.is_active ? "Actif" : "Inactif"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(staff)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(staff)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Créer"} un compte utilisateur</DialogTitle>
          </DialogHeader>

          {createdResult ? (
            <div className="space-y-6 py-4">
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800 text-center space-y-3">
                <h3 className="font-semibold text-green-800 dark:text-green-300">Compte créé avec succès !</h3>
                <p className="text-sm text-green-700 dark:text-green-400">Veuillez noter ce code PIN et le transmettre à l'utilisateur.</p>
                <div className="bg-white dark:bg-black p-4 rounded-md border font-mono text-3xl tracking-[0.25em] font-bold text-center">
                  {createdResult.pin}
                </div>
              </div>
              <Button className="w-full" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Jean Dupont" />
              </div>
              
              <div className="space-y-2">
                <Label>Rôle *</Label>
                <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Caissier(ère)</SelectItem>
                    <SelectItem value="accountant">Comptable</SelectItem>
                    <SelectItem value="manager">Gestionnaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone (Optionnel)</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+509..." />
                </div>
                <div className="space-y-2">
                  <Label>Email (Optionnel)</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@ex.com" />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t mt-4">
                <div className="flex justify-between items-center">
                  <Label>Code PIN de connexion</Label>
                  {editing && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, pin_code: generatePin() })}>
                      Nouveau PIN
                    </Button>
                  )}
                </div>
                {!editing ? (
                  <div className="bg-muted p-3 rounded-md text-center font-mono text-xl tracking-widest font-bold">
                    {form.pin_code}
                  </div>
                ) : (
                  <Input 
                    value={form.pin_code} 
                    onChange={(e) => setForm({ ...form, pin_code: e.target.value })} 
                    placeholder="Laisser vide pour garder l'ancien PIN" 
                    className="font-mono tracking-widest"
                  />
                )}
                {!editing && <p className="text-xs text-muted-foreground text-center">Ce code servira de mot de passe pour la connexion.</p>}
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Enregistrement..." : "Enregistrer"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'utilisateur</DialogTitle>
          </DialogHeader>
          <p className="py-4">Êtes-vous sûr de vouloir supprimer définitivement <strong>{deleteConfirm?.name}</strong> ?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
