import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { FileText, Trash2, Eye } from "lucide-react";
import type { PharmacyPrescription, PharmacyCustomer } from "@/modules/pharmacy/types";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";

export default function PharmacyPrescriptions() {
  const { t } = useTranslation();
  const [data, setData] = useState<PharmacyPrescription[]>([]);
  const [customers, setCustomers] = useState<PharmacyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", doctor_name: "", notes: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prescs, custs] = await Promise.all([
        salesService.getPrescriptions(),
        salesService.getCustomers()
      ]);
      setData(prescs);
      setCustomers(custs);
    } catch (e: any) {
      if (e.message !== "Business ID not set for Pharmacy Module") {
        toast.error(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ customer_id: "", doctor_name: "", notes: "" });
    setImageFile(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.customer_id || !form.doctor_name) {
      toast.error("Veuillez remplir les informations requises.");
      return;
    }
    try {
      // In a real app, upload imageFile to Supabase Storage and get URL here
      // For now, we simulate image_url = null
      const payload = {
        ...form,
        prescription_date: new Date().toISOString()
      };

      await salesService.createPrescription(payload);
      toast.success("Ordonnance enregistrée");
      setOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Ordonnances Médicales" subtitle="Gestion des prescriptions">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Registre des Ordonnances" 
            description={`${data.length} ordonnance(s) au dossier`} 
            action={{ label: "Nouvelle Ordonnance", onClick: openCreate }} 
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "date", label: "Date", render: (r) => new Date(r.prescription_date).toLocaleDateString() },
              { key: "patient", label: "Patient", render: (r) => <span className="font-bold">{r.customer?.first_name} {r.customer?.last_name}</span> },
              { key: "doctor", label: "Médecin Prescripteur", render: (r) => <span className="text-blue-600">Dr. {r.doctor_name}</span> },
              { key: "status", label: "Document", render: (r) => (
                r.image_url ? 
                  <Button variant="ghost" size="sm" className="text-green-600"><FileText className="w-4 h-4 mr-2"/> Voir</Button> 
                : <span className="text-muted-foreground text-xs italic">Saisie manuelle</span>
              ) },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enregistrer une Ordonnance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({...form, customer_id: v})}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom du Médecin *</Label>
              <Input placeholder="Ex: Jean Dupont" value={form.doctor_name} onChange={(e) => setForm({...form, doctor_name: e.target.value})} />
            </div>
            <div>
              <Label>Notes (Médicaments prescrits, Posologie)</Label>
              <Textarea rows={4} placeholder="Saisir les détails de l'ordonnance ici si vous n'avez pas de scan..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
            </div>
            <div className="border p-4 border-dashed rounded-lg text-center bg-gray-50">
              <Label className="cursor-pointer block">
                <div className="text-sm text-blue-600 font-medium">Scanner ou Téléverser l'ordonnance (Optionnel)</div>
                <Input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                {imageFile && <div className="mt-2 text-xs text-green-600">{imageFile.name}</div>}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
