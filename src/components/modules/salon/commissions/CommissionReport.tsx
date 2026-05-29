import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface CommissionSummary {
  employee_id: string;
  employee_name: string;
  total_sales: number;
  total_commission: number;
  transaction_count: number;
}

interface Props {
  businessId: string;
}

export function CommissionReport({ businessId }: Props) {
  const { format } = useCurrency();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [date, setDate] = useState(new Date());
  const [data, setData] = useState<CommissionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let start: Date;
      let end: Date;

      if (period === "daily") {
        start = new Date(date);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      } else if (period === "weekly") {
        start = new Date(date);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
      } else {
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      }

      const { data: txns } = await supabase
        .from("commission_transactions")
        .select("employee_id, sale_amount, commission_amount")
        .eq("business_id", businessId)
        .gte("calculated_at", start.toISOString())
        .lt("calculated_at", end.toISOString())
        .neq("status", "cancelled");

      if (txns && txns.length > 0) {
        const { data: employees } = await supabase
          .from("employees")
          .select("id, name")
          .eq("business_id", businessId);

        const grouped: Record<string, CommissionSummary> = {};
        for (const t of txns) {
          if (!grouped[t.employee_id]) {
            const emp = employees?.find((e: any) => e.id === t.employee_id);
            grouped[t.employee_id] = {
              employee_id: t.employee_id,
              employee_name: emp?.name || "Inconnu",
              total_sales: 0,
              total_commission: 0,
              transaction_count: 0,
            };
          }
          grouped[t.employee_id].total_sales += Number(t.sale_amount || 0);
          grouped[t.employee_id].total_commission += Number(t.commission_amount || 0);
          grouped[t.employee_id].transaction_count += 1;
        }
        setData(Object.values(grouped));
      } else {
        setData([]);
      }
      setLoading(false);
    };
    load();
  }, [businessId, period, date]);

  const adjustDate = (dir: number) => {
    const d = new Date(date);
    if (period === "daily") d.setDate(d.getDate() + dir);
    else if (period === "weekly") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(d);
  };

  const periodLabel = date.toLocaleDateString("fr-FR", {
    ...(period === "daily" && { day: "numeric", month: "long", year: "numeric" }),
    ...(period === "weekly" && { day: "numeric", month: "long" }),
    ...(period === "monthly" && { month: "long", year: "numeric" }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Commissions
          </CardTitle>
          <div className="flex items-center gap-1">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPeriod(p)}
              >
                {p === "daily" ? "Jour" : p === "weekly" ? "Semaine" : "Mois"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{periodLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">Chargement...</div>
        ) : data.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Aucune commission pour cette période
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((d) => (
              <div key={d.employee_id} className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
                <div>
                  <p className="font-medium text-sm">{d.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.transaction_count} transaction{d.transaction_count > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-success">{format(d.total_commission)}</p>
                  <p className="text-xs text-muted-foreground">
                    Ventes: {format(d.total_sales)}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex justify-between font-bold text-sm pt-2 border-t">
              <span>Total</span>
              <span className="text-success">
                {format(data.reduce((s, d) => s + d.total_commission, 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
