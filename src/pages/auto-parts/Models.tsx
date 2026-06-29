import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { listBrands } from "@/modules/auto-parts/services/brands";
import { listModels, createModel, updateModel, deleteModel } from "@/modules/auto-parts/services/models";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { AutoPartsBrand, AutoPartsModel } from "@/modules/auto-parts/types";

export default function AutoPartsModelsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<(AutoPartsModel & { brand: { name: string } })[]>([]);
  const [brands, setBrands] = useState<AutoPartsBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsModel | null>(null);
  const [form, setForm] = useState({ brand_id: "", name: "", start_year: "", end_year: "" });

  const load = async () => {
    setLoading(true);
    try {
      setData(await listModels());
      setBrands(await listBrands());
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ brand_id: "", name: "", start_year: "", end_year: "" }); setOpen(true); };
  const openEdit = (m: AutoPartsModel) => { setEditing(m); setForm({ brand_id: m.brand_id, name: m.name, start_year: m.start_year?.toString() ?? "", end_year: m.end_year?.toString() ?? "" }); setOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateModel(editing.id, {
          brand_id: form.brand_id,
          name: form.name,
          start_year: form.start_year ? Number(form.start_year) : null,
          end_year: form.end_year ? Number(form.end_year) : null,
        });
        toast.success("Modèle mis à jour");
      } else {
        await createModel({
          brand_id: form.brand_id,
          name: form.name,
          start_year: form.start_year ? Number(form.start_year) : null,
          end_year: form.end_year ? Number(form.end_year) : null,
        });
        toast.success("Modèle créé");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce modèle ?")) return;
    try { await deleteModel(id); toast.success("Modèle supprimé"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Modèles" subtitle="Gestion des modèles de véhicules">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Modèles" description={`${data.length} modèle(s)`} action={{ label: "Nouveau modèle", onClick: openCreate }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom" },
              { key: "brand", label: "Marque", render: (r) => r.brand?.name ?? "-" },
              { key: "start_year", label: "Début", render: (r) => r.start_year ?? "-" },
              { key: "end_year", label: "Fin", render: (r) => r.end_year ?? "-" },
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
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} modèle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Marque</Label>
              <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une marque" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom du modèle</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Année début</Label>
                <Input type="number" value={form.start_year} onChange={(e) => setForm({ ...form, start_year: e.target.value })} />
              </div>
              <div>
                <Label>Année fin</Label>
                <Input type="number" value={form.end_year} onChange={(e) => setForm({ ...form, end_year: e.target.value })} />
              </div>
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
