import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId, resolveBranchScope } from "@/lib/branch";
import { toast } from "sonner";
import {
  Wallet, Search, Plus, Pencil, Trash2, Receipt,
  TrendingDown, Building, Lightbulb, ShoppingCart, Wrench
} from "lucide-react";
import { startOfMonth, endOfMonth, format as formatDate } from "date-fns";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";

interface Expense {
  id: string;
  branch_id: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  created_by?: string;
  created_at: string;
}

const expenseCategories = [
  "Loyer", "Électricité", "Eau", "Internet", "Téléphone",
  "Fournitures", "Entretien", "Marketing", "Salaires", "Transport",
  "Impôts", "Assurance", "Réparation", "Équipement", "Autre"
];

const categoryIcons: Record<string, any> = {
  Loyer: Building, Électricité: Lightbulb, Eau: Wrench,
  Fournitures: ShoppingCart, Marketing: TrendingDown, Autre: Receipt,
};

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const branchScope = resolveBranchScope(profile?.business_id, branchId);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: formatDate(startOfMonth(now), "yyyy-MM-dd"),
      end: formatDate(endOfMonth(now), "yyyy-MM-dd"),
    };
  });

  const loadExpenses = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("salon_expenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (branchScope) query = query.eq("branch_id", branchScope);

      if (dateRange.start) query = query.gte("created_at", `${dateRange.start}T00:00:00`);
      if (dateRange.end) query = query.lte("created_at", `${dateRange.end}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      setExpenses((data || []) as Expense[]);
    } catch (err: any) {
      toast.error("Erreur chargement dépenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadExpenses(); }, [dateRange, branchScope]);

  const resetForm = () => {
    setEditing(null);
    setCategory(""); setDescription(""); setAmount("0"); setPaymentMethod("cash");
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setCategory(e.category); setDescription(e.description);
    setAmount(String(e.amount)); setPaymentMethod(e.payment_method || "cash");
    setOpen(true);
  };

  const saveExpense = async () => {
    if (!category || !description.trim()) return toast.error("Catégorie et description requises");
    const payload = {
      category, description: description.trim(),
      amount: Number(amount || 0),
      payment_method: paymentMethod,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("salon_expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Dépense modifiée");
      } else {
        const { error } = await supabase.from("salon_expenses").insert([{
          ...payload, branch_id: branchScope,
        }]);
        if (error) throw error;
        toast.success("Dépense enregistrée");
      }
      setOpen(false); resetForm(); loadExpenses();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteExpense = async (expense: Expense) => {
    try {
      const { error } = await supabase.from("salon_expenses").delete().eq("id", expense.id);
      if (error) throw error;
      toast.success("Dépense supprimée");
      loadExpenses();
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = useMemo(() => {
    let result = expenses;
    if (search) result = result.filter(e =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
    );
    if (categoryFilter !== "Tous") result = result.filter(e => e.category === categoryFilter);
    return result;
  }, [expenses, search, categoryFilter]);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const categoryTotals = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Dépenses" subtitle="Gestion des dépenses">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Dépenses" subtitle="Gérez les dépenses de votre salon">
      <SubscriptionGuard>
        <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total dépenses</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{format(totalAmount)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nombre dépenses</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{filtered.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Moyenne</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {filtered.length > 0 ? format(totalAmount / filtered.length) : format(0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Catégorie principale</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("common.search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Toutes catégories</SelectItem>
                  {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-center">
              <div>
                <Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" />
              </div>
              <span className="text-muted-foreground">→</span>
              <div>
                <Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" />
              </div>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle dépense
              </Button>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">{t("common.date")}</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">{t("common.category")}</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">{t("common.description")}</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">{t("common.payment")}</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">{t("common.amount")}</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm">{formatDate(new Date(e.created_at), "dd/MM/yyyy")}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">{e.category}</Badge>
                      </td>
                      <td className="p-4 text-sm">{e.description}</td>
                      <td className="p-4 text-right text-sm capitalize text-muted-foreground">
                        {e.payment_method === "cash" ? "Espèces" :
                         e.payment_method === "moncash" ? "MonCash" :
                         e.payment_method === "natcash" ? "NatCash" : "Carte"}
                      </td>
                      <td className="p-4 text-right font-semibold text-destructive">{format(e.amount)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteExpense(e)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucune dépense trouvée</p>
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Catégorie *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Achats de fournitures" />
            </div>
            <div>
              <Label>Montant *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="moncash">MonCash</SelectItem>
                  <SelectItem value="natcash">NatCash</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveExpense}>{editing ? "Modifier" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
