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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { setPharmacyBusinessId, getPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { getRegisterSummaries, parseRegisterMeta } from "@/modules/pharmacy/services/registerService";
import { listPharmacyStaff, pharmacyRoleLabel } from "@/modules/pharmacy/services/staffService";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DollarSign, ShoppingBag, Monitor, Lock, Unlock, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { whatsappService } from "@/modules/pharmacy/services/whatsappService";

interface Register {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  opening_balance: number;
  cash_sales: number;
  sales_count: number;
  expenses: number;
  expected_balance: number;
  counted_balance: number | null;
  difference: number | null;
  status: "open" | "closed";
  opened_by: string | null;
  cashier_name: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

interface CashierOption {
  id: string;
  name: string;
  role: string;
}

const differenceClass = (value: number) => {
  if (Math.abs(value) < 0.005) return "text-muted-foreground";
  return value > 0 ? "text-warning" : "text-destructive";
};

export default function PharmacyRegisters() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const { profile } = useAuth();

  const [registers, setRegisters] = useState<Register[]>([]);
  const [cashiers, setCashiers] = useState<CashierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Register | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const [openDialog, setOpenDialog] = useState<Register | null>(null);
  const [openForm, setOpenForm] = useState({ cashier_id: "", opening_balance: "0" });

  const [closeDialog, setCloseDialog] = useState<Register | null>(null);
  const [closeForm, setCloseForm] = useState({ counted: "" });

  const [deleteConfirm, setDeleteConfirm] = useState<Register | null>(null);

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      setPharmacyBusinessId(businessId);
      load();
    }
  }, [businessId]);

  const fetchCashiers = async (activeBizId: string): Promise<CashierOption[]> => {
    let list: CashierOption[] = [];
    try {
      const staff = await listPharmacyStaff(activeBizId);
      list = staff
        .filter((member) => member.is_active)
        .map((member) => ({
          id: member.id,
          name: member.full_name || member.username || "Employé",
          role: member.role,
        }));
    } catch {
      // RPC de gestion des employés pas encore déployée : repli sur l'utilisateur courant.
    }

    if (profile?.id && !list.some((cashier) => cashier.id === profile.id)) {
      list = [
        { id: profile.id, name: profile.full_name || "Moi", role: profile.role || "" },
        ...list,
      ];
    }

    return list;
  };

  const load = async () => {
    setLoading(true);
    try {
      const activeBizId = businessId || getPharmacyBusinessId();
      const [registerResult, cashierList] = await Promise.all([
        supabase
          .from("pharmacy_cash_registers")
          .select("*")
          .eq("business_id", activeBizId)
          .order("created_at", { ascending: false }),
        fetchCashiers(activeBizId),
      ]);

      if (registerResult.error) throw registerResult.error;

      const rows = registerResult.data || [];
      const summaries = await getRegisterSummaries(
        activeBizId,
        rows.map((row: any) => row.id),
      );
      const nameById = new Map(cashierList.map((cashier) => [cashier.id, cashier.name]));

      const mapped: Register[] = rows.map((row: any) => {
        const meta = parseRegisterMeta(row.notes);
        const summary = summaries[row.id] || { salesCount: 0, cashSales: 0, expenses: 0 };
        const initial = Number(row.initial_amount) || 0;
        const counted =
          row.actual_amount === null || row.actual_amount === undefined
            ? null
            : Number(row.actual_amount);
        const reconciled = row.status === "closed" && counted !== null;
        const expected = reconciled
          ? Number(row.expected_amount) || 0
          : initial + summary.cashSales - summary.expenses;
        const difference = reconciled
          ? Number(row.difference ?? (counted - expected)) || 0
          : null;

        return {
          id: row.id,
          business_id: row.business_id,
          name: meta.name,
          description: meta.description,
          opening_balance: initial,
          cash_sales: summary.cashSales,
          sales_count: summary.salesCount,
          expenses: summary.expenses,
          expected_balance: expected,
          counted_balance: counted,
          difference,
          status: (row.status as "open" | "closed") || "closed",
          opened_by: row.opened_by || null,
          cashier_name: row.opened_by ? nameById.get(row.opened_by) || "Employé" : null,
          opened_at: row.opened_at || null,
          closed_at: row.closed_at || null,
          created_at: row.created_at,
        };
      });

      setCashiers(cashierList);
      setRegisters(mapped);
      if (typeof window !== "undefined") {
        localStorage.setItem("pharmacy_cached_registers_" + activeBizId, JSON.stringify(mapped));
      }
    } catch (e: any) {
      const activeBizId = businessId || getPharmacyBusinessId();
      const cached =
        typeof window !== "undefined"
          ? localStorage.getItem("pharmacy_cached_registers_" + activeBizId)
          : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setRegisters(
            (parsed || []).map((reg: any) => ({
              ...reg,
              opening_balance: Number(reg.opening_balance ?? reg.initial_amount) || 0,
              cash_sales: Number(reg.cash_sales) || 0,
              sales_count: Number(reg.sales_count) || 0,
              expenses: Number(reg.expenses) || 0,
              expected_balance:
                Number(reg.expected_balance ?? reg.current_balance ?? reg.opening_balance) || 0,
              counted_balance: reg.counted_balance ?? null,
              difference: reg.difference ?? null,
              cashier_name: reg.cashier_name ?? null,
            })),
          );
        } catch {
          setRegisters([]);
        }
      } else {
        setRegisters([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setOpen(true);
  };

  const openEdit = (register: Register) => {
    setEditing(register);
    setForm({ name: register.name, description: register.description || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    setSaving(true);
    try {
      const activeBizId = businessId || getPharmacyBusinessId();
      const notesPayload = JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
      });

      if (editing) {
        const { error } = await supabase
          .from("pharmacy_cash_registers")
          .update({ notes: notesPayload })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Caisse modifiée");
      } else {
        const { error } = await supabase.from("pharmacy_cash_registers").insert([
          {
            business_id: activeBizId,
            initial_amount: 0,
            expected_amount: 0,
            status: "closed",
            notes: notesPayload,
          },
        ]);
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

  const openOpenDialog = (register: Register) => {
    const isCashier = profile?.role === "pharmacy_cashier";
    const preferred =
      register.opened_by && cashiers.some((cashier) => cashier.id === register.opened_by)
        ? register.opened_by
        : profile?.id || "";

    setOpenDialog(register);
    setOpenForm({
      cashier_id: isCashier ? profile?.id || "" : preferred,
      opening_balance: String(register.opening_balance || 0),
    });
  };

  const handleOpenRegister = async () => {
    if (!openDialog) return;

    const isCashier = profile?.role === "pharmacy_cashier";
    const cashierId = isCashier ? profile?.id || "" : openForm.cashier_id;
    if (!cashierId) {
      toast.error("Sélectionnez le caissier responsable.");
      return;
    }

    const cashierName =
      cashiers.find((cashier) => cashier.id === cashierId)?.name || "Caissier";
    const alreadyOpen = registers.find(
      (register) =>
        register.id !== openDialog.id &&
        register.status === "open" &&
        register.opened_by === cashierId,
    );
    if (alreadyOpen) {
      toast.error(`${cashierName} a déjà la caisse « ${alreadyOpen.name} » ouverte.`);
      return;
    }

    const initial = Number(openForm.opening_balance);
    if (Number.isNaN(initial) || initial < 0) {
      toast.error("Le fond de caisse est invalide.");
      return;
    }

    setSaving(true);
    try {
      const activeBizId = businessId || getPharmacyBusinessId();
      const { error } = await supabase
        .from("pharmacy_cash_registers")
        .update({
          status: "open",
          opened_at: new Date().toISOString(),
          opened_by: cashierId,
          initial_amount: initial,
          expected_amount: initial,
          actual_amount: null,
          difference: null,
          closed_at: null,
          closed_by: null,
        })
        .eq("id", openDialog.id);

      if (error) throw error;

      const timeStr = new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const msg = `🟢 Caisse ouverte\n\nCaissier : ${cashierName}\nCaisse : ${openDialog.name}\nFond de caisse : ${initial.toLocaleString("fr-FR")} HTG\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;
      whatsappService.sendWhatsAppMessageAsync(activeBizId, msg, "register_open", activeBizId);

      toast.success(`Caisse « ${openDialog.name} » ouverte`);
      setOpenDialog(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur à l'ouverture de la caisse");
    } finally {
      setSaving(false);
    }
  };

  const openCloseDialog = async (register: Register) => {
    setCloseDialog(register);
    setCloseForm({ counted: "" });

    // Rafraîchir les montants au moment de fermer : des ventes ont pu être
    // enregistrées depuis le dernier chargement de la page.
    try {
      const activeBizId = businessId || getPharmacyBusinessId();
      const summaries = await getRegisterSummaries(activeBizId, [register.id]);
      const summary = summaries[register.id];
      if (summary) {
        setCloseDialog((current) =>
          current && current.id === register.id
            ? {
                ...current,
                cash_sales: summary.cashSales,
                sales_count: summary.salesCount,
                expenses: summary.expenses,
                expected_balance:
                  current.opening_balance + summary.cashSales - summary.expenses,
              }
            : current,
        );
      }
    } catch {
      // On garde les montants déjà chargés si le rafraîchissement échoue.
    }
  };

  const handleCloseRegister = async () => {
    if (!closeDialog) return;

    const raw = closeForm.counted.trim();
    if (raw === "") {
      toast.error("Saisissez le montant compté en caisse.");
      return;
    }

    const counted = Number(raw);
    if (Number.isNaN(counted) || counted < 0) {
      toast.error("Le montant compté est invalide.");
      return;
    }

    const expected = closeDialog.expected_balance;
    const difference = counted - expected;

    setSaving(true);
    try {
      const activeBizId = businessId || getPharmacyBusinessId();
      const { error } = await supabase
        .from("pharmacy_cash_registers")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: profile?.id || null,
          expected_amount: expected,
          actual_amount: counted,
          difference,
        })
        .eq("id", closeDialog.id);

      if (error) throw error;

      const timeStr = new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const sign = difference > 0 ? "+" : "";
      const msg = `🔒 Caisse fermée\n\nCaissier : ${closeDialog.cashier_name || "Caissier"}\nCaisse : ${closeDialog.name}\nFond de caisse : ${closeDialog.opening_balance.toLocaleString("fr-FR")} HTG\nVentes espèces : ${closeDialog.cash_sales.toLocaleString("fr-FR")} HTG\nDépenses : ${closeDialog.expenses.toLocaleString("fr-FR")} HTG\nAttendu : ${expected.toLocaleString("fr-FR")} HTG\nCompté : ${counted.toLocaleString("fr-FR")} HTG\nÉcart : ${sign}${difference.toLocaleString("fr-FR")} HTG\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;
      whatsappService.sendWhatsAppMessageAsync(activeBizId, msg, "register_close", activeBizId);

      toast.success(
        difference === 0
          ? "Caisse fermée : aucun écart"
          : `Caisse fermée : écart de ${sign}${difference.toLocaleString("fr-FR")} HTG`,
      );
      setCloseDialog(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur à la fermeture de la caisse");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.status === "open") {
      toast.error("Fermez la caisse avant de la supprimer.");
      return;
    }

    try {
      const { error } = await supabase
        .from("pharmacy_cash_registers")
        .delete()
        .eq("id", deleteConfirm.id);
      if (error) throw error;
      toast.success("Caisse supprimée");
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalOpen = registers.filter((register) => register.status === "open").length;
  const totalExpected = registers
    .filter((register) => register.status === "open")
    .reduce((sum, register) => sum + Number(register.expected_balance || 0), 0);
  const totalDifference = registers
    .filter((register) => register.status === "closed" && register.difference !== null)
    .reduce((sum, register) => sum + Number(register.difference || 0), 0);
  const roundedDifference = Math.abs(totalDifference) < 0.005 ? 0 : totalDifference;

  const countedPreview =
    closeForm.counted.trim() === "" ? null : Number(closeForm.counted);
  const previewDifference =
    closeDialog && countedPreview !== null && !Number.isNaN(countedPreview)
      ? countedPreview - closeDialog.expected_balance
      : null;

  return (
    <DashboardLayout
      role="salon_admin"
      title="Gestion des Caisses"
      subtitle="Caissier, ventes espèces, fond de caisse et rapprochement"
    >
      <StaggerContainer className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: "Caisses totales",
              value: registers.length,
              icon: <Monitor className="h-5 w-5 text-primary" />,
              bg: "bg-primary/10",
            },
            {
              label: "Caisses ouvertes",
              value: totalOpen,
              icon: <Unlock className="h-5 w-5 text-success" />,
              bg: "bg-success/10",
            },
            {
              label: "Attendu en caisse",
              value: format(totalExpected),
              icon: <DollarSign className="h-5 w-5 text-primary" />,
              bg: "bg-primary/10",
            },
            {
              label: "Écart cumulé",
              value: format(roundedDifference),
              icon: (
                <TrendingUp
                  className={`h-5 w-5 ${differenceClass(roundedDifference)}`}
                />
              ),
              bg: "bg-muted/50",
            },
          ].map((kpi, i) => (
            <StaggerItem key={i}>
              <Card className="border border-border/60 bg-card shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.bg}`}
                    >
                      {kpi.icon}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {kpi.label}
                      </p>
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
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Caisses enregistreuses</CardTitle>
                <Button
                  size="sm"
                  onClick={openCreate}
                  className="bg-primary hover:bg-primary-dark text-primary-fg shadow-sm"
                >
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
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez votre première caisse pour commencer
                  </p>
                  <Button
                    onClick={openCreate}
                    className="bg-primary hover:bg-primary-dark text-primary-fg"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Créer une caisse
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caisse</TableHead>
                      <TableHead>Caissier</TableHead>
                      <TableHead className="text-right">Fond</TableHead>
                      <TableHead className="text-right">Ventes espèces</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                      <TableHead className="text-right">Attendu</TableHead>
                      <TableHead className="text-right">Compté / Écart</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registers.map((register) => {
                      const difference = Number(register.difference || 0);
                      return (
                        <TableRow key={register.id}>
                          <TableCell>
                            <div className="font-semibold flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              {register.name}
                            </div>
                            {register.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {register.description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {register.cashier_name || "—"}
                            </div>
                            {register.opened_at && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(register.opened_at).toLocaleDateString("fr-FR")}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {format(register.opening_balance)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">{format(register.cash_sales)}</div>
                            <p className="text-xs text-muted-foreground">
                              {register.sales_count} vente{register.sales_count > 1 ? "s" : ""}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {register.expenses > 0 ? format(register.expenses) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {format(register.expected_balance)}
                          </TableCell>
                          <TableCell className="text-right">
                            {register.counted_balance !== null ? (
                              <div>
                                <div className="font-semibold">
                                  {format(register.counted_balance)}
                                </div>
                                <p
                                  className={`text-xs font-medium ${differenceClass(difference)}`}
                                >
                                  {difference > 0 ? "+" : ""}
                                  {format(difference)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={register.status === "open" ? "default" : "secondary"}
                              className={register.status === "open" ? "bg-emerald-600 text-white" : ""}
                            >
                              {register.status === "open" ? "Ouverte" : "Fermée"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {register.status === "open" ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openCloseDialog(register)}
                                >
                                  <Lock className="h-3.5 w-3.5 mr-1" /> Fermer
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-primary hover:bg-primary-dark text-primary-fg"
                                  onClick={() => openOpenDialog(register)}
                                >
                                  <Unlock className="h-3.5 w-3.5 mr-1" /> Ouvrir
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(register)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={register.status === "open"}
                                onClick={() => setDeleteConfirm(register)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Create / Edit Dialog */}
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
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Caisse principale"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optionnel"
                className="mt-1"
              />
            </div>
            {!editing && (
              <p className="text-xs text-muted-foreground">
                Le caissier et le fond de caisse se définissent au moment de l'ouverture.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary-dark text-primary-fg"
            >
              {saving ? "Enregistrement..." : editing ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Register Dialog */}
      <Dialog open={!!openDialog} onOpenChange={(value) => !value && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ouvrir la caisse — {openDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Caissier responsable *</Label>
              <Select
                value={openForm.cashier_id}
                onValueChange={(value) => setOpenForm({ ...openForm, cashier_id: value })}
                disabled={profile?.role === "pharmacy_cashier"}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un caissier" />
                </SelectTrigger>
                <SelectContent>
                  {cashiers.map((cashier) => (
                    <SelectItem key={cashier.id} value={cashier.id}>
                      {cashier.name}
                      {cashier.role?.startsWith("pharmacy_")
                        ? ` · ${pharmacyRoleLabel(cashier.role)}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cashiers.length <= 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Créez des comptes caissiers dans <strong>Employés</strong> pour les affecter
                  à une caisse.
                </p>
              )}
            </div>
            <div>
              <Label>Fond de caisse (espèces) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openForm.opening_balance}
                onChange={(e) =>
                  setOpenForm({ ...openForm, opening_balance: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleOpenRegister}
              disabled={saving}
              className="bg-primary hover:bg-primary-dark text-primary-fg"
            >
              {saving ? "Ouverture..." : "Ouvrir la caisse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={!!closeDialog} onOpenChange={(value) => !value && setCloseDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fermer la caisse — {closeDialog?.name}</DialogTitle>
          </DialogHeader>
          {closeDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Caissier</span>
                  <span className="font-medium">{closeDialog.cashier_name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fond de caisse</span>
                  <span>{format(closeDialog.opening_balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventes espèces</span>
                  <span>{format(closeDialog.cash_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dépenses</span>
                  <span>- {format(closeDialog.expenses)}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
                  <span>Montant attendu</span>
                  <span>{format(closeDialog.expected_balance)}</span>
                </div>
              </div>

              <div>
                <Label>Montant réellement compté en caisse *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closeForm.counted}
                  onChange={(e) => setCloseForm({ counted: e.target.value })}
                  placeholder="Saisir le montant compté"
                  className="mt-1"
                />
              </div>

              {previewDifference !== null && (
                <div
                  className={`rounded-lg border border-border/60 bg-muted/30 p-3 flex justify-between text-sm font-semibold ${differenceClass(previewDifference)}`}
                >
                  <span>Écart</span>
                  <span>
                    {previewDifference > 0 ? "+" : ""}
                    {format(previewDifference)}
                  </span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Un écart négatif signifie un manquant, un écart positif un excédent.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseRegister}
              disabled={saving}
            >
              {saving ? "Fermeture..." : "Fermer la caisse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p>
            Supprimer la caisse <strong>{deleteConfirm?.name}</strong> ? Cette action est
            irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
