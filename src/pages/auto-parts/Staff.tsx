import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
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

function generateUsername(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 20);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${normalized}.${suffix}`;
}

function generatePin(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export default function AutoPartsStaffPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const [data, setData] = useState<AutoPartsStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsStaff | null>(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "", role: "cashier", pin_code: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<AutoPartsStaff | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ username: string; pin: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await listStaff(businessId));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => {
    setEditing(null);
    const pin = generatePin();
    setForm({ name: "", username: "", email: "", phone: "", role: "cashier", pin_code: pin });
    setUsernameTouched(false);
    setCreatedResult(null);
    setOpen(true);
  };

  const openEdit = (staff: AutoPartsStaff) => {
    setEditing(staff);
    setForm({ name: staff.name, username: (staff as any).username || "", email: staff.email || "", phone: staff.phone || "", role: staff.role, pin_code: "" });
    setUsernameTouched(true);
    setCreatedResult(null);
    setOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      username: usernameTouched ? prev.username : generateUsername(name),
    }));
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
        setOpen(false);
      } else {
        await createStaff(businessId, { ...form, username: form.username || undefined });
        setCreatedResult({ username: form.username, pin: form.pin_code });
        toast.success("Employé créé");
      }
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

      <Dialog open={open} onOpenChange={(v) => { if (!v) setCreatedResult(null); setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvel"} employé</DialogTitle></DialogHeader>
          {createdResult ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                <p className="font-semibold text-green-800 mb-2">Employé créé avec succès !</p>
                <div className="text-sm space-y-1">
                  <p><strong>Identifiant :</strong> <code className="bg-green-100 px-2 py-0.5 rounded">{createdResult.username}</code></p>
                  <p><strong>Code PIN :</strong> <code className="bg-green-100 px-2 py-0.5 rounded">{createdResult.pin}</code></p>
                </div>
                <p className="text-xs text-green-600 mt-3">Transmettez ces informations à l'employé.</p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => { setOpen(false); setCreatedResult(null); }}>{t("common.close")}</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label>Nom *</Label>
                  <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
                </div>
                <div>
                  <Label>Identifiant (pour connexion)</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => { setForm({ ...form, username: e.target.value }); setUsernameTouched(true); }}
                  />
                  {!usernameTouched && form.name && (
                    <p className="text-xs text-muted-foreground mt-1">Généré automatiquement depuis le nom</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("common.email")}</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("common.phone")}</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>{t("common.role")}</Label>
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
                  <Label>Code PIN</Label>
                  <Input
                    type="password" maxLength={6}
                    placeholder="Code à 6 chiffres"
                    value={form.pin_code}
                    onChange={(e) => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Généré automatiquement si vide</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); setCreatedResult(null); }}>{t("common.cancel")}</Button>
                <Button onClick={handleSave}>{editing ? "Enregistrer" : "Créer"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer la suppression</DialogTitle></DialogHeader>
          <p>Supprimer l'employé <strong>{deleteConfirm?.name}</strong> ? Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
