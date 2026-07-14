import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Package, TrendingUp, TrendingDown, ArrowLeftRight, Search, ShoppingCart, AlertTriangle, Plus } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { productService } from "@/modules/pharmacy/services/productService";
import { inventoryService } from "@/modules/pharmacy/services/inventoryService";
import type { PharmacyProduct } from "@/modules/pharmacy/types";

interface StockMovement {
  id: string;
  product_id: string;
  batch_id: string | null;
  type: string;
  quantity: number;
  reference: string | null;
  created_at: string;
  product?: { name: string };
  batch?: { batch_number: string; expiration_date: string };
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  in:         { label: "Entrée",     color: "text-green-600",  icon: <TrendingUp className="h-4 w-4 text-green-500" />,   badgeVariant: "default" },
  sale:       { label: "Vente",      color: "text-blue-600",   icon: <ShoppingCart className="h-4 w-4 text-blue-500" />,  badgeVariant: "secondary" },
  out:        { label: "Sortie",     color: "text-red-600",    icon: <TrendingDown className="h-4 w-4 text-red-500" />,   badgeVariant: "destructive" },
  adjustment: { label: "Ajustement", color: "text-orange-600", icon: <ArrowLeftRight className="h-4 w-4 text-orange-500" />, badgeVariant: "outline" },
  return:     { label: "Retour",     color: "text-violet-600", icon: <Package className="h-4 w-4 text-violet-500" />,     badgeVariant: "outline" },
  expiry:     { label: "Périmé",     color: "text-red-700",    icon: <AlertTriangle className="h-4 w-4 text-red-700" />,  badgeVariant: "destructive" },
};

export default function PharmacyStock() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [batches, setBatches] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    product_id: "",
    batch_id: "",
    type: "in",
    quantity: "0",
    reference: ""
  });

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      load(businessId);
    }
  }, [businessId]);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [{ data: mvts, error }, { data: batchData }, prods] = await Promise.all([
        supabase
          .from("pharmacy_stock_movements")
          .select("*, product:product_id(name), batch:batch_id(batch_number, expiration_date)")
          .eq("business_id", bizId)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("pharmacy_batches")
          .select("*, product:product_id(name, min_stock_alert)")
          .eq("business_id", bizId)
          .gt("current_quantity", 0)
          .order("expiration_date", { ascending: true }),
        productService.getProducts(bizId)
      ]);
      if (error) throw error;
      setMovements(mvts || []);
      setBatches(batchData || []);
      setAllBatches(batchData || []);
      setProducts(prods || []);
    } catch (e: any) {
      toast.error("Erreur de chargement des mouvements: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = movements.filter(m => {
    const name = m.product?.name?.toLowerCase() || "";
    const ref = m.reference?.toLowerCase() || "";
    const matchSearch = name.includes(search.toLowerCase()) || ref.includes(search.toLowerCase());
    const matchType = typeFilter === "all" || m.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalIn = movements.filter(m => m.type === "in").reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => ["sale", "out", "expiry"].includes(m.type)).reduce((s, m) => s + m.quantity, 0);
  const expiringSoon = batches.filter(b => {
    const daysLeft = Math.ceil((new Date(b.expiration_date).getTime() - Date.now()) / 86400000);
    return daysLeft <= 30 && daysLeft >= 0;
  });

  const openCreate = () => {
    setForm({
      product_id: "",
      batch_id: "",
      type: "in",
      quantity: "0",
      reference: ""
    });
    setOpen(true);
  };

  const handleProductChange = (productId: string) => {
    setForm({
      ...form,
      product_id: productId,
      batch_id: "" // reset batch selection
    });
  };

  const handleSave = async () => {
    if (!form.product_id || !form.quantity || Number(form.quantity || 0) <= 0) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const payload = {
        product_id: form.product_id,
        batch_id: form.batch_id || null,
        type: form.type,
        quantity: Number(form.quantity || 0),
        reference: form.reference || null
      };

      await inventoryService.createStockMovement(payload, businessId || undefined);
      toast.success("Mouvement de stock enregistré");
      setOpen(false);
      if (businessId) load(businessId);
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement : " + e.message);
    }
  };

  const filteredBatches = allBatches.filter(b => b.product_id === form.product_id);

  return (
    <DashboardLayout role="salon_admin" title="Stock & Mouvements" subtitle="Historique des entrées, ventes et ajustements de stock">
      <StaggerContainer className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Entrées totales", value: totalIn + " unités", icon: <TrendingUp className="h-5 w-5 text-green-500" />, bg: "bg-green-50 dark:bg-green-500/10" },
            { label: "Sorties totales", value: totalOut + " unités", icon: <TrendingDown className="h-5 w-5 text-red-500" />, bg: "bg-red-50 dark:bg-red-500/10" },
            { label: "Mouvements", value: movements.length, icon: <ArrowLeftRight className="h-5 w-5 text-blue-500" />, bg: "bg-blue-50 dark:bg-blue-500/10" },
            { label: "Lots expirant ≤30j", value: expiringSoon.length, icon: <AlertTriangle className="h-5 w-5 text-orange-500" />, bg: "bg-orange-50 dark:bg-orange-500/10" },
          ].map((kpi, i) => (
            <StaggerItem key={i}>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.bg}`}>{kpi.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                      <p className="text-xl font-bold">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </div>

        {/* Lots expirant bientôt */}
        {expiringSoon.length > 0 && (
          <StaggerItem>
            <Card className="border border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-orange-700 dark:text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> {expiringSoon.length} lot(s) expirant dans les 30 prochains jours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {expiringSoon.map(b => {
                    const daysLeft = Math.ceil((new Date(b.expiration_date).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={b.id} className="rounded-lg border border-orange-200 bg-white dark:bg-orange-900/10 p-3 text-sm">
                        <p className="font-semibold">{b.product?.name}</p>
                        <p className="text-muted-foreground">Lot : {b.batch_number}</p>
                        <p className="text-muted-foreground">Qté : {b.current_quantity} unités</p>
                        <p className="text-orange-600 font-medium">Exp : {new Date(b.expiration_date).toLocaleDateString("fr-FR")} ({daysLeft}j)</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        )}

        {/* Mouvements */}
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="text-base">Historique des mouvements</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Produit ou référence..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 h-9 w-52"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="in">Entrées</SelectItem>
                      <SelectItem value="sale">Ventes</SelectItem>
                      <SelectItem value="out">Sorties</SelectItem>
                      <SelectItem value="adjustment">Ajustements</SelectItem>
                      <SelectItem value="return">Retours</SelectItem>
                      <SelectItem value="expiry">Périmés</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={openCreate} className="h-9 bg-purple-600 hover:bg-purple-700 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Ajuster le Stock
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">{t("common.loading")}</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun mouvement trouvé</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("common.type")}</TableHead>
                      <TableHead>{t("common.product")}</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>{t("common.quantity")}</TableHead>
                      <TableHead>Référence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(m => {
                      const cfg = TYPE_CONFIG[m.type] || { label: m.type, color: "", icon: null, badgeVariant: "outline" as const };
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(m.created_at).toLocaleDateString("fr-FR")}
                            <span className="ml-1 text-xs">{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {cfg.icon}
                              <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{m.product?.name || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.batch?.batch_number || "-"}</TableCell>
                          <TableCell className={`font-semibold ${cfg.color}`}>
                            {["in", "return", "adjustment"].includes(m.type) ? "+" : "-"}{m.quantity}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.reference || "-"}</TableCell>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enregistrer un Ajustement de Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Médicament / Produit *</Label>
              <Select value={form.product_id} onValueChange={handleProductChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le produit..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type de mouvement *</Label>
              <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrée (Don, Approvisionnement manuel)</SelectItem>
                  <SelectItem value="out">Sortie (Perte, Casse, Consommation)</SelectItem>
                  <SelectItem value="adjustment">Ajustement positif</SelectItem>
                  <SelectItem value="expiry">Périmé (Retrait du stock)</SelectItem>
                  <SelectItem value="return">Retour (Client/Fournisseur)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Lot associé (Optionnel mais recommandé)</Label>
              <Select value={form.batch_id} onValueChange={(val) => setForm({ ...form, batch_id: val })} disabled={!form.product_id}>
                <SelectTrigger>
                  <SelectValue placeholder={form.product_id ? "Sélectionner un lot..." : "Sélectionnez d'abord un produit"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredBatches.map(b => (
                    <SelectItem key={b.id} value={b.id}>Lot {b.batch_number} - Restant : {b.current_quantity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantité *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Référence / Raison</Label>
              <Input placeholder="Ex: Ajustement inventaire de fin de mois" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.product_id || !form.quantity || Number(form.quantity || 0) <= 0}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
