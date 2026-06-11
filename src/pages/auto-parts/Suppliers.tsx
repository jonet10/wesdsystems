import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/modules/auto-parts/services/suppliers";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { AutoPartsSupplier } from "@/modules/auto-parts/types";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";

export default function AutoPartsSuppliersPage() {
  const businessId = useAutoPartsBusinessId();
  const [data, setData] = useState<AutoPartsSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsSupplier | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", email: "", address: "", country: "Haïti", currency: "HTG", notes: "", active: true });

  const load = async () => {
    setLoading(true);
    try { setData(await listSuppliers(businessId)); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => { setEditing(null); setForm({ name: "", phone: "", whatsapp: "", email: "", address: "", country: "Haïti", currency: "HTG", notes: "", active: true }); setOpen(true); };
  const openEdit = (s: AutoPartsSupplier) => { setEditing(s); setForm({ name: s.name, phone: s.phone ?? "", whatsapp: s.whatsapp ?? "", email: s.email ?? "", address: s.address ?? "", country: s.country, currency: s.currency, notes: s.notes ?? "", active: s.active }); setOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) { await updateSupplier(editing.id, form, businessId); toast.success("Fournisseur mis à jour"); }
      else { await createSupplier(businessId, form); toast.success("Fournisseur créé"); }
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce fournisseur ?")) return;
    try { await deleteSupplier(id, businessId); toast.success("Fournisseur supprimé"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Fournisseurs" subtitle="Gestion des fournisseurs">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Fournisseurs" description={`${data.length} fournisseur(s)`} action={{ label: "Nouveau fournisseur", onClick: openCreate }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom" },
              { key: "phone", label: "Téléphone", render: (r) => r.phone || "-" },
              { key: "email", label: "Email", render: (r) => r.email || "-" },
              { key: "country", label: "Pays" },
              { key: "currency", label: "Devise" },
              { key: "active", label: "Actif", render: (r) => r.active ? "Oui" : "Non" },
              { key: "actions", label: "Actions", render: (r) => (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              )},
            ]}
          />
        </StaggerItem>
      </StaggerContainer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} fournisseur</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            <div className="col-span-2"><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Pays</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div><Label>Devise</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Fournisseur actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
