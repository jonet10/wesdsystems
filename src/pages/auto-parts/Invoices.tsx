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
import { listSales, getSale } from "@/modules/auto-parts/services/sales";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import InvoiceDocument from "@/modules/auto-parts/components/InvoiceDocument";
import { toast } from "sonner";
import { Search, FileText, Eye } from "lucide-react";
import type { AutoPartsSale, AutoPartsSaleItem } from "@/modules/auto-parts/types";

const fmt = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "HTG", minimumFractionDigits: 2 });

type SaleWithItems = AutoPartsSale & { items: AutoPartsSaleItem[] };

export default function AutoPartsInvoicesPage() {
  const businessId = useAutoPartsBusinessId();
  const [invoices, setInvoices] = useState<SaleWithItems[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SaleWithItems | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const [data, biz] = await Promise.all([
          listSales(businessId),
          getBusinessSettings(businessId).catch(() => null),
        ]);
        setInvoices(data);
        setBusiness(biz);
      } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    })();
  }, [businessId]);

  const viewInvoice = async (sale: SaleWithItems) => {
    setSelectedInvoice(sale);
    setShowDetail(true);
  };

  const filtered = invoices.filter((inv) =>
    !searchQ ||
    inv.invoice_number.toLowerCase().includes(searchQ.toLowerCase()) ||
    inv.client_name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { paid: "default", partial: "secondary", unpaid: "destructive" };
    return <Badge variant={map[status] as any}>{status === "paid" ? "Payée" : status === "partial" ? "Partielle" : "Impayée"}</Badge>;
  };

  return (
    <DashboardLayout role="salon_admin" title="Factures" subtitle="Gestion des factures">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Numéro ou client..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-10" />
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">N° Facture</th>
                    <th className="p-3 font-medium">Client</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium text-right">Total</th>
                    <th className="p-3 font-medium">Statut</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{inv.invoice_number}</td>
                      <td className="p-3">{inv.client_name || "Client divers"}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(inv.total)}</td>
                      <td className="p-3">{statusBadge(inv.payment_status)}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewInvoice(inv)}>
                          <Eye className="h-4 w-4 mr-1" /> Voir
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune facture trouvée</td></tr>
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
            <DialogTitle>Facture {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            {selectedInvoice && business && (
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
                business={{
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
                }}
              />
            )}
            {selectedInvoice && !business && (
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
                business={{ company_name: "PIÈCES AUTO" }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
