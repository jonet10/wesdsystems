import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { listBrands, createBrand, updateBrand, deleteBrand } from "@/modules/auto-parts/services/brands";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { AutoPartsBrand } from "@/modules/auto-parts/types";

export default function AutoPartsBrandsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AutoPartsBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsBrand | null>(null);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setData(await listBrands());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(""); setOpen(true); };
  const openEdit = (b: AutoPartsBrand) => { setEditing(b); setName(b.name); setOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateBrand(editing.id, { name });
        toast.success("Marque mise à jour");
      } else {
        await createBrand({ name });
        toast.success("Marque créée");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette marque ?")) return;
    try { await deleteBrand(id); toast.success("Marque supprimée"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Marques" subtitle="Gestion des marques de véhicules">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Marques" description={`${data.length} marque(s)`} action={{ label: "Nouvelle marque", onClick: openCreate }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom" },
              { key: "actions", label: "Actions", render: (r: AutoPartsBrand) => (
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
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle"} marque</DialogTitle></DialogHeader>
          <div>
            <Label>{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
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
