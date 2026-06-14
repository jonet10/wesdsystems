import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { listSales } from "@/modules/auto-parts/services/sales";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import InvoiceDocument from "@/modules/auto-parts/components/InvoiceDocument";
import { toast } from "sonner";
import { Search, FileText, Eye, User } from "lucide-react";
import type { AutoPartsSale, AutoPartsSaleItem } from "@/modules/auto-parts/types";

const fmt = (v: number) =>
  v.toLocaleString("fr-FR", { style: "currency", currency: "HTG", minimumFractionDigits: 2 });

type SaleWithItems = AutoPartsSale & { items: AutoPartsSaleItem[] };

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE:    { label: "Active",    variant: "default" },
  RETURNED:  { label: "Retournée", variant: "destructive" },
  CANCELLED: { label: "Annulée",   variant: "secondary" },
};

const PAYMENT_MAP: Record<string, string> = {
  paid: "Payée", partial: "Partielle", unpaid: "Impayée",
};

export default function AutoPartsInvoicesPage() {
  const businessId = useAutoPartsBusinessId();
  const { hasAutoPartsPermission, autoPartsStaffSession } = useAuth();
  const canViewAll = hasAutoPartsPermission(PERMISSIONS.REPORTS_VIEW);

  const [invoices, setInvoices] = useState<SaleWithItems[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SaleWithItems | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(true);

  // If strictly cashier, filter by their own staff_id; admin sees all
  const isStrictlyCashier = !canViewAll && autoPartsStaffSession?.role === "cashier";
  const cashierStaffId = isStrictlyCashier ? autoPartsStaffSession?.id : null;

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const [data, biz] = await Promise.all([
          listSales(businessId, null, cashierStaffId),
          getBusinessSettings(businessId).catch(() => null),
        ]);
        setInvoices(data);
        setBusiness(biz);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId, cashierStaffId]);

  const filtered = invoices.filter(
    (inv) =>
      !searchQ ||
      inv.invoice_number.toLowerCase().includes(searchQ.toLowerCase()) ||
      inv.client_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
      inv.staff_name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const viewInvoice = (sale: SaleWithItems) => {
    setSelectedInvoice(sale);
    setShowDetail(true);
  };

  const statusBadge = (inv: SaleWithItems) => {
    // Prefer explicit status column; fallback to refund_status logic
    const s = (inv as any).status as string | undefined;
    const info = s && STATUS_MAP[s] ? STATUS_MAP[s] : STATUS_MAP["ACTIVE"];
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  return (
    <DashboardLayout role="salon_admin" title="Factures" subtitle={cashierStaffId ? "Mes factures" : "Toutes les factures"}>
      <StaggerContainer>
        <StaggerItem>
          {isStrictlyCashier && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-sm text-indigo-700 dark:text-indigo-400">
              <User className="h-4 w-4" />
              <span>Affichage limité à vos factures — {autoPartsStaffSession?.name}</span>
            </div>
          )}

          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Numéro, client ou caissier..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="pl-10"
              />
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} facture(s)</span>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">N° Facture</th>
                    <th className="p-3 font-medium">Client</th>
                    {!isStrictlyCashier && <th className="p-3 font-medium">Caissier</th>}
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium text-right">Total</th>
                    <th className="p-3 font-medium">Paiement</th>
                    <th className="p-3 font-medium">Statut</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`border-b hover:bg-muted/50 ${(inv as any).status === "RETURNED" ? "opacity-60" : ""}`}
                    >
                      <td className="p-3 font-medium font-mono text-xs">{inv.invoice_number}</td>
                      <td className="p-3">{inv.client_name || "Client divers"}</td>
                      {!isStrictlyCashier && (
                        <td className="p-3 text-muted-foreground text-xs">{inv.staff_name || "—"}</td>
                      )}
                      <td className="p-3 text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(inv.total)}</td>
                      <td className="p-3">
                        <Badge variant={inv.payment_status === "paid" ? "default" : inv.payment_status === "partial" ? "secondary" : "destructive"}>
                          {PAYMENT_MAP[inv.payment_status] ?? inv.payment_status}
                        </Badge>
                      </td>
                      <td className="p-3">{statusBadge(inv)}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewInvoice(inv)}>
                          <Eye className="h-4 w-4 mr-1" /> Voir
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Aucune facture trouvée
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Facture {selectedInvoice?.invoice_number}
              {selectedInvoice && statusBadge(selectedInvoice)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            {selectedInvoice && (
              <InvoiceDocument
                data={{
                  invoice_number: selectedInvoice.invoice_number,
                  created_at: selectedInvoice.created_at,
                  client_name: selectedInvoice.client_name,
                  subtotal: selectedInvoice.subtotal,
                  tax_rate: selectedInvoice.tax_rate,
                  tax_amount: selectedInvoice.tax_amount,
                  discount_type: selectedInvoice.discount_type,
                  discount_value: selectedInvoice.discount_value,
                  discount_amount: selectedInvoice.discount_amount,
                  total: selectedInvoice.total,
                  payment_method: selectedInvoice.payment_method,
                  payment_status: selectedInvoice.payment_status,
                  notes: selectedInvoice.notes,
                  items: (selectedInvoice.items || []).map((item) => ({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                  })),
                }}
                business={business ? {
                  company_name: business.company_name || "",
                  logo_url: business.logo_url,
                  address: business.address,
                  phone: business.phone,
                  email: business.email,
                  nif: business.nif,
                  patente: business.patente,
                  rc: business.rc,
                  bank_name: business.bank_name,
                  bank_account: business.bank_account,
                  receipt_footer: business.receipt_footer,
                } : { company_name: "PIÈCES AUTO" }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
