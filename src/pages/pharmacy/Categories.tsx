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
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components"; // Reusing these generic components
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { PharmacyCategory } from "@/modules/pharmacy/types";
import { productService, getPharmacyBusinessId, setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { glowupStore } from "@/lib/store";

export default function PharmacyCategories() {
  const { t } = useTranslation();
  const [data, setData] = useState<PharmacyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyCategory | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "#ffffff" });

  useEffect(() => {
    // Basic setup to ensure businessId is available. In a real scenario, this is set by Auth/Context.
    try {
      const bizId = glowupStore.getSalons()[0]?.business_id; // Using first salon's business_id as fallback
      if (bizId) setPharmacyBusinessId(bizId);
    } catch (e) {
      // ignore
    }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await productService.getCategories();
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
    setForm({ name: "", description: "", color: "#3b82f6" });
    setOpen(true);
  };

  const openEdit = (cat: PharmacyCategory) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description ?? "", color: cat.color ?? "#3b82f6" });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await productService.updateCategory(editing.id, form);
        toast.success("Catégorie mise à jour");
      } else {
        await productService.createCategory(form);
        toast.success("Catégorie créée");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette catégorie ?")) return;
    try {
      await productService.deleteCategory(id);
      toast.success("Catégorie supprimée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Catégories Médicaments" subtitle="Gestion des familles de produits">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Catégories" 
            description={`${data.length} catégorie(s) enregistrée(s)`} 
            action={{ label: "Nouvelle Catégorie", onClick: openCreate }} 
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { 
                key: "color", 
                label: "Couleur", 
                render: (r) => (
                  <div className="w-6 h-6 rounded border" style={{ backgroundColor: r.color || "#ccc" }} />
                )
              },
              { key: "name", label: "Nom de la Catégorie" },
              { key: "description", label: "Description", render: (r) => r.description || "-" },
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
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle"} Catégorie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("common.name")}</Label>
              <Input placeholder="Ex: Antalgiques" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Couleur (Optionnel)</Label>
              <div className="flex gap-2 items-center mt-1">
                <Input type="color" className="w-16 h-10 p-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                <Input type="text" className="flex-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Description de la famille de produits..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
