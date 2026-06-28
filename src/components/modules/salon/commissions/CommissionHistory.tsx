import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer } from "lucide-react";

interface CommissionTx {
  id: string;
  service_id: string | null;
  rate_type: string;
  rate_value: number;
  sale_amount: number;
  commission_amount: number;
  status: string;
  calculated_at: string;
  paid_at: string | null;
}

interface Props {
  employeeId: string;
  employeeName: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function CommissionHistory({ employeeId, employeeName, open, onOpenChange }: Props) {
  const { format } = useCurrency();
  const [txs, setTxs] = useState<CommissionTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState<"week" | "month" | "all">("all");
  const isControlledDialog = open !== undefined && !!onOpenChange;
  const isVisible = open ?? true;

  useEffect(() => {
    if (!isVisible) return;
    const load = async () => {
      setLoading(true);
      
      let query = supabase
        .from("commission_transactions")
        .select("*")
        .eq("employee_id", employeeId);

      if (filterRange === "week") {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        query = query.gte("calculated_at", startOfWeek.toISOString());
      } else if (filterRange === "month") {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        query = query.gte("calculated_at", startOfMonth.toISOString());
      }

      const { data } = await query
        .order("calculated_at", { ascending: false })
        .limit(100);

      setTxs((data || []) as CommissionTx[]);
      setLoading(false);
    };
    load();
  }, [employeeId, isVisible, filterRange]);

  const totalCommissions = useMemo(() => {
    return txs.reduce((acc, tx) => acc + Number(tx.commission_amount || 0), 0);
  }, [txs]);

  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const rangeLabel = filterRange === "week" ? "Cette semaine" : filterRange === "month" ? "Ce mois-ci" : "Toutes";
    
    const rowsHtml = txs.map(tx => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(tx.calculated_at).toLocaleDateString("fr-FR")}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          ${tx.rate_type === "percentage" ? `${tx.rate_value}% sur ${format(tx.sale_amount)}` : `${format(tx.rate_value)} fixe`}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          ${tx.status === "paid" ? "Payé" : tx.status === "approved" ? "Approuvé" : tx.status === "cancelled" ? "Annulé" : "En attente"}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: #10b981;">
          ${format(tx.commission_amount)}
        </td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Rapport de Commissions - ${employeeName}</title>
          <style>
            body { font-family: sans-serif; color: #333; padding: 20px; }
            h1 { margin-bottom: 5px; font-size: 24px; }
            h2 { color: #666; margin-top: 0; font-weight: normal; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f3f4f6; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; padding-top: 10px; border-top: 2px solid #333; }
          </style>
        </head>
        <body>
          <h1>Rapport de Commissions</h1>
          <h2>Employé : <strong>${employeeName}</strong></h2>
          <p>Période : ${rangeLabel}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Calcul</th>
                <th>Statut</th>
                <th style="text-align: right;">Commission</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="total">Total Commissions : ${format(totalCommissions)}</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    const labels: Record<string, string> = {
      pending: "En attente",
      approved: "Approuvé",
      paid: "Payé",
      cancelled: "Annulé",
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  const content = (
    <div className="space-y-4">
      {/* Filters and Print bar */}
      <div className="flex items-center justify-between gap-4 pb-1">
        <div className="flex gap-1.5">
          {(["all", "week", "month"] as const).map((r) => (
            <Button
              key={r}
              variant={filterRange === r ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px] px-2.5"
              onClick={() => setFilterRange(r)}
            >
              {r === "all" ? "Tous" : r === "week" ? "Cette semaine" : "Ce mois"}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2.5"
          onClick={handlePrintReport}
          disabled={txs.length === 0}
        >
          <Printer className="h-3 w-3" /> Imprimer
        </Button>
      </div>

      {/* Commissions Total */}
      <div className="flex justify-between items-center bg-muted/40 border border-border/80 rounded-lg p-3 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">Total des commissions</span>
        <span className="text-base font-bold text-success">{format(totalCommissions)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
      ) : txs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune commission enregistrée</p>
      ) : (
        <ScrollArea className="max-h-[45vh]">
          <div className="space-y-2 pr-1">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.calculated_at).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-sm font-medium">
                    {tx.rate_type === "percentage"
                      ? `${tx.rate_value}% sur ${format(tx.sale_amount)}`
                      : `${format(tx.rate_value)} fixe`}
                  </p>
                  <div className="mt-1">
                    {statusBadge(tx.status)}
                  </div>
                </div>
                <span className="text-sm font-semibold text-success">
                  {format(tx.commission_amount)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  if (!isControlledDialog) return content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Commission — {employeeName}</DialogTitle>
          <DialogDescription>
            Consultez l'historique des commissions calculées pour cet employé.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto pt-2">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
