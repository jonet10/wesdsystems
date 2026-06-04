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
import { listClients, createClient, updateClient, deleteClient } from "@/modules/auto-parts/services/clients";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { AutoPartsClient } from "@/modules/auto-parts/types";

export default function AutoPartsClientsPage() {
  const [data, setData] = useState<AutoPartsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsClient | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", email: "", address: "", company: "", notes: "" });

  const load = async () => {
    setLoading(true);
    try { setData(await listClients()); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", phone: "", whatsapp: "", email: "", address: "", company: "", notes: "" }); setOpen(true); };
  const openEdit = (c: AutoPartsClient) => { setEditing(c); setForm({ name: c.name, phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", email: c.email ?? "", address: c.address ?? "", company: c.company ?? "", notes: c.notes ?? "" }); setOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) { await updateClient(editing.id, form); toast.success("Client mis à jour"); }
      else { await createClient(form); toast.success("Client créé"); }
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce client ?")) return;
    try { await deleteClient(id); toast.success("Client supprimé"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Clients" subtitle="Gestion des clients auto-parts">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Clients" description={`${data.length} client(s)`} action={{ label: "Nouveau client", onClick: openCreate }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "name", label: "Nom" },
              { key: "phone", label: "Téléphone", render: (r) => r.phone || "-" },
              { key: "email", label: "Email", render: (r) => r.email || "-" },
              { key: "company", label: "Compagnie", render: (r) => r.company || "-" },
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} client</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="col-span-2"><Label>Compagnie</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
