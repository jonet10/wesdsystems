import { useTranslation } from "react-i18next";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { useStationeryPermissions } from "@/modules/stationery/hooks/useStationeryPermissions";
import { listCategories, createCategory, updateCategory, deleteCategory } from "@/modules/stationery/services/categories";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Loader2, Plus, GripVertical } from "lucide-react";
import type { StationeryCategory } from "@/modules/stationery/types";

export default function StationeryCategoriesPage() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { hasStationeryPermission } = useStationeryPermissions();
  const canManage = hasStationeryPermission(PERMISSIONS.CATEGORIES_MANAGE);
  const [data, setData] = useState<StationeryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StationeryCategory | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", color: "#3b82f6", icon: "", active: true
  });

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setData(await listCategories(businessId, null));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", color: "#3b82f6", icon: "", active: true });
    setOpen(true);
  };

  const openEdit = (c: StationeryCategory) => {
    setEditing(c);
    setForm({
      name: c.name, description: c.description ?? "", color: c.color ?? "#3b82f6", icon: c.icon ?? "", active: c.active ?? true
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      setSaving(true);
      if (editing) { 
        await updateCategory(editing.id, form, businessId); 
        toast.success("Catégorie mise à jour"); 
      } else { 
        await createCategory(businessId, "", form); // branchId required normally, handled by service wrapper if empty
        toast.success("Catégorie créée"); 
      }
      setOpen(false); 
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette catégorie ?")) return;
    try { 
      await deleteCategory(id, businessId); 
      toast.success("Catégorie supprimée"); 
      load(); 
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Catégories (Papeterie)" subtitle="Classification des articles">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Catégories</h2>
              <p className="text-muted-foreground">{data.length} catégorie(s) enregistrée(s)</p>
            </div>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle catégorie
              </Button>
            )}
          </div>
          
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher une catégorie..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Couleur</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Aucune catégorie trouvée</TableCell></TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" /></TableCell>
                      <TableCell>
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: r.color || "#ccc" }} />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[300px]">{r.description || "-"}</TableCell>
                      <TableCell>{r.active ? "Actif" : "Inactif"}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle"} catégorie</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Nom de la catégorie *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            
            <div>
              <Label>Couleur d'identification</Label>
              <div className="flex gap-2 items-center mt-2">
                <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-16 h-10 p-1" />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Catégorie visible</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
