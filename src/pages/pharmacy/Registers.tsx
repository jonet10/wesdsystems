import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { glowupStore } from "@/lib/store";
import { setPharmacyBusinessId, getPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DollarSign, ShoppingBag, TrendingUp, Monitor } from "lucide-react";

interface Register {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  opening_balance: number;
  current_balance: number;
  status: "open" | "closed";
  opened_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export default function PharmacyRegisters() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Register | null>(null);
  const [form, setForm] = useState({ name: "", description: "", opening_balance: "0" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Register | null>(null);

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
      const businessId = getPharmacyBusinessId();
      const { data, error } = await supabase
        .from("pharmacy_registers")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRegisters(data || []);
    } catch (e: any) {
      // Table may not exist yet — show empty state gracefully
      setRegisters([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", opening_balance: "0" });
    setOpen(true);
  };

  const openEdit = (r: Register) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || "", opening_balance: String(r.opening_balance) });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const businessId = getPharmacyBusinessId();
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        opening_balance: Number(form.opening_balance) || 0,
        business_id: businessId,
      };
      if (editing) {
        const { error } = await supabase.from("pharmacy_registers").update({ name: payload.name, description: payload.description }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Caisse modifiée");
      } else {
        const { error } = await supabase.from("pharmacy_registers").insert([{ ...payload, current_balance: payload.opening_balance, status: "closed" }]);
        if (error) throw error;
        toast.success("Caisse créée");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (reg: Register) => {
    try {
      const newStatus = reg.status === "open" ? "closed" : "open";
      const updatePayload: any = { status: newStatus };
      if (newStatus === "open") {
        updatePayload.opened_at = new Date().toISOString();
        updatePayload.closed_at = null;
      } else {
        updatePayload.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("pharmacy_registers").update(updatePayload).eq("id", reg.id);
      if (error) throw error;
      toast.success(newStatus === "open" ? "Caisse ouverte" : "Caisse fermée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase.from("pharmacy_registers").delete().eq("id", deleteConfirm.id);
      if (error) throw error;
      toast.success("Caisse supprimée");
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalOpen = registers.filter(r => r.status === "open").length;
  const totalBalance = registers.reduce((s, r) => s + Number(r.current_balance || 0), 0);

  return (
    <DashboardLayout role="salon_admin" title="Gestion des Caisses" subtitle="Ouverture, fermeture et suivi des caisses enregistreuses">
      <StaggerContainer className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Caisses totales", value: registers.length, icon: <Monitor className="h-5 w-5 text-blue-500" />, bg: "bg-blue-50 dark:bg-blue-500/10" },
            { label: "Caisses ouvertes", value: totalOpen, icon: <ShoppingBag className="h-5 w-5 text-green-500" />, bg: "bg-green-50 dark:bg-green-500/10" },
            { label: "Solde total", value: format(totalBalance), icon: <DollarSign className="h-5 w-5 text-violet-500" />, bg: "bg-violet-50 dark:bg-violet-500/10" },
          ].map((kpi, i) => (
            <StaggerItem key={i}>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.bg}`}>{kpi.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </div>

        {/* Table */}
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Caisses enregistreuses</CardTitle>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Nouvelle caisse
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">{t("common.loading")}</p>
              ) : registers.length === 0 ? (
                <div className="text-center py-12">
                  <Monitor className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Aucune caisse configurée</p>
                  <p className="text-sm text-muted-foreground mb-4">Créez votre première caisse pour commencer</p>
                  <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Créer une caisse</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Solde ouverture</TableHead>
                      <TableHead>Solde actuel</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>Ouvert le</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registers.map(reg => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-semibold flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          {reg.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{reg.description || "-"}</TableCell>
                        <TableCell>{format(reg.opening_balance)}</TableCell>
                        <TableCell className="font-semibold">{format(reg.current_balance || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={reg.status === "open" ? "default" : "secondary"}>
                            {reg.status === "open" ? "Ouverte" : "Fermée"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {reg.opened_at ? new Date(reg.opened_at).toLocaleDateString("fr-FR") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={reg.status === "open" ? "destructive" : "default"}
                              onClick={() => handleToggle(reg)}
                            >
                              {reg.status === "open" ? "Fermer" : "Ouvrir"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(reg)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(reg)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la caisse" : "Nouvelle caisse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom de la caisse *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Caisse principale"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optionnel"
                className="mt-1"
              />
            </div>
            {!editing && (
              <div>
                <Label>Solde d'ouverture</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.opening_balance}
                  onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : editing ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer la suppression</DialogTitle></DialogHeader>
          <p>Supprimer la caisse <strong>{deleteConfirm?.name}</strong> ? Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
