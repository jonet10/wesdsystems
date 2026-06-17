import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, ArrowDownRight, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import type { SchoolExpense } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolExpenses() {
  const { user, profile, isAuthenticated } = useAuth();
  const { format: formatAmount } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [expenses, setExpenses] = useState<SchoolExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadExpenses = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("school_expenses")
        .select("*")
        .eq("business_id", businessId)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadExpenses();
  }, [isAuthenticated, businessId]);

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SchoolExpense | null>(null);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const CATEGORIES = ["Salaires", "Entretien", "Cantine", "Fournitures", "Loyer", "Électricité", "Eau", "Autre"];

  const resetForm = () => {
    setEditingExpense(null);
    setCategory("");
    setAmount("");
    setExpenseDate(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
  };

  const handleEdit = (exp: SchoolExpense) => {
    setEditingExpense(exp);
    setCategory(exp.category);
    setAmount(exp.amount.toString());
    setExpenseDate(exp.expense_date ? exp.expense_date.split("T")[0] : format(new Date(), "yyyy-MM-dd"));
    setDescription(exp.description || "");
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) { toast.error("Erreur de session (businessId manquant)"); return; }

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        category,
        amount: parseFloat(amount),
        expense_date: expenseDate || null,
        description: description || null,
        created_by: user?.id,
      };

      if (editingExpense) {
        await supabase.from("school_expenses").update(payload).eq("id", editingExpense.id);
        toast.success("Dépense mise à jour");
      } else {
        await supabase.from("school_expenses").insert([payload]);
        toast.success("Dépense enregistrée");
      }

      setIsDialogOpen(false);
      resetForm();
      loadExpenses();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette dépense ?")) return;
    try {
      await supabase.from("school_expenses").delete().eq("id", id);
      toast.success("Dépense supprimée");
      loadExpenses();
    } catch (error: any) {
      toast.error("Impossible de supprimer");
    }
  };

  const filteredExpenses = expenses.filter(exp => 
    `${exp.category} ${exp.description}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dépenses</h1>
            <p className="text-muted-foreground">
              Gérez les sorties d'argent et les charges de l'établissement
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Dépense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Modifier la dépense" : "Enregistrer une dépense"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3" 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                   >
                    <option value="">Sélectionner une catégorie</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Montant</Label>
                    <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description / Motif</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Paiement facture Électricité Mars..." />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total des dépenses (Global)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {formatAmount(expenses.reduce((sum, exp) => sum + Number(exp.amount), 0))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher une catégorie ou une description..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm border-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucune dépense trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-muted-foreground">
                        {expense.expense_date ? format(new Date(expense.expense_date), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                          {expense.category}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {expense.description || "-"}
                      </TableCell>
                      <TableCell className="font-semibold text-destructive">
                        <div className="flex items-center">
                          <ArrowDownRight className="h-4 w-4 mr-1" />
                          {formatAmount(expense.amount)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(expense.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
