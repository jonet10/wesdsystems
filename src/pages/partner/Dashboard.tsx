import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import QRCode from "qrcode";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { MONCASH_PUBLIC_URLS } from "@/lib/moncash";
import {
  BarChart3,
  Copy,
  ExternalLink,
  CreditCard,
  Gift,
  Link as LinkIcon,
  Megaphone,
  PieChart,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Users,
  Wallet,
  DollarSign,
} from "lucide-react";

type TabKey = "dashboard" | "clients" | "subscriptions" | "commissions" | "payouts" | "referrals" | "marketing" | "reports";

interface PartnerRow {
  id: string;
  user_id: string | null;
  partner_level: "affiliate" | "reseller" | "agency";
  status: "pending" | "approved" | "suspended" | "rejected" | "active";
  display_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  referral_code: string;
  referral_url: string | null;
  partner_tier_id: string | null;
  payout_method?: "moncash" | "natcash" | "bank_transfer" | "cash" | null;
  white_label_enabled?: boolean;
}

interface PartnerWallet {
  id: string;
  partner_id: string;
  currency_code: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  total_payouts: number;
}

interface PartnerTier {
  id: string;
  name: string;
  slug: string;
  recurring_commission_rate: number;
  one_time_commission_rate: number;
  fixed_commission_amount: number;
  active: boolean;
}

interface PartnerCommission {
  id: string;
  partner_id: string;
  business_id: string | null;
  commission_type: "one_time" | "recurring" | "fixed" | "percentage";
  source_event: string;
  rate_value: number;
  base_amount: number;
  amount: number;
  currency_code: string;
  status: "available" | "pending" | "paid" | "reversed";
  created_at: string;
}

interface PartnerPayout {
  id: string;
  partner_id: string;
  requested_amount: number;
  payout_method: "moncash" | "natcash" | "bank_transfer" | "cash";
  status: "pending" | "approved" | "paid" | "rejected" | "cancelled";
  requested_at: string;
  note: string | null;
}

interface PartnerReferral {
  id: string;
  partner_id: string;
  business_id: string | null;
  referral_code: string;
  referral_url: string;
  clicks: number;
  signups: number;
  converted_at: string | null;
  last_clicked_at: string;
}

interface BusinessRow {
  id: string;
  name: string;
  owner?: string | null;
  status?: string | null;
  referred_by_partner_id?: string | null;
  created_at?: string;
}

interface SubscriptionRow {
  id: string;
  business_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  billing_cycle?: string | null;
  price_snapshot: number;
}

const payoutSchema = z.object({
  requested_amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  payout_method: z.enum(["moncash", "natcash", "bank_transfer", "cash"]),
  note: z.string().optional().nullable(),
});

type PayoutFormValues = z.infer<typeof payoutSchema>;

const tabPaths: Record<TabKey, string> = {
  dashboard: "/partner",
  clients: "/partner/clients",
  subscriptions: "/partner/subscriptions",
  commissions: "/partner/commissions",
  payouts: "/partner/payouts",
  referrals: "/partner/referrals",
  marketing: "/partner/marketing",
  reports: "/partner/reports",
};

const tabFromPath = (pathname: string): TabKey => {
  const entry = Object.entries(tabPaths).find(([, path]) => path === pathname);
  return (entry?.[0] as TabKey) || "dashboard";
};

export default function PartnerDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { format } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<PartnerRow | null>(null);
  const [wallet, setWallet] = useState<PartnerWallet | null>(null);
  const [tier, setTier] = useState<PartnerTier | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [referrals, setReferrals] = useState<PartnerReferral[]>([]);
  const [qrCode, setQrCode] = useState<string>("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRow | null>(null);

  const payoutForm = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      requested_amount: 0,
      payout_method: "moncash",
      note: "",
    },
  });

  const activeTab = tabFromPath(location.pathname);
  const referralUrl = partner?.referral_url || (partner?.referral_code ? `https://wesdsystems.store/register?ref=${partner.referral_code}` : "");
  const isApprovedPartner = partner?.status === "approved" || partner?.status === "active";

  const loadData = async () => {
    if (!profile?.id) return;

    const { data: partnerRow } = await supabase
      .from("partners")
      .select("id, user_id, partner_level, status, display_name, email, phone, company_name, referral_code, referral_url, partner_tier_id, payout_method, white_label_enabled")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (!partnerRow) {
      setPartner(null);
      return;
    }

    const partnerData = partnerRow as PartnerRow;
    setPartner(partnerData);

    const [walletRes, tierRes, bizRes, subRes, commRes, payoutRes, refRes] = await Promise.all([
      supabase.from("partner_wallets").select("id, partner_id, currency_code, available_balance, pending_balance, lifetime_earnings, total_payouts").eq("partner_id", partnerData.id).maybeSingle(),
      supabase.from("partner_tiers").select("id, name, slug, recurring_commission_rate, one_time_commission_rate, fixed_commission_amount, active").eq("id", partnerData.partner_tier_id || "").maybeSingle(),
      supabase.from("businesses").select("id, name, owner, status, referred_by_partner_id, created_at").eq("referred_by_partner_id", partnerData.id).order("created_at", { ascending: false }),
      supabase.from("business_subscriptions").select("id, business_id, plan_id, status, start_date, end_date, billing_cycle, price_snapshot").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("id, partner_id, business_id, commission_type, source_event, rate_value, base_amount, amount, currency_code, status, created_at").eq("partner_id", partnerData.id).order("created_at", { ascending: false }),
      supabase.from("partner_payout_requests").select("id, partner_id, requested_amount, payout_method, status, requested_at, note").eq("partner_id", partnerData.id).order("created_at", { ascending: false }),
      supabase.from("partner_referrals").select("id, partner_id, business_id, referral_code, referral_url, clicks, signups, converted_at, last_clicked_at").eq("partner_id", partnerData.id).order("created_at", { ascending: false }),
    ]);

    setWallet((walletRes.data as PartnerWallet | null) || null);
    if (tierRes.data) {
      setTier({
        ...(tierRes.data as PartnerTier),
        recurring_commission_rate: Number((tierRes.data as any).recurring_commission_rate || 0),
        one_time_commission_rate: Number((tierRes.data as any).one_time_commission_rate || 0),
        fixed_commission_amount: Number((tierRes.data as any).fixed_commission_amount || 0),
      });
    } else {
      setTier(null);
    }
    setBusinesses((bizRes.data || []) as BusinessRow[]);
    setSubscriptions((subRes.data || []).map((row: any) => ({
      ...row,
      price_snapshot: Number(row.price_snapshot || 0),
    })) as SubscriptionRow[]);
    setCommissions((commRes.data || []).map((row: any) => ({
      ...row,
      rate_value: Number(row.rate_value || 0),
      base_amount: Number(row.base_amount || 0),
      amount: Number(row.amount || 0),
    })) as PartnerCommission[]);
    setPayouts((payoutRes.data || []).map((row: any) => ({
      ...row,
      requested_amount: Number(row.requested_amount || 0),
    })) as PartnerPayout[]);
    setReferrals((refRes.data || []) as PartnerReferral[]);

    if (partnerData.referral_code) {
      const url = partnerData.referral_url || `https://wesdsystems.store/register?ref=${partnerData.referral_code}`;
      QRCode.toDataURL(url, { width: 220, margin: 1 })
        .then(setQrCode)
        .catch(() => setQrCode(""));
    }
  };

  useEffect(() => {
    void loadData();
  }, [profile?.id]);

  const currentMonthCommissions = commissions.filter((row) => new Date(row.created_at).getMonth() === new Date().getMonth());
  const pendingPayouts = payouts.filter((row) => row.status === "pending");
  const activeSubscriptions = subscriptions.filter((row) => row.status === "active");

  const metrics = [
    { title: "Total clients", value: businesses.length.toString(), icon: <Users className="h-5 w-5" /> },
    { title: "Active subscriptions", value: activeSubscriptions.length.toString(), icon: <ShieldCheck className="h-5 w-5" /> },
    { title: "Monthly commissions", value: format(currentMonthCommissions.reduce((sum, row) => sum + row.amount, 0)), icon: <DollarSign className="h-5 w-5" /> },
    { title: "Lifetime earnings", value: format(wallet?.lifetime_earnings || 0), icon: <Wallet className="h-5 w-5" /> },
    { title: "Pending payouts", value: format(pendingPayouts.reduce((sum, row) => sum + row.requested_amount, 0)), icon: <PieChart className="h-5 w-5" /> },
  ];

  const copyReferral = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    toast.success("Lien de parrainage copié.");
  };

  const buildMonCashPaymentLink = (subscription: SubscriptionRow) => {
    const url = new URL(MONCASH_PUBLIC_URLS.subscriptionPaymentUrl);
    const business = businesses.find((item) => item.id === subscription.business_id);
    url.searchParams.set("business_id", subscription.business_id);
    url.searchParams.set("subscription_id", subscription.id);
    url.searchParams.set("plan_id", subscription.plan_id);
    url.searchParams.set("billing_cycle", subscription.billing_cycle || "monthly");
    url.searchParams.set("business_name", business?.name || subscription.business_id);
    url.searchParams.set("plan_name", subscription.plan_id);
    url.searchParams.set("amount", String(subscription.price_snapshot || 0));
    url.searchParams.set("currency_code", "HTG");
    return url.toString();
  };

  const onRequestPayout = payoutForm.handleSubmit(async (values) => {
    if (!partner?.id) return;
    try {
      const { error } = await supabase.from("partner_payout_requests").insert([{
        partner_id: partner.id,
        wallet_id: wallet?.id || null,
        requested_amount: values.requested_amount,
        payout_method: values.payout_method,
        note: values.note || null,
      }]);
      if (error) throw error;
      toast.success("Demande de payout envoyée.");
      payoutForm.reset({ requested_amount: 0, payout_method: "moncash", note: "" });
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'envoyer la demande.");
    }
  });

  if (profile && !partner) {
    return (
      <DashboardLayout role="partner" title="Tableau de bord partenaire" subtitle="Votre compte partenaire n'est pas encore validé" userName={profile.full_name || "Partenaire"}>
        <div className="max-w-3xl">
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold">Compte partenaire en attente</h2>
              <p className="text-sm text-muted-foreground">
                Votre profil est connecté, mais aucune demande approuvée n'est encore liée à ce compte.
                Un administrateur doit valider votre dossier pour activer le tableau de bord.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="partner"
      title="Tableau de bord partenaire"
      subtitle="Ambassadeurs, revendeurs et agences partenaires"
      userName={partner?.display_name || profile?.full_name || "Partenaire"}
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    {metric.icon}
                    {metric.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metric.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </StaggerItem>

        {!isApprovedPartner && (
          <StaggerItem>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Compte en attente</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Votre inscription partenaire a bien été reçue, mais votre compte doit encore être approuvé par le Super Admin.
                </p>
                <p>
                  Une fois validé, votre code partenaire et votre lien de parrainage seront générés automatiquement.
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        )}

        <StaggerItem>
          <Tabs value={activeTab} onValueChange={(value) => navigate(tabPaths[value as TabKey])} className="w-full">
            <TabsList className="grid w-full grid-cols-4 xl:grid-cols-8">
              <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
              <TabsTrigger value="clients">Mes clients</TabsTrigger>
              <TabsTrigger value="subscriptions">Mes abonnements</TabsTrigger>
              <TabsTrigger value="commissions">Mes commissions</TabsTrigger>
              <TabsTrigger value="payouts">Mon portefeuille</TabsTrigger>
              <TabsTrigger value="referrals">Mes filleuls</TabsTrigger>
              <TabsTrigger value="marketing">Marketing</TabsTrigger>
              <TabsTrigger value="reports">Rapports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Your referral code</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input readOnly value={partner?.referral_code || ""} />
                      <Button variant="outline" size="icon" onClick={copyReferral}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground break-all">
                      {referralUrl}
                    </div>
                    {qrCode && (
                      <img src={qrCode} alt="Referral QR" className="h-48 w-48 rounded-xl border bg-white p-2" />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Partner profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Level</span>
                      <Badge>{partner?.partner_level}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={isApprovedPartner ? "default" : "secondary"}>
                        {partner?.status === "approved" || partner?.status === "active"
                          ? "Approuvé"
                          : partner?.status === "pending"
                            ? "En attente"
                            : partner?.status === "suspended"
                              ? "Suspendu"
                              : "Refusé"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tier</span>
                      <span className="font-medium">{tier?.name || "None"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payout method</span>
                      <span className="font-medium">{partner?.payout_method || "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="clients" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">My clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businesses.map((biz) => {
                        const sub = subscriptions.find((s) => s.business_id === biz.id);
                        return (
                          <TableRow key={biz.id}>
                            <TableCell className="font-medium">{biz.name}</TableCell>
                            <TableCell>{biz.owner || "—"}</TableCell>
                            <TableCell><Badge variant="secondary">{biz.status || "active"}</Badge></TableCell>
                            <TableCell>{sub ? sub.plan_id : "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedBusiness(biz); setDetailsOpen(true); }}>
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {businesses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucun client pour le moment.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">My subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((subscription) => (
                        <TableRow key={subscription.id}>
                          <TableCell>{businesses.find((b) => b.id === subscription.business_id)?.name || subscription.business_id}</TableCell>
                          <TableCell><Badge>{subscription.status}</Badge></TableCell>
                          <TableCell>{format(subscription.price_snapshot || 0)}</TableCell>
                          <TableCell>{subscription.start_date}</TableCell>
                          <TableCell>{subscription.end_date || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => window.open(buildMonCashPaymentLink(subscription), "_blank")}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              MonCash
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {subscriptions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No subscriptions yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions" className="mt-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Commission history</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.type")}</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell><Badge variant="secondary">{commission.commission_type}</Badge></TableCell>
                            <TableCell>{commission.source_event}</TableCell>
                            <TableCell>{format(commission.amount)}</TableCell>
                            <TableCell><Badge>{commission.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {commissions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No commissions yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">This month</span>
                      <span className="font-medium">{format(currentMonthCommissions.reduce((sum, row) => sum + row.amount, 0))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-medium">{format(wallet?.available_balance || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium">{format(wallet?.pending_balance || 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payouts" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-base">Request payout</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={onRequestPayout} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" {...payoutForm.register("requested_amount")} />
                      </div>
                      <div className="space-y-2">
                        <Label>Method</Label>
                        <select
                          {...payoutForm.register("payout_method")}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="moncash">MonCash</option>
                          <option value="natcash">NatCash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cash">Cash</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Note</Label>
                        <Textarea rows={4} {...payoutForm.register("note")} />
                      </div>
                      <Button type="submit" className="w-full">Send request</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Payout history</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Requested</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payouts.map((payout) => (
                          <TableRow key={payout.id}>
                            <TableCell>{format(payout.requested_amount)}</TableCell>
                            <TableCell>{payout.payout_method}</TableCell>
                            <TableCell><Badge>{payout.status}</Badge></TableCell>
                            <TableCell>{new Date(payout.requested_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                        {payouts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No payout history yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="referrals" className="mt-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Referral link</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input value={referralUrl} readOnly />
                      <Button variant="outline" size="icon" onClick={copyReferral}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="outline" onClick={() => window.open(referralUrl, "_blank")}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Open referral link
                    </Button>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Clicks</span>
                        <span className="text-foreground">{referrals.reduce((sum, row) => sum + row.clicks, 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Signups</span>
                        <span className="text-foreground">{referrals.reduce((sum, row) => sum + row.signups, 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">QR code</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {qrCode ? <img src={qrCode} alt="Referral QR" className="h-52 w-52 rounded-xl border bg-white p-2" /> : (
                      <div className="text-sm text-muted-foreground">QR code unavailable.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="marketing" className="mt-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {[
                  {
                    title: "Direct message pitch",
                    body: "WESD Systems helps salons, pharmacies, schools and retailers run multi-branch operations with subscription controls and smart reporting.",
                  },
                  {
                    title: "Short social caption",
                    body: "I help businesses launch with WESD Systems. Multi-branch, loyalty, credit and subscriptions in one platform.",
                  },
                  {
                    title: "Onboarding checklist",
                    body: "1. Share your referral link. 2. Track signups. 3. Assist the setup. 4. Follow the subscription lifecycle and payouts.",
                  },
                ].map((item) => (
                  <Card key={item.title}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Megaphone className="h-4 w-4" /> {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea readOnly value={item.body} rows={6} />
                      <Button variant="outline" className="w-full" onClick={() => navigator.clipboard.writeText(item.body).then(() => toast.success("Contenu copié."))}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Clients</span>
                      <span className="font-medium">{businesses.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Active subscriptions</span>
                      <span className="font-medium">{activeSubscriptions.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Commission rate</span>
                      <span className="font-medium">{tier?.recurring_commission_rate || 0}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Referral conversions</span>
                      <span className="font-medium">{referrals.filter((row) => !!row.converted_at).length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Trend snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Commission volume", value: currentMonthCommissions.reduce((sum, row) => sum + row.amount, 0) },
                      { label: "Wallet balance", value: wallet?.available_balance || 0 },
                      { label: "Signup count", value: referrals.reduce((sum, row) => sum + row.signups, 0) },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-muted-foreground">{format(item.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.max(15, Number(item.value) ? Number(item.value) % 100 : 15))}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{selectedBusiness?.name || "Client details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span>{selectedBusiness?.owner || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span>{selectedBusiness?.status || "active"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{selectedBusiness?.created_at ? new Date(selectedBusiness.created_at).toLocaleDateString() : "—"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
