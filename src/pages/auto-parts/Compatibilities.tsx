import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listProducts } from "@/modules/auto-parts/services/products";
import { listBrands } from "@/modules/auto-parts/services/brands";
import { listModels } from "@/modules/auto-parts/services/models";
import { listCompatibilities, createCompatibility, deleteCompatibility } from "@/modules/auto-parts/services/compatibilities";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { AutoPartsProduct, AutoPartsBrand, AutoPartsModel, AutoPartsVehicleCompatibility } from "@/modules/auto-parts/types";

export default function AutoPartsCompatibilitiesPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const [data, setData] = useState<any[]>([]);
  const [products, setProducts] = useState<AutoPartsProduct[]>([]);
  const [brands, setBrands] = useState<AutoPartsBrand[]>([]);
  const [models, setModels] = useState<AutoPartsModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", brand_id: "", model_id: "", year_start: "", year_end: "", engine: "", notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      setData(await listCompatibilities(businessId));
      setProducts(await listProducts(businessId) as any);
      setBrands(await listBrands());
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  useEffect(() => {
    if (form.brand_id) listModels(form.brand_id).then(setModels).catch(console.error);
    else setModels([]);
  }, [form.brand_id]);

  const handleSave = async () => {
    try {
      await createCompatibility(businessId, {
        product_id: form.product_id,
        brand_id: form.brand_id || null,
        model_id: form.model_id || null,
        year_start: form.year_start ? Number(form.year_start) : null,
        year_end: form.year_end ? Number(form.year_end) : null,
        engine: form.engine || null,
        notes: form.notes || null,
      });
      toast.success("Compatibilité ajoutée");
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette compatibilité ?")) return;
    try { await deleteCompatibility(id); toast.success("Compatibilité supprimée"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Compatibilités" subtitle="Compatibilités véhicules par produit">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Compatibilités" description={`${data.length} entrée(s)`} action={{ label: "Ajouter", onClick: () => { setForm({ product_id: "", brand_id: "", model_id: "", year_start: "", year_end: "", engine: "", notes: "" }); setOpen(true); } }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "product", label: "Produit", render: (r) => r.product?.name ?? "-" },
              { key: "brand", label: "Marque", render: (r) => r.brand?.name ?? "-" },
              { key: "model", label: "Modèle", render: (r) => r.model?.name ?? "-" },
              { key: "year_start", label: "Année début", render: (r) => r.year_start ?? "-" },
              { key: "year_end", label: "Année fin", render: (r) => r.year_end ?? "-" },
              { key: "engine", label: "Moteur", render: (r) => r.engine || "-" },
              { key: "actions", label: "Actions", render: (r) => (
                <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              )},
            ]}
          />
        </StaggerItem>
      </StaggerContainer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle compatibilité</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("common.product")}</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || "N/A"})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marque</Label>
              <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v, model_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Toutes marques" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modèle</Label>
              <Select value={form.model_id} onValueChange={(v) => setForm({ ...form, model_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tous modèles" /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Année début</Label><Input type="number" value={form.year_start} onChange={(e) => setForm({ ...form, year_start: e.target.value })} /></div>
              <div><Label>Année fin</Label><Input type="number" value={form.year_end} onChange={(e) => setForm({ ...form, year_end: e.target.value })} /></div>
            </div>
            <div><Label>Moteur</Label><Input value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{t("common.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
