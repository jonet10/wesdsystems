import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { useStationeryPermissions } from "@/modules/stationery/hooks/useStationeryPermissions";
import { listExpenses, createExpense, updateExpense, deleteExpense, StationeryExpense } from "@/modules/stationery/services/expenses";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Loader2, Plus, Calendar, DollarSign } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

const CATEGORIES = [
  "Achat de marchandises",
  "Loyer",
  "Électricité",
  "Internet",
  "Salaires",
  "Transport",
  "Entretien",
  "Marketing",
  "Autre"
];

export default function Expenses() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { hasStationeryPermission } = useStationeryPermissions();
  const { format } = useCurrency();
  const canManage = hasStationeryPermission(PERMISSIONS.EXPENSES_MANAGE);
  
  const [data, setData] = useState<StationeryExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StationeryExpense | null>(null);
  
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: CATEGORIES[0],
    amount: 0,
    description: "",
    payment_method: "cash"
  });

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setData(await listExpenses(businessId, null));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((e) => {
    const term = search.toLowerCase();
    if (search && !e.description?.toLowerCase().includes(term) && !(e.category?.toLowerCase().includes(term))) return false;
    return true;
  });

  const totalExpenses = filtered.reduce((acc, exp) => acc + exp.amount, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({
      expense_date: new Date().toISOString().split("T")[0],
      category: CATEGORIES[0],
      amount: 0,
      description: "",
      payment_method: "cash"
    });
    setOpen(true);
  };

  const openEdit = (e: StationeryExpense) => {
    setEditing(e);
    setForm({
      expense_date: e.expense_date,
      category: e.category,
      amount: e.amount,
      description: e.description ?? "",
      payment_method: e.payment_method ?? "cash"
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    if (form.amount <= 0) {
      toast.error("Le montant doit être supérieur à zéro");
      return;
    }
    
    try {
      setSaving(true);
      if (editing) { 
        await updateExpense(editing.id, businessId, form); 
        toast.success("Dépense mise à jour"); 
      } else { 
        await createExpense(businessId, null, form); 
        toast.success("Dépense ajoutée"); 
      }
      setOpen(false); 
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette dépense ?")) return;
    try { 
      await deleteExpense(id, businessId); 
      toast.success("Dépense supprimée"); 
      load(); 
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Dépenses" subtitle="Gestion des frais de fonctionnement">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher une dépense..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-muted px-4 py-2 rounded-lg border border-border">
                <span className="text-sm text-muted-foreground mr-2">Total affiché:</span>
                <span className="font-bold">{format(totalExpenses)}</span>
              </div>
              
              {canManage && (
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" /> Nouvelle Dépense
                </Button>
              )}
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  {canManage && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Aucune dépense trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {new Date(e.expense_date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell>{e.description || "-"}</TableCell>
                      <TableCell className="capitalize">{e.payment_method}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        -{format(e.amount)}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier la dépense" : "Nouvelle Dépense"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-9"
                    value={form.expense_date} 
                    onChange={e => setForm({ ...form, expense_date: e.target.value })} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Catégorie</Label>
                  <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Montant</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="pl-9"
                      value={form.amount} 
                      onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Mode de paiement</Label>
                <Select value={form.payment_method} onValueChange={(val) => setForm({ ...form, payment_method: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="card">Carte Bancaire</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                    <SelectItem value="moncash">MonCash</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="Détails de la dépense..."
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving || form.amount <= 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
