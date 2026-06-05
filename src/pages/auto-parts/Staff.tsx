import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listStaff, createStaff, updateStaff, deleteStaff } from "@/modules/auto-parts/services/staff";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import type { AutoPartsStaff } from "@/modules/auto-parts/types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  manager: "Gérant",
  cashier: "Caissier(ère)",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  manager: "default",
  cashier: "secondary",
};

export default function AutoPartsStaffPage() {
  const businessId = useAutoPartsBusinessId();
  const [data, setData] = useState<AutoPartsStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsStaff | null>(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "", role: "cashier", pin_code: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<AutoPartsStaff | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await listStaff(businessId));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", username: "", email: "", phone: "", role: "cashier", pin_code: "" });
    setOpen(true);
  };

  const openEdit = (staff: AutoPartsStaff) => {
    setEditing(staff);
    setForm({ name: staff.name, username: (staff as any).username || "", email: staff.email || "", phone: staff.phone || "", role: staff.role, pin_code: "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    try {
      if (editing) {
        await updateStaff(editing.id, {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone,
          role: form.role,
          pin_code: form.pin_code,
        });
        toast.success("Employé modifié");
      } else {
        await createStaff(businessId, { ...form, username: form.username || undefined });
        toast.success("Employé créé");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteStaff(deleteConfirm.id);
      toast.success("Employé supprimé");
      setDeleteConfirm(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Employés" subtitle="Gestion du personnel de caisse">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader
            title="Employés"
            description={`${data.length} employé(s)`}
            action={{ label: "Nouvel employé", onClick: openCreate }}
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom", render: (r) => r.name },
              { key: "username", label: "Identifiant", render: (r) => (r as any).username || "-" },
              { key: "email", label: "Email", render: (r) => r.email || "-" },
              { key: "phone", label: "Téléphone", render: (r) => r.phone || "-" },
              {
                key: "role", label: "Rôle", render: (r) => (
                  <Badge variant={ROLE_COLORS[r.role] || "outline"}>{ROLE_LABELS[r.role] || r.role}</Badge>
                ),
              },
              {
                key: "actions", label: "Actions", render: (r) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(r)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvel"} employé</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Identifiant (pour connexion)</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Caissier(ère)</SelectItem>
                  <SelectItem value="manager">Gérant</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code PIN (optionnel)</Label>
              <Input
                type="password" maxLength={6}
                placeholder="Code à 4-6 chiffres"
                value={form.pin_code}
                onChange={(e) => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>{editing ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer la suppression</DialogTitle></DialogHeader>
          <p>Supprimer l'employé <strong>{deleteConfirm?.name}</strong> ? Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
