import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { listPharmacyCashiers } from "@/modules/pharmacy/services/staffService";
import { toast } from "sonner";
import {
  AlertTriangle,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

interface SaleRow {
  id: string;
  receipt_number: string;
  created_at: string;
  total: number;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  cashier_name: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  moncash: "MonCash",
  natcash: "NatCash",
  transfer: "Virement",
  credit: "Crédit",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Payée",
  credit: "Crédit",
  partial: "Partielle",
};

export default function PharmacySales() {
  const businessId = usePharmacyBusinessId();
  const { format } = useCurrency();
  const { profile } = useAuth();

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SaleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = ["salon_admin", "pharmacy_admin", "pharmacy_manager"].includes(
    profile?.role || "",
  );

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [salesResult, staff] = await Promise.all([
        supabase
          .from("pharmacy_sales")
          .select(
            "id, receipt_number, created_at, total, payment_method, payment_status, customer_id, created_by, customer:customer_id(first_name, last_name)",
          )
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(300),
        listPharmacyCashiers(businessId).catch(() => []),
      ]);

      if (salesResult.error) throw salesResult.error;

      const staffNames = new Map<string, string>();
      (staff || []).forEach((member) => {
        staffNames.set(member.id, member.full_name || member.username || "Employé");
      });

      const rows: SaleRow[] = ((salesResult.data as any[]) || []).map((sale) => {
        const customer = sale.customer;
        const customerName = customer
          ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
          : "";

        return {
          id: sale.id,
          receipt_number: sale.receipt_number,
          created_at: sale.created_at,
          total: Number(sale.total) || 0,
          payment_method: sale.payment_method,
          payment_status: sale.payment_status,
          customer_name: customerName || "Client de passage",
          cashier_name:
            (sale.created_by && staffNames.get(sale.created_by)) || "—",
        };
      });

      setSales(rows);
    } catch (e: any) {
      toast.error(e.message || "Impossible de charger les ventes");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sales;

    return sales.filter((sale) => {
      const haystack = [
        sale.receipt_number,
        sale.customer_name,
        sale.cashier_name,
        PAYMENT_LABELS[sale.payment_method] || sale.payment_method,
        new Date(sale.created_at).toLocaleDateString("fr-FR"),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sales, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await salesService.deleteSale(deleteTarget.id, businessId);
      toast.success(`Vente ${deleteTarget.receipt_number} supprimée`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la suppression de la vente");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Ventes"
      subtitle="Historique des ventes — suppression et correction des erreurs"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Toutes les ventes
                </CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Ticket, client, caissier..."
                      className="pl-8 sm:w-64"
                    />
                  </div>
                  <Button variant="outline" onClick={load} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Actualiser
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-10">
                  Chargement des ventes...
                </p>
              ) : filteredSales.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Aucune vente trouvée</p>
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? "Aucun résultat pour cette recherche."
                      : "Les ventes du POS apparaîtront ici."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Caissier</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {new Date(sale.created_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {sale.receipt_number}
                          </TableCell>
                          <TableCell>{sale.customer_name}</TableCell>
                          <TableCell>{sale.cashier_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm">
                                {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                              </span>
                              <Badge
                                variant={sale.payment_status === "paid" ? "default" : "secondary"}
                                className="w-fit"
                              >
                                {STATUS_LABELS[sale.payment_status] || sale.payment_status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {format(sale.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {canDelete ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(sale)}
                                title="Supprimer la vente"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {canDelete && sales.length > 0 && (
          <StaggerItem>
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                La suppression d'une vente restaure automatiquement le stock des lots
                concernés et retire la vente des rapports et des totaux de caisse.
                Utilisez-la uniquement pour corriger une vente erronée.
              </p>
            </div>
          </StaggerItem>
        )}
      </StaggerContainer>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la vente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              Voulez-vous vraiment supprimer la vente{" "}
              <strong>{deleteTarget?.receipt_number}</strong> du{" "}
              {deleteTarget
                ? new Date(deleteTarget.created_at).toLocaleDateString("fr-FR")
                : ""}{" "}
              ({deleteTarget ? format(deleteTarget.total) : ""}) ?
            </p>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Cette action est irréversible. Le stock sera restauré et la vente
              disparaîtra des rapports.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
