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
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { setPharmacyBusinessId, getPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DollarSign, ShoppingBag, TrendingUp, Monitor } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { whatsappService } from "@/modules/pharmacy/services/whatsappService";

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
  const { profile } = useAuth();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Register | null>(null);
  const [form, setForm] = useState({ name: "", description: "", opening_balance: "0" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Register | null>(null);

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      setPharmacyBusinessId(businessId);
      load();
    }
  }, [businessId]);

  const load = async () => {
    setLoading(true);
    try {
      const activeBizId = businessId || getPharmacyBusinessId();
      const { data, error } = await supabase
        .from("pharmacy_cash_registers")
        .select("*")
        .eq("business_id", activeBizId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Register[] = (data || []).map((row: any) => {
        let name = "Caisse";
        let description: string | null = null;
        try {
          const parsed = JSON.parse(row.notes || "{}");
          if (parsed && typeof parsed === "object" && parsed.name) {
            name = parsed.name;
            description = parsed.description || null;
          } else {
            name = row.notes || "Caisse";
          }
        } catch {
          name = row.notes || "Caisse";
        }

        return {
          id: row.id,
          business_id: row.business_id,
          name,
          description,
          opening_balance: Number(row.initial_amount) || 0,
          current_balance: Number(row.expected_amount ?? row.initial_amount) || 0,
          status: (row.status as "open" | "closed") || "closed",
          opened_by: row.opened_by || null,
          opened_at: row.opened_at || null,
          closed_at: row.closed_at || null,
          created_at: row.created_at,
        };
      });

      setRegisters(mapped);
      if (typeof window !== "undefined") {
        localStorage.setItem("pharmacy_cached_registers_" + activeBizId, JSON.stringify(mapped));
      }
    } catch (e: any) {
      const activeBizId = businessId || getPharmacyBusinessId();
      const cached = typeof window !== "undefined" ? localStorage.getItem("pharmacy_cached_registers_" + activeBizId) : null;
      if (cached) {
        try { setRegisters(JSON.parse(cached)); } catch { setRegisters([]); }
      } else {
        setRegisters([]);
      }
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
      const activeBizId = businessId || getPharmacyBusinessId();
      const openingBal = Number(form.opening_balance) || 0;
      const notesPayload = JSON.stringify({
        name: form.name.trim(),
        description: form.description?.trim() || null,
      });

      if (editing) {
        const { error } = await supabase
          .from("pharmacy_cash_registers")
          .update({
            notes: notesPayload,
            initial_amount: openingBal,
          })
          .eq("id", editing.id);

        if (error) throw error;
        toast.success("Caisse modifiée");
      } else {
        const { error } = await supabase
          .from("pharmacy_cash_registers")
          .insert([{
            business_id: activeBizId,
            initial_amount: openingBal,
            expected_amount: openingBal,
            status: "closed",
            notes: notesPayload,
            opened_by: profile?.id || null,
          }]);

        if (error) throw error;
        toast.success("Caisse créée avec succès");
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
      const activeBizId = businessId || getPharmacyBusinessId();
      const newStatus = reg.status === "open" ? "closed" : "open";
      const updatePayload: any = { 
        status: newStatus,
        closed_at: newStatus === "closed" ? new Date().toISOString() : null,
        opened_at: newStatus === "open" ? new Date().toISOString() : reg.opened_at,
        closed_by: newStatus === "closed" ? (profile?.id || null) : null,
      };

      if (newStatus === "open") {
        // WhatsApp Alert
        const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const msg = `🟢 Caisse ouverte\n\nCaissier : ${profile?.full_name || "Caissier"}\nCaisse : ${reg.name}\nFond de caisse : ${Number(reg.current_balance || 0).toLocaleString()} HTG\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;
        whatsappService.sendWhatsAppMessageAsync(activeBizId, msg, "register_open", activeBizId);
      } else {
        // WhatsApp Alert
        const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const msg = `🔒 Caisse fermée\n\nCaissier : ${profile?.full_name || "Caissier"}\nCaisse : ${reg.name}\nFond de caisse final : ${Number(reg.current_balance || 0).toLocaleString()} HTG\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;
        whatsappService.sendWhatsAppMessageAsync(activeBizId, msg, "register_close", activeBizId);
      }

      const { error } = await supabase.from("pharmacy_cash_registers").update(updatePayload).eq("id", reg.id);
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
      const { error } = await supabase.from("pharmacy_cash_registers").delete().eq("id", deleteConfirm.id);
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
            { label: "Solde total", value: format(totalBalance), icon: <DollarSign className="h-5 w-5 text-primary" />, bg: "bg-primary/10" },
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
                      <TableHead>{t("common.description")}</TableHead>
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
              <Label>{t("common.description")}</Label>
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
