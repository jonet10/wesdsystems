import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DEFAULT_PLATFORM_TIME_ZONE,
  getDateKeyInTimeZone,
  getDayRangeInTimeZone,
  shiftDateKey,
} from "@/lib/timezone-date";

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
      const selectedDateKey = getDateKeyInTimeZone(date, DEFAULT_PLATFORM_TIME_ZONE);
      let startKey: string;
      let endKey: string;

      if (period === "daily") {
        startKey = selectedDateKey;
        endKey = selectedDateKey;
      } else if (period === "weekly") {
        startKey = shiftDateKey(selectedDateKey, -6);
        endKey = selectedDateKey;
      } else {
        startKey = `${selectedDateKey.slice(0, 7)}-01`;
        endKey = selectedDateKey;
      }
      const start = getDayRangeInTimeZone(startKey, DEFAULT_PLATFORM_TIME_ZONE).start;
      const end = getDayRangeInTimeZone(endKey, DEFAULT_PLATFORM_TIME_ZONE).end;

      const { data: txns } = await supabase
        .from("commission_transactions")
        .select("employee_id, sale_amount, commission_amount")
        .eq("business_id", businessId)
        .gte("calculated_at", start)
        .lte("calculated_at", end)
        .neq("status", "cancelled");

      if (txns && txns.length > 0) {
        const [{ data: branchRows }, { data: legacyBranchRows }] = await Promise.all([
          supabase.from("business_branches").select("id").eq("business_id", businessId),
          supabase.from("salon_branches").select("id").eq("business_id", businessId),
        ]);

        const branchIds = [
          ...(branchRows || []).map((row: any) => row.id),
          ...(legacyBranchRows || []).map((row: any) => row.id),
        ].filter(Boolean);

        const { data: employees } = branchIds.length > 0
          ? await supabase
              .from("salon_employees")
              .select("id, first_name, last_name, branch_id")
              .in("branch_id", branchIds)
          : { data: [] as any[] };

        const grouped: Record<string, CommissionSummary> = {};
        for (const t of txns) {
          if (!grouped[t.employee_id]) {
            const emp = employees?.find((e: any) => e.id === t.employee_id);
            grouped[t.employee_id] = {
              employee_id: t.employee_id,
              employee_name: emp ? [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim() : "Inconnu",
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
    timeZone: DEFAULT_PLATFORM_TIME_ZONE,
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
