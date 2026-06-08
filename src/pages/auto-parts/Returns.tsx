import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listReturns, processReturn } from "@/modules/auto-parts/services/returns";
import { getSale } from "@/modules/auto-parts/services/sales";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { ArrowLeftRight, Search } from "lucide-react";
import type { AutoPartsSale, AutoPartsSaleItem } from "@/modules/auto-parts/types";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  max_quantity: number;
}

export default function AutoPartsReturnsPage() {
  const businessId = useAutoPartsBusinessId();
  const { hasAutoPartsPermission } = useAuth();
  const { format } = useCurrency();
  const canManage = hasAutoPartsPermission(PERMISSIONS.RETURNS_MANAGE);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [foundSale, setFoundSale] = useState<(AutoPartsSale & { items: AutoPartsSaleItem[] }) | null>(null);
  const [searching, setSearching] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await listReturns(businessId)); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const openNewReturn = () => {
    setInvoiceSearch("");
    setFoundSale(null);
    setReturnItems([]);
    setReason("");
    setOpen(true);
  };

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setSearching(true);
    setFoundSale(null);
    try {
      const sales = businessId
        ? await (await import("@/modules/auto-parts/services/sales")).listSales(businessId)
        : [];
      const sale = sales.find((s: any) => s.invoice_number.toLowerCase() === invoiceSearch.trim().toLowerCase());
      if (!sale) {
        toast.error("Facture introuvable");
        setSearching(false);
        return;
      }
      setFoundSale(sale);
      setReturnItems(
        (sale.items || []).map((item: AutoPartsSaleItem) => ({
          product_id: item.product_id ?? "",
          product_name: item.product_name,
          quantity: 0,
          unit_price: item.unit_price,
          max_quantity: item.quantity,
        }))
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const updateReturnQty = (idx: number, qty: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantity: Math.min(Math.max(0, qty), item.max_quantity) } : item
      )
    );
  };

  const toggleReturnItem = (idx: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantity: item.quantity > 0 ? 0 : item.max_quantity } : item
      )
    );
  };

  const handleProcessReturn = async () => {
    if (!businessId || !foundSale) return;
    const items = returnItems.filter((i) => i.quantity > 0);
    if (items.length === 0) {
      toast.error("Sélectionnez au moins un article à retourner");
      return;
    }
    setProcessing(true);
    try {
      const result = await processReturn(
        businessId,
        foundSale.id,
        items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        reason || undefined
      );
      if (!result.success) {
        toast.error(result.error || "Erreur lors du retour");
      } else {
        toast.success(`Retour ${result.refund_status === "full" ? "total" : "partiel"} enregistré`);
        setOpen(false);
        load();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Retours produits" subtitle="Gestion des retours et remboursements">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Retours" description={`${data.length} retour(s)`} action={canManage ? { label: "Nouveau retour", onClick: openNewReturn } : undefined} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleString("fr-FR") },
              { key: "product", label: "Produit", render: (r) => r.product?.name ?? "-" },
              { key: "quantity", label: "Qté retournée", render: (r) => <span className="text-green-600 font-medium">+{r.quantity}</span> },
              { key: "sale", label: "Facture", render: (r) => r.sale?.invoice_number ?? r.reference ?? "-" },
              { key: "client", label: "Client", render: (r) => r.sale?.client_name ?? "-" },
              { key: "notes", label: "Motif", render: (r) => r.notes || "-" },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau retour produit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro de facture (INV-...)"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchInvoice()}
                  className="pl-10"
                />
              </div>
              <Button onClick={searchInvoice} disabled={searching}>
                {searching ? "..." : "Chercher"}
              </Button>
            </div>

            {foundSale && (
              <>
                <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold">{foundSale.invoice_number}</span>
                      {foundSale.client_name && (
                        <span className="text-muted-foreground ml-4">Client: {foundSale.client_name}</span>
                      )}
                    </div>
                    <Badge variant={foundSale.refund_status === "full" ? "destructive" : foundSale.refund_status === "partial" ? "secondary" : "outline"}>
                      {foundSale.refund_status === "full" ? "Retourné" : foundSale.refund_status === "partial" ? "Partiel" : "Aucun retour"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total: {format(foundSale.total)} | {new Date(foundSale.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>

                <div>
                  <Label>Articles à retourner</Label>
                  <div className="border rounded-md mt-1">
                    {returnItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/20">
                        <input
                          type="checkbox"
                          checked={item.quantity > 0}
                          onChange={() => toggleReturnItem(idx)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{format(item.unit_price)}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Max: {item.max_quantity}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          max={item.max_quantity}
                          value={item.quantity}
                          onChange={(e) => updateReturnQty(idx, Number(e.target.value))}
                          className="w-20 h-8 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Motif du retour (optionnel)</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Raison du retour..."
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span>Articles sélectionnés: {returnItems.filter(i => i.quantity > 0).length}</span>
                    <span>Quantité totale: {returnItems.reduce((s, i) => s + i.quantity, 0)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleProcessReturn} disabled={!foundSale || processing || returnItems.filter(i => i.quantity > 0).length === 0}>
              {processing ? "Traitement..." : "Valider le retour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
