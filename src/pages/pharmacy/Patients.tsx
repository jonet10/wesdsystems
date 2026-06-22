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
import { Pencil, Trash2, Phone, FileText } from "lucide-react";
import type { PharmacyCustomer } from "@/modules/pharmacy/types";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { glowupStore } from "@/lib/store";

export default function PharmacyPatients() {
  const [data, setData] = useState<PharmacyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyCustomer | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", address: "", medical_notes: "" });

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
      const res = await salesService.getCustomers();
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
    setForm({ first_name: "", last_name: "", phone: "", address: "", medical_notes: "" });
    setOpen(true);
  };

  const openEdit = (p: PharmacyCustomer) => {
    setEditing(p);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone || "",
      address: p.address || "",
      medical_notes: p.medical_notes || ""
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await salesService.updateCustomer(editing.id, form);
        toast.success("Dossier patient mis à jour");
      } else {
        await salesService.createCustomer(form);
        toast.success("Patient ajouté");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Patients & Clients" subtitle="Gestion des dossiers patients">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Dossiers Patients" 
            description={`${data.length} patient(s) enregistré(s)`} 
            action={{ label: "Nouveau Patient", onClick: openCreate }} 
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom Complet", render: (r) => <span className="font-bold">{r.first_name} {r.last_name}</span> },
              { key: "contact", label: "Téléphone", render: (r) => (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3"/> {r.phone || "-"}
                </div>
              )},
              { key: "address", label: "Adresse", render: (r) => r.address || "-" },
              { key: "notes", label: "Notes Médicales", render: (r) => (
                r.medical_notes ? <div className="flex items-center gap-1 text-orange-500"><FileText className="w-4 h-4"/> Alerte médicale</div> : <span className="text-muted-foreground">-</span>
              )},
              { key: "actions", label: "Actions", render: (r) => (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                </div>
              )},
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} Patient</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Adresse</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Notes Médicales (Allergies, etc.)</Label>
              <Textarea className="border-orange-200" placeholder="Informations importantes..." value={form.medical_notes} onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.first_name || !form.last_name}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
