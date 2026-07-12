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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { useStationeryPermissions } from "@/modules/stationery/hooks/useStationeryPermissions";
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/modules/stationery/services/clients";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Loader2, Plus, User } from "lucide-react";
import type { StationeryCustomer } from "@/modules/stationery/types";

export default function StationeryCustomersPage() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { hasStationeryPermission } = useStationeryPermissions();
  const canManage = hasStationeryPermission(PERMISSIONS.CLIENTS_MANAGE);
  
  const [data, setData] = useState<StationeryCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StationeryCustomer | null>(null);
  
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", email: "", address: "", notes: ""
  });

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setData(await listCustomers(businessId, null));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((c) => {
    const term = search.toLowerCase();
    if (search && !c.first_name.toLowerCase().includes(term) && !(c.last_name?.toLowerCase().includes(term)) && !(c.phone?.includes(term))) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ first_name: "", last_name: "", phone: "", email: "", address: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (c: StationeryCustomer) => {
    setEditing(c);
    setForm({
      first_name: c.first_name, 
      last_name: c.last_name ?? "", 
      phone: c.phone ?? "", 
      email: c.email ?? "", 
      address: c.address ?? "", 
      notes: c.notes ?? ""
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      setSaving(true);
      if (editing) { 
        await updateCustomer(editing.id, form, businessId); 
        toast.success("Client mis à jour"); 
      } else { 
        await createCustomer(businessId, "", form); // branchId empty string uses hook internal logic
        toast.success("Client créé"); 
      }
      setOpen(false); 
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce client ?")) return;
    try { 
      await deleteCustomer(id, businessId); 
      toast.success("Client supprimé"); 
      load(); 
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Clients" subtitle="Carnet d'adresses">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Répertoire Clients</h2>
              <p className="text-muted-foreground">{data.length} client(s) enregistré(s)</p>
            </div>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Client
              </Button>
            )}
          </div>
          
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou téléphone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Adresse</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Aucun client trouvé</TableCell></TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                      <TableCell>{r.phone || "-"}</TableCell>
                      <TableCell>{r.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[200px]">{r.address || "-"}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} Client</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Prénom *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div><Label>Nom</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Téléphone</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>

            <div><Label>Adresse postale</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            
            <div>
              <Label>Notes (Optionnel)</Label>
              <Textarea className="mt-1" placeholder="Détails supplémentaires..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.first_name}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
