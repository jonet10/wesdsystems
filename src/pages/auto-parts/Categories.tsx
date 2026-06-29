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
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listCategories, createCategory, updateCategory, deleteCategory } from "@/modules/auto-parts/services/categories";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { AutoPartsCategory } from "@/modules/auto-parts/types";

export default function AutoPartsCategoriesPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const [data, setData] = useState<AutoPartsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsCategory | null>(null);
  const [form, setForm] = useState({ name: "", description: "", sort_order: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await listCategories(businessId);
      setData(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [businessId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", sort_order: 0 });
    setOpen(true);
  };

  const openEdit = (cat: AutoPartsCategory) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description ?? "", sort_order: cat.sort_order });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast.success("Catégorie mise à jour");
      } else {
        await createCategory(businessId, form);
        toast.success("Catégorie créée");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    try {
      await deleteCategory(id);
      toast.success("Catégorie supprimée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Catégories" subtitle="Gestion des catégories de pièces">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Catégories" description={`${data.length} catégorie(s)`} action={{ label: "Nouvelle catégorie", onClick: openCreate }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom" },
              { key: "description", label: "Description", render: (r) => r.description || "-" },
              { key: "sort_order", label: "Ordre" },
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
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle"} catégorie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("common.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
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
