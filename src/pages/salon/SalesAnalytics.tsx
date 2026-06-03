import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart3, Package, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useActiveBranchId } from "@/lib/branch";
import {
  DEFAULT_PLATFORM_TIME_ZONE,
  getDateKeyInTimeZone,
  shiftDateKey,
} from "@/lib/timezone-date";

interface Sale {
  id: string;
  total_amount: number;
  created_at: string;
}

interface SaleItem {
  item_type: "product" | "service";
  item_name: string;
  quantity: number;
  total_price: number;
}

export default function SalesAnalyticsPage() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { data: branches = [] } = useBusinessBranches();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const timeZone = DEFAULT_PLATFORM_TIME_ZONE;

  useEffect(() => {
    const load = async () => {
      if (!activeBranchId) {
        setSales([]);
        setItems([]);
        return;
      }

      const [{ data: s }, { data: i }] = await Promise.all([
        supabase.from("salon_sales").select("id, total_amount, created_at").eq("branch_id", activeBranchId).order("created_at", { ascending: false }).limit(500),
        supabase.from("salon_sale_items").select("item_type, item_name, quantity, total_price, created_at").eq("branch_id", activeBranchId).order("created_at", { ascending: false }).limit(2000),
      ]);
      setSales(((s || []).map((x: any) => ({ ...x, total_amount: Number(x.total_amount || 0) })) as Sale[]));
      setItems(((i || []).map((x: any) => ({ ...x, quantity: Number(x.quantity || 0), total_price: Number(x.total_price || 0) })) as SaleItem[]));
    };
    void load();
  }, [activeBranchId]);

  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const weekStart = shiftDateKey(today, -6);
  const monthStart = `${today.slice(0, 7)}-01`;

  const dailyRevenue = useMemo(
    () => sales.filter((s) => getDateKeyInTimeZone(new Date(s.created_at), timeZone) === today).reduce((sum, s) => sum + s.total_amount, 0),
    [sales, today]
  );
  const weeklyRevenue = useMemo(
    () => sales.filter((s) => {
      const saleDate = getDateKeyInTimeZone(new Date(s.created_at), timeZone);
      return saleDate >= weekStart && saleDate <= today;
    }).reduce((sum, s) => sum + s.total_amount, 0),
    [sales, timeZone, today, weekStart]
  );
  const monthlyRevenue = useMemo(
    () => sales.filter((s) => {
      const saleDate = getDateKeyInTimeZone(new Date(s.created_at), timeZone);
      return saleDate >= monthStart && saleDate <= today;
    }).reduce((sum, s) => sum + s.total_amount, 0),
    [sales, timeZone, today, monthStart]
  );

  const productRevenue = useMemo(() => items.filter((i) => i.item_type === "product").reduce((s, i) => s + i.total_price, 0), [items]);
  const serviceRevenue = useMemo(() => items.filter((i) => i.item_type === "service").reduce((s, i) => s + i.total_price, 0), [items]);
  const topItems = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => map.set(i.item_name, (map.get(i.item_name) || 0) + i.quantity));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [items]);

  return (
    <DashboardLayout role="salon_admin" title="Analytics Ventes" subtitle="Produits, services, revenus et tendances" userName="Admin Studio">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Revenus jour" value={format(dailyRevenue)} icon={<Receipt className="h-6 w-6" />} />
            <StatCard title="Revenus semaine" value={format(weeklyRevenue)} icon={<TrendingUp className="h-6 w-6" />} />
            <StatCard title="Revenus mois" value={format(monthlyRevenue)} icon={<BarChart3 className="h-6 w-6" />} />
            <StatCard title="Transactions" value={sales.length.toString()} icon={<Package className="h-6 w-6" />} />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-2">Revenus Produits</h3>
              <p className="text-2xl font-bold">{format(productRevenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-2">Revenus Services</h3>
              <p className="text-2xl font-bold">{format(serviceRevenue)}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Top produits/services vendus</h3>
            <div className="space-y-2">
              {topItems.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée vente.</p>}
              {topItems.map(([name, qty]) => (
                <div key={name} className="flex items-center justify-between text-sm p-2 rounded bg-muted/40">
                  <span>{name}</span>
                  <span className="font-semibold">{qty}</span>
                </div>
              ))}
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
