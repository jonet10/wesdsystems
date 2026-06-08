import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Edit3,
  EyeOff,
  Gift,
  Layers3,
  Search,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { BusinessBranch, BusinessSubscription, SubscriptionFeature, SubscriptionPlan } from "@/lib/saas";
import { featureLabels, formatLimit } from "@/lib/saas";
import { useCurrency } from "@/contexts/CurrencyContext";
import { UpgradePrompt } from "@/components/shared/UpgradePrompt";

type BusinessRow = {
  id: string;
  name: string;
  owner?: string | null;
  status?: string | null;
  plan_id?: string | null;
};

type DebtRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  original_amount: number;
  outstanding_balance: number;
  due_amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
};

type RewardRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  points_cost: number;
  reward_value: number;
  reward_type: string;
  active: boolean;
};

type LoyaltySettingsRow = {
  id: string;
  business_id: string;
  points_per_currency: number;
  currency_spend_for_point: number;
  redemption_points_per_reward: number;
  active: boolean;
};

const planSchema = z.object({
  name: z.string().min(2, "Le nom du plan est requis"),
  monthly_price: z.coerce.number().min(0),
  yearly_price: z.coerce.number().min(0),
  max_businesses: z.coerce.number().nullable().optional(),
  max_branches: z.coerce.number().nullable().optional(),
  max_staff: z.coerce.number().nullable().optional(),
  active: z.boolean().default(true),
  description: z.string().optional().nullable(),
  features_text: z.string().optional().default(""),
});

const branchSchema = z.object({
  business_id: z.string().min(1, "Sélectionnez une entreprise"),
  name: z.string().min(2, "Le nom de la succursale est requis"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  address: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  payment_method: z.string().min(1, "Le mode de paiement est requis"),
  note: z.string().optional().nullable(),
});

type PlanFormValues = z.infer<typeof planSchema>;
type BranchFormValues = z.infer<typeof branchSchema>;
type PaymentFormValues = z.infer<typeof paymentSchema>;

const activationSchema = z.object({
  months: z.coerce.number().min(1, "Minimum 1 mois").max(60, "Maximum 60 mois"),
});
type ActivationFormValues = z.infer<typeof activationSchema>;

function parseFeatureLines(text: string): Omit<SubscriptionFeature, "id" | "plan_id">[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [feature_key, feature_label, feature_group, enabled] = line.split("|").map((part) => part.trim());
      return {
        feature_key,
        feature_label: feature_label || featureLabels[feature_key] || feature_key,
        feature_group: feature_group || "general",
        enabled: enabled ? enabled !== "false" : true,
        sort_order: index + 1,
      } as Omit<SubscriptionFeature, "id" | "plan_id">;
    });
}

function featureLinesFromRows(rows: SubscriptionFeature[]) {
  if (!rows.length) return "";
  return rows
    .map((row) => `${row.feature_key}|${row.feature_label || featureLabels[row.feature_key] || row.feature_key}|${row.feature_group || "general"}|${row.enabled ? "true" : "false"}`)
    .join("\n");
}

function DataTable<T>({ rows, columns }: { rows: T[]; columns: ColumnDef<T, unknown>[] }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-10 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 py-2 align-middle text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Aucun résultat
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SuperAdminSubscriptionsPage() {
  const { format } = useCurrency();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [features, setFeatures] = useState<SubscriptionFeature[]>([]);
  const [branches, setBranches] = useState<BusinessBranch[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<BusinessSubscription[]>([]);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettingsRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);

  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editingBranch, setEditingBranch] = useState<BusinessBranch | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<DebtRow | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<BusinessSubscription & { business?: BusinessRow, plan?: SubscriptionPlan } | null>(null);
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<string>("all");
  const [subscriptionBillingFilter, setSubscriptionBillingFilter] = useState<string>("all");
  const [subscriptionRenewFilter, setSubscriptionRenewFilter] = useState<string>("all");

  const planForm = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      monthly_price: 0,
      yearly_price: 0,
      max_businesses: 1,
      max_branches: 1,
      max_staff: 10,
      active: true,
      description: "",
      features_text: "",
    },
  });

  const branchForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      business_id: "",
      name: "",
      phone: "",
      email: "",
      address: "",
      manager_id: "",
      active: true,
    },
  });

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      payment_method: "cash",
      note: "",
    },
  });

  const activationForm = useForm<ActivationFormValues>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      months: 1,
    },
  });

  const loadAll = async () => {
    const [
      { data: planRows },
      { data: featureRows },
      { data: branchRows },
      { data: businessRows },
      { data: subscriptionRows },
      { data: loyaltyRows },
      { data: rewardRows },
      { data: debtRows },
    ] = await Promise.all([
      supabase.from("subscription_plans").select("id, name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description").order("created_at", { ascending: false }),
      supabase.from("subscription_features").select("id, plan_id, feature_key, enabled, feature_label, feature_group, sort_order").order("sort_order", { ascending: true }),
      supabase.from("business_branches").select("id, business_id, name, phone, email, address, manager_id, active, branch_code, created_at, updated_at").order("created_at", { ascending: false }),
      supabase.from("businesses").select("id, name, status, plan_id, created_at").order("created_at", { ascending: false }),
      supabase.from("business_subscriptions").select("id, business_id, plan_id, start_date, end_date, status, billing_cycle, auto_renew, price_snapshot, currency_code, notes").order("created_at", { ascending: false }),
      supabase.from("loyalty_program_settings").select("id, business_id, points_per_currency, currency_spend_for_point, redemption_points_per_reward, active").order("created_at", { ascending: false }),
      supabase.from("loyalty_rewards").select("id, business_id, branch_id, name, description, points_cost, reward_value, reward_type, active").order("created_at", { ascending: false }),
      supabase.from("customer_debts").select("id, business_id, branch_id, customer_name, customer_phone, original_amount, outstanding_balance, due_amount, status, due_date, created_at").order("created_at", { ascending: false }),
    ]);

    setPlans((planRows || []).map((plan: any) => ({
      ...plan,
      monthly_price: Number(plan.monthly_price || 0),
      yearly_price: Number(plan.yearly_price || 0),
      max_businesses: plan.max_businesses === null ? null : Number(plan.max_businesses),
      max_branches: plan.max_branches === null ? null : Number(plan.max_branches),
      max_staff: plan.max_staff === null ? null : Number(plan.max_staff),
    })) as SubscriptionPlan[]);
    setFeatures((featureRows || []) as SubscriptionFeature[]);
    setBranches((branchRows || []) as BusinessBranch[]);
    setBusinesses((businessRows || []) as BusinessRow[]);
    setSubscriptions((subscriptionRows || []).map((subscription: any) => ({
      ...subscription,
      price_snapshot: Number(subscription.price_snapshot || 0),
    })) as BusinessSubscription[]);
    setLoyaltySettings((loyaltyRows || []).map((row: any) => ({
      ...row,
      points_per_currency: Number(row.points_per_currency || 0),
      currency_spend_for_point: Number(row.currency_spend_for_point || 0),
      redemption_points_per_reward: Number(row.redemption_points_per_reward || 0),
    })) as LoyaltySettingsRow[]);
    setRewards((rewardRows || []).map((reward: any) => ({
      ...reward,
      points_cost: Number(reward.points_cost || 0),
      reward_value: Number(reward.reward_value || 0),
    })) as RewardRow[]);
    setDebts((debtRows || []).map((debt: any) => ({
      ...debt,
      original_amount: Number(debt.original_amount || 0),
      outstanding_balance: Number(debt.outstanding_balance || 0),
      due_amount: Number(debt.due_amount || 0),
    })) as DebtRow[]);
  };

  useEffect(() => {
    void loadAll();
    const interval = window.setInterval(() => {
      void loadAll();
    }, 30000);
    const handleFocus = () => {
      void loadAll();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const planFeatures = (planId: string) => features.filter((feature) => feature.plan_id === planId);

  const openCreatePlan = () => {
    setEditingPlan(null);
    planForm.reset({
      name: "",
      monthly_price: 0,
      yearly_price: 0,
      max_businesses: 1,
      max_branches: 1,
      max_staff: 10,
      active: true,
      description: "",
      features_text: "",
    });
    setIsPlanOpen(true);
  };

  const openEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    planForm.reset({
      name: plan.name,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price,
      max_businesses: plan.max_businesses,
      max_branches: plan.max_branches,
      max_staff: plan.max_staff,
      active: plan.active,
      description: plan.description || "",
      features_text: featureLinesFromRows(planFeatures(plan.id)),
    });
    setIsPlanOpen(true);
  };

  const savePlan = planForm.handleSubmit(async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        monthly_price: values.monthly_price,
        yearly_price: values.yearly_price,
        max_businesses: values.max_businesses && values.max_businesses > 0 ? values.max_businesses : null,
        max_branches: values.max_branches && values.max_branches > 0 ? values.max_branches : null,
        max_staff: values.max_staff && values.max_staff > 0 ? values.max_staff : null,
        active: values.active,
        description: values.description?.trim() || null,
      };

      let planId = editingPlan?.id ?? null;
      if (editingPlan) {
        const { error } = await supabase.from("subscription_plans").update(payload).eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("subscription_plans").insert([payload]).select("id").single();
        if (error) throw error;
        planId = data?.id ?? null;
      }

      if (!planId) throw new Error("Impossible de déterminer le plan sauvegardé.");

      const parsedFeatures = parseFeatureLines(values.features_text || "");
      await supabase.from("subscription_features").delete().eq("plan_id", planId);
      if (parsedFeatures.length) {
        const { error: featureError } = await supabase
          .from("subscription_features")
          .insert(parsedFeatures.map((feature, index) => ({
            plan_id: planId,
            feature_key: feature.feature_key,
            enabled: feature.enabled,
            feature_label: feature.feature_label,
            feature_group: feature.feature_group,
            sort_order: index + 1,
          })));
        if (featureError) throw featureError;
      }

      toast.success(editingPlan ? "Plan mis à jour." : "Plan créé.");
      setIsPlanOpen(false);
      await loadAll();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement du plan.");
    }
  });

  const deletePlan = async (plan: SubscriptionPlan) => {
    const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success("Plan supprimé.");
    await loadAll();
  };

  const togglePlanActive = async (plan: SubscriptionPlan) => {
    const { error } = await supabase.from("subscription_plans").update({ active: !plan.active }).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success(plan.active ? "Plan désactivé." : "Plan activé.");
    await loadAll();
  };

  const openCreateBranch = () => {
    setEditingBranch(null);
    branchForm.reset({
      business_id: businesses[0]?.id || "",
      name: "",
      phone: "",
      email: "",
      address: "",
      manager_id: "",
      active: true,
    });
    setIsBranchOpen(true);
  };

  const openEditBranch = (branch: BusinessBranch) => {
    setEditingBranch(branch);
    branchForm.reset({
      business_id: branch.business_id,
      name: branch.name,
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
      manager_id: branch.manager_id || "",
      active: branch.active ?? true,
    });
    setIsBranchOpen(true);
  };

  const saveBranch = branchForm.handleSubmit(async (values) => {
    try {
      const payload = {
        business_id: values.business_id,
        name: values.name.trim(),
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
        manager_id: values.manager_id || null,
        active: values.active,
      };

      if (editingBranch) {
        const { error } = await supabase.from("business_branches").update(payload).eq("id", editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_branches").insert([payload]);
        if (error) throw error;
      }

      toast.success(editingBranch ? "Succursale mise à jour." : "Succursale créée.");
      setIsBranchOpen(false);
      await loadAll();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement de la succursale.");
    }
  });

  const toggleBranchActive = async (branch: BusinessBranch) => {
    const { error } = await supabase.from("business_branches").update({ active: !branch.active }).eq("id", branch.id);
    if (error) return toast.error(error.message);
    toast.success(branch.active ? "Succursale désactivée." : "Succursale activée.");
    await loadAll();
  };

  const registerPayment = paymentForm.handleSubmit(async (values) => {
    if (!selectedDebt) return;
    try {
      const nextOutstanding = Math.max(0, Number(selectedDebt.outstanding_balance) - values.amount);
      const nextStatus = nextOutstanding === 0 ? "settled" : "partial";

      const { error } = await supabase.from("customer_debt_payments").insert([{
        debt_id: selectedDebt.id,
        business_id: selectedDebt.business_id,
        branch_id: selectedDebt.branch_id,
        amount: values.amount,
        payment_method: values.payment_method,
        note: values.note || null,
      }]);
      if (error) throw error;

      const { error: debtUpdateError } = await supabase.from("customer_debts").update({
        outstanding_balance: nextOutstanding,
        due_amount: nextOutstanding,
        status: nextStatus,
      }).eq("id", selectedDebt.id);
      if (debtUpdateError) throw debtUpdateError;

      toast.success("Paiement enregistré.");
      setIsPaymentOpen(false);
      setSelectedDebt(null);
      paymentForm.reset({ amount: 0, payment_method: "cash", note: "" });
      await loadAll();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer le paiement.");
    }
  });

  const saveManualActivation = activationForm.handleSubmit(async (values) => {
    if (!selectedSubscription) return;
    try {
      const today = new Date();
      const duration = Math.max(1, Math.min(60, values.months));
      
      // Determine the start date: if it's currently active and in the future, add to the end date.
      // Otherwise, start from today.
      let currentEndDate = selectedSubscription.end_date ? new Date(selectedSubscription.end_date) : new Date();
      if (isNaN(currentEndDate.getTime()) || selectedSubscription.status !== "active" || currentEndDate < today) {
        currentEndDate = new Date();
      }
      
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + duration);

      const formattedStartDate = today.toISOString().slice(0, 10);
      const formattedEndDate = newEndDate.toISOString().slice(0, 10);

      const { error: subErr } = await supabase
        .from("business_subscriptions")
        .update({
          status: "active",
          start_date: formattedStartDate,
          end_date: formattedEndDate,
          notes: `Activé manuellement pour ${duration} mois le ${today.toLocaleDateString()}`,
        })
        .eq("id", selectedSubscription.id);
      if (subErr) throw subErr;

      const { error: bizErr } = await supabase
        .from("businesses")
        .update({
          status: "active",
          plan_id: selectedSubscription.plan_id,
        })
        .eq("id", selectedSubscription.business_id);
      if (bizErr) throw bizErr;

      await supabase.from("business_subscription_history").insert({
        business_id: selectedSubscription.business_id,
        plan_id: selectedSubscription.plan_id,
        previous_plan_id: selectedSubscription.plan_id,
        action: "manual_activation",
        status_before: selectedSubscription.status,
        status_after: "active",
        notes: `Activation manuelle de ${duration} mois par superadmin.`,
      });

      toast.success(`Abonnement activé jusqu'au ${newEndDate.toLocaleDateString()}`);
      setIsActivationOpen(false);
      setSelectedSubscription(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'activation.");
    }
  });

  const totalBusinesses = businesses.length;
  const activeSubscriptions = subscriptions.filter((row) => row.status === "active");
  const trialingSubscriptions = subscriptions.filter((row) => row.status === "trialing");
  const pastDueSubscriptions = subscriptions.filter((row) => row.status === "past_due");
  const cancelledSubscriptions = subscriptions.filter((row) => row.status === "cancelled");
  const expiredSubscriptions = subscriptions.filter((row) => row.status === "expired");
  const expiringSoonSubscriptions = subscriptions.filter((row) => {
    if (!row.end_date) return false;
    const endDate = new Date(`${row.end_date}T23:59:59`);
    const diffDays = (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7 && (row.status === "active" || row.status === "trialing");
  });
  const monthlyRecurringRevenue = activeSubscriptions.reduce((sum, row) => {
    const plan = plans.find((p) => p.id === row.plan_id);
    const price = row.price_snapshot || plan?.monthly_price || 0;
    return sum + Number(price || 0);
  }, 0);
  const totalBranches = branches.filter((branch) => branch.active !== false).length;
  const totalOutstanding = debts.reduce((sum, debt) => sum + Number(debt.outstanding_balance || 0), 0);
  const totalAutoRenew = subscriptions.filter((row) => row.auto_renew !== false).length;
  const totalActiveFeatures = features.filter((feature) => feature.enabled).length;
  const totalLoyaltyRewards = rewards.filter((reward) => reward.active).length;
  const totalLoyaltyAccounts = loyaltySettings.length;
  const totalPendingDebts = debts.filter((debt) => debt.status !== "settled").length;

  const businessById = useMemo(() => new Map(businesses.map((business) => [business.id, business])), [businesses]);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const subscriptionRows = useMemo(
    () =>
      subscriptions.map((subscription) => ({
        ...subscription,
        business: businessById.get(subscription.business_id),
        plan: planById.get(subscription.plan_id),
      })),
    [businessById, planById, subscriptions]
  );
  const filteredSubscriptionRows = useMemo(() => {
    const term = subscriptionSearch.trim().toLowerCase();
    return subscriptionRows.filter((subscription) => {
      const businessName = subscription.business?.name || "";
      const planName = subscription.plan?.name || "";
      const status = subscription.status || "";
      const billing = subscription.billing_cycle || "monthly";
      const searchMatch =
        !term ||
        [businessName, planName, status, billing, subscription.business_id, subscription.plan_id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const statusMatch = subscriptionStatusFilter === "all" || subscription.status === subscriptionStatusFilter;
      const billingMatch = subscriptionBillingFilter === "all" || billing === subscriptionBillingFilter;
      const renewMatch =
        subscriptionRenewFilter === "all" ||
        (subscriptionRenewFilter === "auto" ? subscription.auto_renew !== false : subscription.auto_renew === false);
      return searchMatch && statusMatch && billingMatch && renewMatch;
    });
  }, [subscriptionBillingFilter, subscriptionRenewFilter, subscriptionRows, subscriptionSearch, subscriptionStatusFilter]);

  const planPopularity = useMemo(() => {
    const counts = new Map<string, number>();
    subscriptions.forEach((subscription) => {
      counts.set(subscription.plan_id, (counts.get(subscription.plan_id) || 0) + 1);
    });
    return plans.map((plan) => ({
      ...plan,
      count: counts.get(plan.id) || 0,
    }));
  }, [plans, subscriptions]);

  const planColumns: ColumnDef<SubscriptionPlan & { count: number }>[] = [
    {
      header: "Plan",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            <Badge variant={row.original.active ? "default" : "secondary"}>{row.original.active ? "Actif" : "Inactif"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{row.original.description || "Aucune description"}</p>
        </div>
      ),
    },
    {
      header: "Prix",
      cell: ({ row }) => (
        <div className="space-y-1 text-sm">
          <div>{format(row.original.monthly_price)} / mois</div>
          <div className="text-muted-foreground">{format(row.original.yearly_price)} / an</div>
        </div>
      ),
    },
    {
      header: "Limites",
      cell: ({ row }) => (
        <div className="space-y-1 text-sm text-muted-foreground">
          <div>Branches: {formatLimit(row.original.max_branches)}</div>
          <div>Staff: {formatLimit(row.original.max_staff)}</div>
        </div>
      ),
    },
    {
      header: "Fonctions",
      cell: ({ row }) => (
        <Badge variant="outline">{planFeatures(row.original.id).filter((feature) => feature.enabled).length} activées</Badge>
      ),
    },
    {
      header: "Utilisation",
      cell: ({ row }) => <Badge variant="secondary">{row.original.count} abonnement(s)</Badge>,
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPlan(row.original)}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePlanActive(row.original)}>
            {row.original.active ? <EyeOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePlan(row.original)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const branchColumns: ColumnDef<BusinessBranch>[] = [
    {
      header: "Succursale",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            <Badge variant={row.original.active ? "default" : "secondary"}>{row.original.active ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{row.original.branch_code || row.original.id}</p>
        </div>
      ),
    },
    {
      header: "Entreprise",
      cell: ({ row }) => businesses.find((business) => business.id === row.original.business_id)?.name || row.original.business_id,
    },
    {
      header: "Contact",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          <div>{row.original.phone || "—"}</div>
          <div>{row.original.email || "—"}</div>
        </div>
      ),
    },
    {
      header: "Adresse",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.address || "—"}</span>,
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBranch(row.original)}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleBranchActive(row.original)}>
            {row.original.active ? <EyeOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  const debtColumns: ColumnDef<DebtRow>[] = [
    {
      header: "Client",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.customer_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.customer_phone || "—"}</div>
        </div>
      ),
    },
    {
      header: "Montants",
      cell: ({ row }) => (
        <div className="space-y-1 text-sm">
          <div>Original: {format(Number(row.original.original_amount || 0))}</div>
          <div>Restant: {format(Number(row.original.outstanding_balance || 0))}</div>
        </div>
      ),
    },
    {
      header: "Statut",
      cell: ({ row }) => <Badge variant={row.original.status === "settled" ? "default" : row.original.status === "partial" ? "secondary" : "destructive"}>{row.original.status}</Badge>,
    },
    {
      header: "Échéance",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.due_date || "—"}</span>,
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedDebt(row.original);
            paymentForm.reset({ amount: 0, payment_method: "cash", note: "" });
            setIsPaymentOpen(true);
          }}
        >
          Encaisser
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout role="super_admin" title="Subscription Management" subtitle="Plans, branches, loyalty, debt and usage across all modules" userName="Admin Wesd Systems">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total businesses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalBusinesses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">{activeSubscriptions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Monthly recurring revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{format(monthlyRecurringRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Outstanding debt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{format(totalOutstanding)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Trialing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{trialingSubscriptions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">En retard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">{pastDueSubscriptions.length}</p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="grid w-full grid-cols-6 max-w-5xl">
              <TabsTrigger value="plans" className="gap-2"><Layers3 className="h-4 w-4" /> Plans</TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-2"><CreditCard className="h-4 w-4" /> Subscriptions</TabsTrigger>
              <TabsTrigger value="branches" className="gap-2"><Building2 className="h-4 w-4" /> Branches</TabsTrigger>
              <TabsTrigger value="loyalty" className="gap-2"><Gift className="h-4 w-4" /> Loyalty</TabsTrigger>
              <TabsTrigger value="debt" className="gap-2"><CreditCard className="h-4 w-4" /> Debt</TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={openCreatePlan}>
                  <Plus className="mr-2 h-4 w-4" /> New plan
                </Button>
              </div>
              <DataTable rows={planPopularity} columns={planColumns as ColumnDef<SubscriptionPlan & { count: number }, unknown>[]} />
              <UpgradePrompt
                title="Plan limits are now runtime configurable"
                message="When a plan changes here, branch and staff limits will follow without a code deploy."
              />
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6 space-y-4">
              <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={subscriptionSearch}
                      onChange={(e) => setSubscriptionSearch(e.target.value)}
                      placeholder="Search business, plan or status"
                      className="pl-9"
                    />
                  </div>
                  <Select value={subscriptionStatusFilter} onValueChange={setSubscriptionStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="past_due">Past due</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={subscriptionBillingFilter} onValueChange={setSubscriptionBillingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Billing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All billing</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={subscriptionRenewFilter} onValueChange={setSubscriptionRenewFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Renewal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All renewal</SelectItem>
                      <SelectItem value="auto">Auto renew</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Expiring soon</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold text-warning">{expiringSoonSubscriptions.length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Cancelled</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold text-destructive">{cancelledSubscriptions.length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Auto renew</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{totalAutoRenew}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Active features</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{totalActiveFeatures}</p></CardContent>
                </Card>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Auto renew</TableHead>
                      <TableHead>Ends</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptionRows.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>{subscription.business?.name || subscription.business_id}</TableCell>
                        <TableCell>{subscription.plan?.name || subscription.plan_id}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              subscription.status === "active"
                                ? "default"
                                : subscription.status === "trialing"
                                  ? "secondary"
                                  : subscription.status === "past_due"
                                    ? "outline"
                                    : "destructive"
                            }
                          >
                            {subscription.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{subscription.billing_cycle || "monthly"}</TableCell>
                        <TableCell>{subscription.auto_renew ? "Yes" : "No"}</TableCell>
                        <TableCell>{subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedSubscription(subscription);
                              setIsActivationOpen(true);
                              activationForm.reset({ months: 1 });
                            }}
                          >
                            Activer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSubscriptionRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No subscriptions match your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="branches" className="mt-6 space-y-4">
              <div className="flex justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {totalBranches} active branch(es)
                </div>
                <Button onClick={openCreateBranch}>
                  <Plus className="mr-2 h-4 w-4" /> New branch
                </Button>
              </div>
              <DataTable rows={branches} columns={branchColumns} />
            </TabsContent>

            <TabsContent value="loyalty" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Loyalty accounts</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{totalLoyaltyAccounts}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Rewards configured</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{totalLoyaltyRewards}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Open debts</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{totalPendingDebts}</p></CardContent>
                </Card>
              </div>

              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Customer loyalty is data-driven</AlertTitle>
                <AlertDescription>
                  Configure point earning, redemption and rewards in the loyalty settings table. The module can be reused by salon, pharmacy, restaurant and future verticals.
                </AlertDescription>
              </Alert>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Earning rule</TableHead>
                      <TableHead>Redemption</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loyaltySettings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell>{businesses.find((biz) => biz.id === setting.business_id)?.name || setting.business_id}</TableCell>
                        <TableCell>{setting.currency_spend_for_point} spent = 1 point</TableCell>
                        <TableCell>{setting.redemption_points_per_reward} points</TableCell>
                        <TableCell>
                          <Badge variant={setting.active ? "default" : "secondary"}>{setting.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loyaltySettings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No loyalty settings yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="debt" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Open debts</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{totalPendingDebts}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Settled debts</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold text-success">{debts.filter((debt) => debt.status === "settled").length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Pending balance</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold text-destructive">{format(totalOutstanding)}</p></CardContent>
                </Card>
              </div>
              <DataTable rows={debts} columns={debtColumns} />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Expired subscriptions</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold text-destructive">{expiredSubscriptions.length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Branch usage</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{branches.length}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Cancelled subs</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{cancelledSubscriptions.length}</p></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plan popularity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {planPopularity.map((plan) => (
                      <div key={plan.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{plan.name}</span>
                          <span className="text-muted-foreground">{plan.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, plan.count * 20)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Subscription snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Active subscriptions</span>
                      <span className="text-foreground">{activeSubscriptions.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Expired subscriptions</span>
                      <span className="text-foreground">{expiredSubscriptions.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Businesses on platform</span>
                      <span className="text-foreground">{totalBusinesses}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Monthly recurring revenue</span>
                      <span className="text-foreground">{format(monthlyRecurringRevenue)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={isPlanOpen} onOpenChange={setIsPlanOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit plan" : "Create plan"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePlan}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...planForm.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input {...planForm.register("description")} />
              </div>
              <div className="space-y-2">
                <Label>Monthly price</Label>
                <Input type="number" {...planForm.register("monthly_price")} />
              </div>
              <div className="space-y-2">
                <Label>Yearly price</Label>
                <Input type="number" {...planForm.register("yearly_price")} />
              </div>
              <div className="space-y-2">
                <Label>Max businesses</Label>
                <Input type="number" {...planForm.register("max_businesses")} />
              </div>
              <div className="space-y-2">
                <Label>Max branches</Label>
                <Input type="number" {...planForm.register("max_branches")} />
                <p className="text-xs text-muted-foreground">Use 0 for unlimited.</p>
              </div>
              <div className="space-y-2">
                <Label>Max staff</Label>
                <Input type="number" {...planForm.register("max_staff")} />
                <p className="text-xs text-muted-foreground">Use 0 for unlimited.</p>
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Switch checked={planForm.watch("active")} onCheckedChange={(checked) => planForm.setValue("active", checked)} />
                  <span className="text-sm text-muted-foreground">Plan visible and selectable</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              <Textarea
                rows={8}
                {...planForm.register("features_text")}
                placeholder={"standard_pos|Standard POS|operations|true\nbasic_reports|Basic reports|analytics|true"}
              />
              <p className="text-xs text-muted-foreground">
                One feature per line. Format: <code>feature_key|Label|Group|true/false</code>
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPlanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" /> Save plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBranchOpen} onOpenChange={setIsBranchOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit branch" : "Create branch"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveBranch}>
            <div className="space-y-2">
              <Label>Business</Label>
              <select
                {...branchForm.register("business_id")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...branchForm.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Manager ID</Label>
                <Input {...branchForm.register("manager_id")} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...branchForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...branchForm.register("email")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea rows={3} {...branchForm.register("address")} />
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch checked={branchForm.watch("active")} onCheckedChange={(checked) => branchForm.setValue("active", checked)} />
              <span className="text-sm text-muted-foreground">Branch active</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBranchOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" /> Save branch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Register payment</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={registerPayment}>
            <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{selectedDebt?.customer_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-medium text-destructive">{format(Number(selectedDebt?.outstanding_balance || 0))}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" {...paymentForm.register("amount")} />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <select
                {...paymentForm.register("payment_method")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="moncash">MonCash</option>
                <option value="natcash">NatCash</option>
                <option value="card">Card</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea rows={3} {...paymentForm.register("note")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <DollarSign className="mr-2 h-4 w-4" /> Save payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isActivationOpen} onOpenChange={setIsActivationOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Activation Manuelle</DialogTitle>
            <DialogDescription>
              Activer ou prolonger cet abonnement manuellement pour l'établissement sélectionné.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveManualActivation}>
            <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entreprise</span>
                <span className="font-medium">{selectedSubscription?.business?.name || selectedSubscription?.business_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{selectedSubscription?.plan?.name || "Aucun plan"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut actuel</span>
                <Badge variant="outline">{selectedSubscription?.status}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre de mois à ajouter</Label>
              <Input type="number" min={1} max={60} {...activationForm.register("months")} />
              <p className="text-xs text-muted-foreground">
                La date de fin sera calculée automatiquement. Si le compte est déjà actif, ces mois seront ajoutés à la date de fin actuelle.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsActivationOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Activer maintenant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
