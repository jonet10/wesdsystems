import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2, Phone, Mail } from "lucide-react";
import type { PharmacySupplier } from "@/modules/pharmacy/types";
import { inventoryService } from "@/modules/pharmacy/services/inventoryService";
import { setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { glowupStore } from "@/lib/store";

export default function PharmacySuppliers() {
  const { t } = useTranslation();
  const [data, setData] = useState<PharmacySupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacySupplier | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", contact_person: "", notes: "" });

  useEffect(() => {
    try {
      const bizId = glowupStore.getSalons()[0]?.business_id;
      if (bizId) setPharmacyBusinessId(bizId);
    } catch (e) {}
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getSuppliers();
      setData(res);
    } catch (e: any) {
      if (e.message !== "Business ID not set for Pharmacy Module") {
        toast.error(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", address: "", contact_person: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (s: PharmacySupplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      contact_person: s.contact_person || "",
      notes: s.notes || ""
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await inventoryService.updateSupplier(editing.id, form);
        toast.success("Fournisseur mis à jour");
      } else {
        await inventoryService.createSupplier(form);
        toast.success("Fournisseur créé");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment désactiver ce fournisseur ?")) return;
    try {
      await inventoryService.deleteSupplier(id);
      toast.success("Fournisseur désactivé");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Fournisseurs" subtitle="Laboratoires et grossistes partenaires">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Fournisseurs" 
            description={`${data.length} fournisseur(s) actif(s)`} 
            action={{ label: "Nouveau Fournisseur", onClick: openCreate }} 
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom du Fournisseur", render: (r) => (
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.contact_person}</div>
                </div>
              ) },
              { key: "contact", label: "Contact", render: (r) => (
                <div className="flex flex-col gap-1 text-sm">
                  {r.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3"/> {r.phone}</div>}
                  {r.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {r.email}</div>}
                </div>
              ) },
              { key: "address", label: "Adresse", render: (r) => r.address || "-" },
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} Fournisseur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du Laboratoire / Grossiste *</Label>
              <Input placeholder="Ex: SOGEPHARMA" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Personne de Contact</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div>
                <Label>{t("common.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Adresse</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.name}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
