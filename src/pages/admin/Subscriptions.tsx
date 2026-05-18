import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface CurrencyRow {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  enabled: boolean;
}

interface CountryRow {
  country_code: string;
  country_name: string;
  currency_code: string;
  enabled: boolean;
}

interface PlanRow {
  id: string;
  name: string;
  enabled: boolean;
}

interface PriceRow {
  id: string;
  plan_id: string;
  country_code: string;
  currency_code: string;
  monthly_price: number;
  yearly_price: number;
  promotion_label: string | null;
  promotion_percent: number | null;
  enabled: boolean;
}

export default function SubscriptionsPage() {
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<PriceRow | null>(null);

  const [planId, setPlanId] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [yearlyPrice, setYearlyPrice] = useState("");
  const [promotionLabel, setPromotionLabel] = useState("");
  const [promotionPercent, setPromotionPercent] = useState("");
  const [enabled, setEnabled] = useState(true);

  const loadAll = async () => {
    const [{ data: c1 }, { data: c2 }, { data: p1 }, { data: p2 }] = await Promise.all([
      supabase.from("currencies").select("code, symbol, name, locale, enabled").order("code"),
      supabase.from("countries").select("country_code, country_name, currency_code, enabled").order("country_name"),
      supabase.from("subscription_plans").select("id, name, enabled").order("name"),
      supabase
        .from("subscription_plan_prices")
        .select("id, plan_id, country_code, currency_code, monthly_price, yearly_price, promotion_label, promotion_percent, enabled")
        .order("country_code"),
    ]);
    setCurrencies((c1 || []) as CurrencyRow[]);
    setCountries((c2 || []) as CountryRow[]);
    setPlans((p1 || []) as PlanRow[]);
    setPrices((p2 || []) as PriceRow[]);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const planNameById = useMemo(() => {
    const map = new Map<string, string>();
    plans.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [plans]);

  const resetForm = () => {
    setEditing(null);
    setPlanId("");
    setCountryCode("");
    setCurrencyCode("");
    setMonthlyPrice("");
    setYearlyPrice("");
    setPromotionLabel("");
    setPromotionPercent("");
    setEnabled(true);
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = (row: PriceRow) => {
    setEditing(row);
    setPlanId(row.plan_id);
    setCountryCode(row.country_code);
    setCurrencyCode(row.currency_code);
    setMonthlyPrice(String(row.monthly_price));
    setYearlyPrice(String(row.yearly_price));
    setPromotionLabel(row.promotion_label || "");
    setPromotionPercent(row.promotion_percent ? String(row.promotion_percent) : "");
    setEnabled(row.enabled);
    setIsOpen(true);
  };

  const savePrice = async () => {
    if (!planId || !countryCode || !currencyCode || !monthlyPrice || !yearlyPrice) {
      toast.error("Merci de remplir plan, pays, devise, mensuel et annuel.");
      return;
    }
    const payload = {
      plan_id: planId,
      country_code: countryCode,
      currency_code: currencyCode,
      monthly_price: Number(monthlyPrice),
      yearly_price: Number(yearlyPrice),
      promotion_label: promotionLabel || null,
      promotion_percent: promotionPercent ? Number(promotionPercent) : null,
      enabled,
    };

    if (editing) {
      const { error } = await supabase.from("subscription_plan_prices").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("subscription_plan_prices").insert([payload]);
      if (error) return toast.error(error.message);
    }
    toast.success("Tarification enregistrée.");
    setIsOpen(false);
    resetForm();
    void loadAll();
  };

  return (
    <DashboardLayout role="super_admin" title="Pricing International" subtitle="Gestion des prix par pays et devise" userName="Admin Wesd Systems">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Devises actives</p>
              <p className="text-2xl font-bold">{currencies.filter((c) => c.enabled).length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Pays actifs</p>
              <p className="text-2xl font-bold">{countries.filter((c) => c.enabled).length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Règles de prix</p>
              <p className="text-2xl font-bold">{prices.length}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex justify-end">
            <Button onClick={openCreate}>Ajouter un pricing pays</Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left p-3 text-xs">Plan</th>
                  <th className="text-left p-3 text-xs">Pays</th>
                  <th className="text-left p-3 text-xs">Devise</th>
                  <th className="text-left p-3 text-xs">Mensuel</th>
                  <th className="text-left p-3 text-xs">Annuel</th>
                  <th className="text-left p-3 text-xs">Promo</th>
                  <th className="text-right p-3 text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="p-3 text-sm">{planNameById.get(row.plan_id) || row.plan_id}</td>
                    <td className="p-3 text-sm">{row.country_code}</td>
                    <td className="p-3 text-sm">{row.currency_code}</td>
                    <td className="p-3 text-sm">{row.monthly_price}</td>
                    <td className="p-3 text-sm">{row.yearly_price}</td>
                    <td className="p-3 text-sm">{row.promotion_label || "-"}</td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Modifier
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier prix" : "Ajouter prix pays"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pays</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.country_code} value={c.country_code}>{c.country_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Devise</Label>
                <Select value={currencyCode} onValueChange={setCurrencyCode}>
                  <SelectTrigger><SelectValue placeholder="Devise" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Promotion (%)</Label>
                <Input value={promotionPercent} onChange={(e) => setPromotionPercent(e.target.value)} placeholder="Ex: 15" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mensuel</Label>
                <Input value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
              </div>
              <div>
                <Label>Annuel</Label>
                <Input value={yearlyPrice} onChange={(e) => setYearlyPrice(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Label promotion</Label>
              <Input value={promotionLabel} onChange={(e) => setPromotionLabel(e.target.value)} placeholder="Ex: Promo rentrée" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={savePrice}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
