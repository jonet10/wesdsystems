import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  CheckCircle2,
  Crown,
  EyeOff,
  Handshake,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Users,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";

type PartnerLevel = "affiliate" | "reseller" | "agency";
type PartnerStatus = "pending" | "approved" | "suspended" | "rejected" | "active";
type PayoutStatus = "pending" | "approved" | "paid" | "rejected" | "cancelled";

interface PartnerRow {
  id: string;
  user_id: string | null;
  partner_tier_id: string | null;
  partner_level: PartnerLevel;
  status: PartnerStatus;
  display_name: string;
  full_name?: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number?: string | null;
  city?: string | null;
  department?: string | null;
  partner_type?: string | null;
  company_name: string | null;
  referral_code: string;
  referral_url: string | null;
  payout_method: "moncash" | "natcash" | "bank_transfer" | "cash" | null;
  white_label_enabled: boolean;
  notes: string | null;
  created_at: string;
}

interface PartnerTierRow {
  id: string;
  name: string;
  slug: string;
  recurring_commission_rate: number;
  one_time_commission_rate: number;
  fixed_commission_amount: number;
  active: boolean;
  description: string | null;
}

interface PartnerWalletRow {
  id: string;
  partner_id: string;
  currency_code: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  total_payouts: number;
}

interface PartnerPayoutRow {
  id: string;
  partner_id: string;
  wallet_id: string | null;
  requested_amount: number;
  payout_method: "moncash" | "natcash" | "bank_transfer" | "cash";
  payout_details: Record<string, unknown> | null;
  status: PayoutStatus;
  requested_at: string;
  processed_at: string | null;
  note: string | null;
}

interface PartnerCommissionRow {
  id: string;
  partner_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface BusinessRow {
  id: string;
  referred_by_partner_id: string | null;
  status: string | null;
}

const partnerTierSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  slug: z.string().min(2, "Le slug est requis"),
  recurring_commission_rate: z.coerce.number().min(0),
  one_time_commission_rate: z.coerce.number().min(0),
  fixed_commission_amount: z.coerce.number().min(0),
  active: z.boolean().default(true),
  description: z.string().optional().nullable(),
});

const partnerSchema = z.object({
  display_name: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  partner_level: z.enum(["affiliate", "reseller", "agency"]),
  partner_tier_id: z.string().optional().nullable(),
  status: z.enum(["pending", "approved", "suspended", "rejected", "active"]),
  payout_method: z.enum(["moncash", "natcash", "bank_transfer", "cash"]).nullable(),
  white_label_enabled: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

const payoutSchema = z.object({
  status: z.enum(["approved", "paid", "rejected", "cancelled"]),
  note: z.string().optional().nullable(),
});

type PartnerTierFormValues = z.infer<typeof partnerTierSchema>;
type PartnerFormValues = z.infer<typeof partnerSchema>;
type PayoutFormValues = z.infer<typeof payoutSchema>;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
                Aucun resultat
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SuperAdminPartnersPage() {
  const { format } = useCurrency();
  const { profile } = useAuth();

  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [tiers, setTiers] = useState<PartnerTierRow[]>([]);
  const [wallets, setWallets] = useState<PartnerWalletRow[]>([]);
  const [commissions, setCommissions] = useState<PartnerCommissionRow[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayoutRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const [isPartnerOpen, setIsPartnerOpen] = useState(false);
  const [isTierOpen, setIsTierOpen] = useState(false);
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerRow | null>(null);
  const [editingTier, setEditingTier] = useState<PartnerTierRow | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<PartnerPayoutRow | null>(null);

  const partnerForm = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      display_name: "",
      email: "",
      phone: "",
      company_name: "",
      partner_level: "affiliate",
      partner_tier_id: "",
      status: "pending",
      payout_method: "moncash",
      white_label_enabled: false,
      notes: "",
    },
  });

  const tierForm = useForm<PartnerTierFormValues>({
    resolver: zodResolver(partnerTierSchema),
    defaultValues: {
      name: "",
      slug: "",
      recurring_commission_rate: 10,
      one_time_commission_rate: 0,
      fixed_commission_amount: 0,
      active: true,
      description: "",
    },
  });

  const payoutForm = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      status: "paid",
      note: "",
    },
  });

  const loadData = async () => {
    const [
      { data: partnerRows },
      { data: tierRows },
      { data: walletRows },
      { data: commissionRows },
      { data: payoutRows },
      { data: businessRows },
    ] = await Promise.all([
      supabase.from("partners").select("id, user_id, partner_tier_id, partner_level, status, display_name, full_name, email, phone, whatsapp_number, city, department, partner_type, company_name, referral_code, referral_url, payout_method, white_label_enabled, notes, created_at").order("created_at", { ascending: false }),
      supabase.from("partner_tiers").select("id, name, slug, recurring_commission_rate, one_time_commission_rate, fixed_commission_amount, active, description").order("created_at", { ascending: false }),
      supabase.from("partner_wallets").select("id, partner_id, currency_code, available_balance, pending_balance, lifetime_earnings, total_payouts").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("id, partner_id, amount, status, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("partner_payout_requests").select("id, partner_id, wallet_id, requested_amount, payout_method, payout_details, status, requested_at, processed_at, note").order("created_at", { ascending: false }).limit(200),
      supabase.from("businesses").select("id, referred_by_partner_id, status").order("created_at", { ascending: false }),
    ]);

    setPartners((partnerRows || []).map((row: any) => ({
      ...row,
      white_label_enabled: !!row.white_label_enabled,
    })) as PartnerRow[]);
    setTiers((tierRows || []).map((row: any) => ({
      ...row,
      recurring_commission_rate: Number(row.recurring_commission_rate || 0),
      one_time_commission_rate: Number(row.one_time_commission_rate || 0),
      fixed_commission_amount: Number(row.fixed_commission_amount || 0),
    })) as PartnerTierRow[]);
    setWallets((walletRows || []).map((row: any) => ({
      ...row,
      available_balance: Number(row.available_balance || 0),
      pending_balance: Number(row.pending_balance || 0),
      lifetime_earnings: Number(row.lifetime_earnings || 0),
      total_payouts: Number(row.total_payouts || 0),
    })) as PartnerWalletRow[]);
    setCommissions((commissionRows || []).map((row: any) => ({
      ...row,
      amount: Number(row.amount || 0),
    })) as PartnerCommissionRow[]);
    setPayouts((payoutRows || []).map((row: any) => ({
      ...row,
      requested_amount: Number(row.requested_amount || 0),
    })) as PartnerPayoutRow[]);
    setBusinesses((businessRows || []) as BusinessRow[]);
  };

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => {
      void loadData();
    }, 30000);
    const handleFocus = () => {
      void loadData();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const filteredPartners = useMemo(() => {
    const term = search.trim().toLowerCase();
    return partners.filter((partner) => {
      const textMatch =
        !term ||
        [partner.display_name, partner.email, partner.company_name, partner.referral_code, partner.partner_level, partner.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const statusMatch = statusFilter === "all" || partner.status === statusFilter;
      const levelMatch = levelFilter === "all" || partner.partner_level === levelFilter;
      const tierMatch = tierFilter === "all" || partner.partner_tier_id === tierFilter;
      return textMatch && statusMatch && levelMatch && tierMatch;
    });
  }, [levelFilter, partners, search, statusFilter, tierFilter]);

  const businessCountByPartner = useMemo(() => {
    const map = new Map<string, number>();
    businesses.forEach((business) => {
      if (!business.referred_by_partner_id) return;
      map.set(business.referred_by_partner_id, (map.get(business.referred_by_partner_id) || 0) + 1);
    });
    return map;
  }, [businesses]);

  const walletByPartner = useMemo(() => new Map(wallets.map((wallet) => [wallet.partner_id, wallet])), [wallets]);
  const commissionsByPartner = useMemo(() => {
    const map = new Map<string, number>();
    commissions.forEach((commission) => {
      map.set(commission.partner_id, (map.get(commission.partner_id) || 0) + commission.amount);
    });
    return map;
  }, [commissions]);

  const activePartners = partners.filter((partner) => partner.status === "approved" || partner.status === "active");
  const suspendedPartners = partners.filter((partner) => partner.status === "suspended");
  const pendingPayoutTotal = payouts
    .filter((payout) => payout.status === "pending")
    .reduce((sum, payout) => sum + payout.requested_amount, 0);
  const monthlyCommissions = commissions
    .filter((commission) => {
      const created = new Date(commission.created_at);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    })
    .reduce((sum, commission) => sum + commission.amount, 0);
  const lifetimeEarnings = wallets.reduce((sum, wallet) => sum + wallet.lifetime_earnings, 0);
  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.available_balance, 0);
  const pendingWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.pending_balance, 0);

  const openCreateTier = () => {
    setEditingTier(null);
    tierForm.reset({
      name: "",
      slug: "",
      recurring_commission_rate: 10,
      one_time_commission_rate: 0,
      fixed_commission_amount: 0,
      active: true,
      description: "",
    });
    setIsTierOpen(true);
  };

  const openEditTier = (tier: PartnerTierRow) => {
    setEditingTier(tier);
    tierForm.reset({
      name: tier.name,
      slug: tier.slug,
      recurring_commission_rate: tier.recurring_commission_rate,
      one_time_commission_rate: tier.one_time_commission_rate,
      fixed_commission_amount: tier.fixed_commission_amount,
      active: tier.active,
      description: tier.description || "",
    });
    setIsTierOpen(true);
  };

  const saveTier = tierForm.handleSubmit(async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        slug: slugify(values.slug || values.name),
        recurring_commission_rate: values.recurring_commission_rate,
        one_time_commission_rate: values.one_time_commission_rate,
        fixed_commission_amount: values.fixed_commission_amount,
        active: values.active,
        description: values.description?.trim() || null,
      };

      if (editingTier) {
        const { error } = await supabase.from("partner_tiers").update(payload).eq("id", editingTier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partner_tiers").insert([payload]);
        if (error) throw error;
      }

      toast.success(editingTier ? "Tier mis a jour." : "Tier cree.");
      setIsTierOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer le tier.");
    }
  });

  const deleteTier = async (tier: PartnerTierRow) => {
    const { error } = await supabase.from("partner_tiers").delete().eq("id", tier.id);
    if (error) return toast.error(error.message);
    toast.success("Tier supprime.");
    await loadData();
  };

  const toggleTier = async (tier: PartnerTierRow) => {
    const { error } = await supabase.from("partner_tiers").update({ active: !tier.active }).eq("id", tier.id);
    if (error) return toast.error(error.message);
    toast.success(tier.active ? "Tier desactive." : "Tier active.");
    await loadData();
  };

  const openEditPartner = (partner: PartnerRow) => {
    setEditingPartner(partner);
      partnerForm.reset({
        display_name: partner.display_name,
        // keep compatibility with legacy rows
        email: partner.email || "",
        phone: partner.phone || "",
        company_name: partner.company_name || "",
        partner_level: partner.partner_level,
        partner_tier_id: partner.partner_tier_id || "",
      status: partner.status === "active" ? "approved" : partner.status,
      payout_method: partner.payout_method,
      white_label_enabled: partner.white_label_enabled,
      notes: partner.notes || "",
    });
    setIsPartnerOpen(true);
  };

  const savePartner = partnerForm.handleSubmit(async (values) => {
    if (!editingPartner) return;
    try {
      const payload = {
        display_name: values.display_name.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        company_name: values.company_name?.trim() || null,
        partner_level: values.partner_level,
        partner_tier_id: values.partner_tier_id || null,
        status: values.status,
        payout_method: values.payout_method,
        white_label_enabled: values.white_label_enabled,
        notes: values.notes?.trim() || null,
        approved_at: values.status === "approved" || values.status === "active" ? new Date().toISOString() : null,
        approved_by: values.status === "approved" || values.status === "active" ? profile?.id || null : null,
      };

      const { error } = await supabase.from("partners").update(payload).eq("id", editingPartner.id);
      if (error) throw error;

      toast.success("Partenaire mis a jour.");
      setIsPartnerOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer le partenaire.");
    }
  });

  const setPartnerStatus = async (partner: PartnerRow, status: PartnerStatus) => {
    try {
      const rpcName =
        status === "approved" || status === "active"
          ? "approve_partner_application"
          : status === "rejected"
            ? "reject_partner_application"
            : "suspend_partner_application";

      const payload =
        status === "approved" || status === "active"
          ? { p_partner_id: partner.id, p_partner_tier_id: partner.partner_tier_id || null }
          : status === "rejected"
            ? { p_partner_id: partner.id, p_rejection_reason: null }
            : { p_partner_id: partner.id };

      const { error } = await supabase.rpc(rpcName, payload as any);
      if (error) throw error;
      toast.success(status === "approved" || status === "active" ? "Partenaire approuvé et code généré." : `Statut passe a ${status}.`);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible de mettre à jour le partenaire.");
    }
  };

  const openPayout = (payout: PartnerPayoutRow) => {
    setSelectedPayout(payout);
    payoutForm.reset({ status: payout.status === "pending" ? "paid" : payout.status, note: payout.note || "" });
    setIsPayoutOpen(true);
  };

  const savePayout = payoutForm.handleSubmit(async (values) => {
    if (!selectedPayout) return;
    try {
      const { error } = await supabase.from("partner_payout_requests").update({
        status: values.status,
        note: values.note?.trim() || null,
        processed_at: new Date().toISOString(),
        processed_by: profile?.id || null,
      }).eq("id", selectedPayout.id);
      if (error) throw error;
      toast.success("Payout traite.");
      setIsPayoutOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible de traiter le payout.");
    }
  });

  const partnerColumns: ColumnDef<PartnerRow>[] = [
    {
      header: "Partner",
      cell: ({ row }) => (
          <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.display_name}</span>
            <Badge variant={row.original.status === "approved" || row.original.status === "active" ? "default" : row.original.status === "pending" ? "secondary" : "destructive"}>
              {row.original.status === "approved" || row.original.status === "active"
                ? "Approuvé"
                : row.original.status === "pending"
                  ? "En attente"
                  : row.original.status === "suspended"
                    ? "Suspendu"
                    : "Refusé"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{row.original.company_name || row.original.email || row.original.referral_code}</div>
          <div className="text-[11px] text-muted-foreground">Code: {row.original.referral_code}</div>
        </div>
      ),
    },
    {
      header: "Level",
      cell: ({ row }) => <Badge variant="outline">{row.original.partner_level}</Badge>,
    },
    {
      header: "Tier",
      cell: ({ row }) => tiers.find((tier) => tier.id === row.original.partner_tier_id)?.name || "None",
    },
    {
      header: "Clients",
      cell: ({ row }) => businessCountByPartner.get(row.original.id) || 0,
    },
    {
      header: "Wallet",
      cell: ({ row }) => {
        const wallet = walletByPartner.get(row.original.id);
        return (
          <div className="space-y-1 text-sm">
            <div>{format(wallet?.available_balance || 0)}</div>
            <div className="text-xs text-muted-foreground">Pending {format(wallet?.pending_balance || 0)}</div>
            <div className="text-xs text-muted-foreground">Lifetime {format(wallet?.lifetime_earnings || 0)}</div>
          </div>
        );
      },
    },
    {
      header: "Joined",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPartner(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {row.original.status !== "approved" && row.original.status !== "active" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPartnerStatus(row.original, "approved")}>
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPartnerStatus(row.original, "suspended")}>
              <EyeOff className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPartnerStatus(row.original, "rejected")}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const tierColumns: ColumnDef<PartnerTierRow>[] = [
    {
      header: "Tier",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            <Badge variant={row.original.active ? "default" : "secondary"}>{row.original.active ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">{row.original.slug}</div>
        </div>
      ),
    },
    {
      header: "Recurring",
      cell: ({ row }) => `${row.original.recurring_commission_rate}%`,
    },
    {
      header: "One-time",
      cell: ({ row }) => `${row.original.one_time_commission_rate}%`,
    },
    {
      header: "Fixed",
      cell: ({ row }) => format(row.original.fixed_commission_amount),
    },
    {
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.description || "—"}</span>,
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTier(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleTier(row.original)}>
            {row.original.active ? <EyeOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTier(row.original)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const payoutColumns: ColumnDef<PartnerPayoutRow>[] = [
    {
      header: "Partner",
      cell: ({ row }) => partners.find((partner) => partner.id === row.original.partner_id)?.display_name || row.original.partner_id,
    },
    {
      header: "Amount",
      cell: ({ row }) => format(row.original.requested_amount),
    },
    {
      header: "Method",
      cell: ({ row }) => row.original.payout_method,
    },
    {
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.status === "paid" ? "default" : row.original.status === "pending" ? "secondary" : "destructive"}>{row.original.status}</Badge>,
    },
    {
      header: "Requested",
      cell: ({ row }) => new Date(row.original.requested_at).toLocaleDateString(),
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPayout(row.original)}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      role="super_admin"
      title="Partner Management"
      subtitle="Approve, tier, payout and performance control for the reseller network"
      userName="Admin Wesd Systems"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total partners</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{partners.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active partners</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">{activePartners.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Monthly commissions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{format(monthlyCommissions)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pending payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">{format(pendingPayoutTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Suspended partners</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{suspendedPartners.length}</p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <Alert>
            <Handshake className="h-4 w-4" />
            <AlertTitle>Referral network is live at the data layer</AlertTitle>
            <AlertDescription>
              Every business can be linked to a partner through a referral code, while payouts and recurring commissions follow the active subscription lifecycle.
            </AlertDescription>
          </Alert>
        </StaggerItem>

        <StaggerItem>
          <Tabs defaultValue="partners" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-3xl">
              <TabsTrigger value="partners" className="gap-2"><Users className="h-4 w-4" /> Partners</TabsTrigger>
              <TabsTrigger value="tiers" className="gap-2"><Crown className="h-4 w-4" /> Tiers</TabsTrigger>
              <TabsTrigger value="payouts" className="gap-2"><Wallet className="h-4 w-4" /> Payouts</TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2"><BadgeDollarSign className="h-4 w-4" /> Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="partners" className="mt-6 space-y-4">
              <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partners" className="pl-9" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All levels</SelectItem>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="reseller">Reseller</SelectItem>
                      <SelectItem value="agency">Agency</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tiers</SelectItem>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadData} variant="outline">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
              <DataTable rows={filteredPartners} columns={partnerColumns} />
            </TabsContent>

            <TabsContent value="tiers" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={openCreateTier}>
                  <Plus className="mr-2 h-4 w-4" /> New tier
                </Button>
              </div>
              <DataTable rows={tiers} columns={tierColumns} />
            </TabsContent>

            <TabsContent value="payouts" className="mt-6 space-y-4">
              <DataTable rows={payouts} columns={payoutColumns} />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Lifetime earnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{format(lifetimeEarnings)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Recurring rates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {tiers.map((tier) => (
                      <div key={tier.id} className="flex items-center justify-between">
                        <span>{tier.name}</span>
                        <span className="text-muted-foreground">{tier.recurring_commission_rate}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Business links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{businesses.filter((business) => !!business.referred_by_partner_id).length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Wallet balances</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Available</span>
                      <span className="font-medium">{format(totalWalletBalance)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pending</span>
                      <span className="font-medium">{format(pendingWalletBalance)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={isTierOpen} onOpenChange={setIsTierOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingTier ? "Edit tier" : "Create tier"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveTier}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...tierForm.register("name")} onChange={(e) => {
                  tierForm.setValue("name", e.target.value);
                  if (!editingTier) tierForm.setValue("slug", slugify(e.target.value));
                }} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input {...tierForm.register("slug")} />
              </div>
              <div className="space-y-2">
                <Label>Recurring rate</Label>
                <Input type="number" {...tierForm.register("recurring_commission_rate")} />
              </div>
              <div className="space-y-2">
                <Label>One-time rate</Label>
                <Input type="number" {...tierForm.register("one_time_commission_rate")} />
              </div>
              <div className="space-y-2">
                <Label>Fixed amount</Label>
                <Input type="number" {...tierForm.register("fixed_commission_amount")} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Switch checked={tierForm.watch("active")} onCheckedChange={(checked) => tierForm.setValue("active", checked)} />
                  <span className="text-sm text-muted-foreground">Available for assignment</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={4} {...tierForm.register("description")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTierOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save tier</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPartnerOpen} onOpenChange={setIsPartnerOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Edit partner</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePartner}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...partnerForm.register("display_name")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...partnerForm.register("email")} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...partnerForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input {...partnerForm.register("company_name")} />
              </div>
              <div className="space-y-2">
                <Label>Partner level</Label>
                <Select value={partnerForm.watch("partner_level")} onValueChange={(value) => partnerForm.setValue("partner_level", value as PartnerLevel)}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="affiliate">Affiliate</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                    <SelectItem value="agency">Agency Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={partnerForm.watch("partner_tier_id") || "none"} onValueChange={(value) => partnerForm.setValue("partner_tier_id", value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tiers.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={partnerForm.watch("status")} onValueChange={(value) => partnerForm.setValue("status", value as PartnerStatus)}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="approved">Approuvé</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                    <SelectItem value="rejected">Refusé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payout method</Label>
                <Select value={partnerForm.watch("payout_method") || "moncash"} onValueChange={(value) => partnerForm.setValue("payout_method", value as PartnerFormValues["payout_method"])}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moncash">MonCash</SelectItem>
                    <SelectItem value="natcash">NatCash</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={4} {...partnerForm.register("notes")} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">White-label enabled</div>
                <div className="text-xs text-muted-foreground">Reserved for future partner tiers</div>
              </div>
              <Switch checked={partnerForm.watch("white_label_enabled")} onCheckedChange={(checked) => partnerForm.setValue("white_label_enabled", checked)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPartnerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save partner</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Process payout</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePayout}>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={payoutForm.watch("status")} onValueChange={(value) => payoutForm.setValue("status", value as PayoutFormValues["status"])}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea rows={4} {...payoutForm.register("note")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayoutOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save payout</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
