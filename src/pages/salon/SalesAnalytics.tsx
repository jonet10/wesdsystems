import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart3, Package, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";

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
  const { format } = useCurrency();
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: i }] = await Promise.all([
        supabase.from("sales").select("id, total_amount, created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(500),
        supabase.from("sale_items").select("item_type, item_name, quantity, total_price").order("created_at", { ascending: false }).limit(2000),
      ]);
      setSales(((s || []).map((x: any) => ({ ...x, total_amount: Number(x.total_amount || 0) })) as Sale[]));
      setItems(((i || []).map((x: any) => ({ ...x, quantity: Number(x.quantity || 0), total_price: Number(x.total_price || 0) })) as SaleItem[]));
    };
    void load();
  }, []);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const dailyRevenue = useMemo(
    () => sales.filter((s) => s.created_at.slice(0, 10) === today).reduce((sum, s) => sum + s.total_amount, 0),
    [sales, today]
  );
  const weeklyRevenue = useMemo(
    () => sales.filter((s) => new Date(s.created_at) >= weekStart).reduce((sum, s) => sum + s.total_amount, 0),
    [sales, weekStart]
  );
  const monthlyRevenue = useMemo(
    () => sales.filter((s) => new Date(s.created_at) >= monthStart).reduce((sum, s) => sum + s.total_amount, 0),
    [sales, monthStart]
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
