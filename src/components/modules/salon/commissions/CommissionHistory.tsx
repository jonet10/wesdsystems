import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommissionHistory({ employeeId, employeeName, open, onOpenChange }: Props) {
  const { format } = useCurrency();
  const [txs, setTxs] = useState<CommissionTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("commission_transactions")
        .select("*")
        .eq("employee_id", employeeId)
        .order("calculated_at", { ascending: false })
        .limit(50);
      setTxs((data || []) as CommissionTx[]);
      setLoading(false);
    };
    load();
  }, [employeeId, open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Commission — {employeeName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
        ) : txs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune commission enregistrée</p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {txs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.calculated_at).toLocaleDateString("fr-FR")}
                    </p>
                    <p className="text-sm font-medium">
                      {tx.rate_type === "percentage"
                        ? `${tx.rate_value}% sur ${format(tx.sale_amount)}`
                        : `${format(tx.rate_value)} fixe`}
                    </p>
                    {statusBadge(tx.status)}
                  </div>
                  <span className="text-sm font-semibold text-success">
                    {format(tx.commission_amount)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
