import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Smartphone,
  Building2,
  DollarSign,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

type ManualPayment = {
  id: string;
  user_id: string;
  business_id: string;
  subscription_id: string | null;
  plan_id: string;
  payment_method: "moncash" | "natcash";
  amount: number;
  currency_code: string;
  sender_number: string;
  transaction_reference: string;
  proof_image_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type PaymentWithRelations = ManualPayment & {
  user?: { id: string; full_name?: string } | null;
  business?: { id: string; name: string } | null;
  plan?: { id: string; name: string } | null;
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
};

export default function SuperAdminManualPaymentsPage() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithRelations | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [approveDuration, setApproveDuration] = useState("1");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch manual payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("manual_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      if (!paymentsData || paymentsData.length === 0) {
        setPayments([]);
        return;
      }

      // 2. Extract unique foreign keys
      const userIds = Array.from(new Set(paymentsData.map((p) => p.user_id).filter(Boolean)));
      const businessIds = Array.from(new Set(paymentsData.map((p) => p.business_id).filter(Boolean)));
      const planIds = Array.from(new Set(paymentsData.map((p) => p.plan_id).filter(Boolean)));

      // 3. Fetch relations in parallel
      const [
        { data: profilesData, error: profilesError },
        { data: businessesData, error: businessesError },
        { data: plansData, error: plansError }
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", userIds),
        supabase.from("businesses").select("id, name").in("id", businessIds),
        supabase.from("subscription_plans").select("id, name").in("id", planIds)
      ]);

      if (profilesError) throw profilesError;
      if (businessesError) throw businessesError;
      if (plansError) throw plansError;

      const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));
      const businessMap = new Map((businessesData || []).map((b) => [b.id, b]));
      const planMap = new Map((plansData || []).map((p) => [p.id, p]));

      // 4. Combine them
      const combined: PaymentWithRelations[] = paymentsData.map((p) => ({
        ...p,
        user: p.user_id ? (profileMap.get(p.user_id) as any) : null,
        business: p.business_id ? (businessMap.get(p.business_id) as any) : null,
        plan: p.plan_id ? (planMap.get(p.plan_id) as any) : null
      }));

      setPayments(combined);
    } catch (error: any) {
      console.error("[ManualPayments] Error loading:", error);
      toast.error("Erreur lors du chargement des paiements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const stats = useMemo(() => {
    const total = payments.length;
    const pending = payments.filter((p) => p.status === "pending").length;
    const approved = payments.filter((p) => p.status === "approved").length;
    const rejected = payments.filter((p) => p.status === "rejected").length;
    const totalAmount = payments
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { total, pending, approved, rejected, totalAmount };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      const searchMatch =
        !term ||
        (p.business?.name || "").toLowerCase().includes(term) ||
        (p.user?.full_name || "").toLowerCase().includes(term) ||
        (p.user_id || "").toLowerCase().includes(term) ||
        p.transaction_reference.toLowerCase().includes(term) ||
        p.sender_number.toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || p.status === statusFilter;
      const methodMatch = methodFilter === "all" || p.payment_method === methodFilter;
      return searchMatch && statusMatch && methodMatch;
    });
  }, [payments, search, statusFilter, methodFilter]);

  const handleView = (payment: PaymentWithRelations) => {
    setSelectedPayment(payment);
    setViewOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedPayment) return;
    setActionLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token || "";

      const response = await fetch("/api/manual-payments/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_id: selectedPayment.id,
          duration_months: Number(approveDuration),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur lors de l'approbation");
      }

      toast.success("Paiement approuvé et abonnement activé !");
      setApproveOpen(false);
      setViewOpen(false);
      setSelectedPayment(null);
      await loadPayments();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de l'approbation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token || "";

      const response = await fetch("/api/manual-payments/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_id: selectedPayment.id,
          reason: rejectReason.trim(),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur lors du rejet");
      }

      toast.success("Paiement rejeté.");
      setRejectOpen(false);
      setViewOpen(false);
      setSelectedPayment(null);
      setRejectReason("");
      await loadPayments();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout
      role="super_admin"
      title="Paiements Manuels"
      subtitle="Gérez les demandes de paiement manuel des utilisateurs"
      userName="Admin Wesd Systems"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("common.total")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("common.pending")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">{stats.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Approuvés</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">{stats.approved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Rejetés</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total approuvé</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalAmount.toLocaleString()} HTG</p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par entreprise, utilisateur, référence..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">{t("common.pending")}</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Méthode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="moncash">MonCash</SelectItem>
                <SelectItem value="natcash">NatCash</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">Utilisateur</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">Entreprise</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">Méthode</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">{t("common.amount")}</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">Numéro</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">Référence</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">{t("common.date")}</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground">{t("common.status")}</TableHead>
                  <TableHead className="h-10 px-3 text-xs uppercase tracking-wide text-muted-foreground text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucun paiement trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="px-3 text-sm">
                        {payment.user?.full_name || payment.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="px-3 text-sm font-medium">
                        {payment.business?.name || payment.business_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-1.5">
                          {payment.payment_method === "moncash" ? (
                            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-sm capitalize">{payment.payment_method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 text-sm font-medium">
                        {Number(payment.amount).toLocaleString()} {payment.currency_code}
                      </TableCell>
                      <TableCell className="px-3 text-sm text-muted-foreground">{payment.sender_number}</TableCell>
                      <TableCell className="px-3 text-sm text-muted-foreground font-mono">
                        {payment.transaction_reference}
                      </TableCell>
                      <TableCell className="px-3 text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="px-3">
                        <Badge variant={STATUS_COLORS[payment.status] || "outline"}>
                          {STATUS_LABELS[payment.status] || payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleView(payment)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails du paiement</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Utilisateur</p>
                  <p className="text-sm font-medium">{selectedPayment.user?.full_name || selectedPayment.user_id.slice(0, 8)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Entreprise</p>
                  <p className="text-sm font-medium">{selectedPayment.business?.name || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Forfait</p>
                  <p className="text-sm font-medium">{selectedPayment.plan?.name || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Méthode</p>
                  <p className="text-sm font-medium capitalize">{selectedPayment.payment_method}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("common.amount")}</p>
                  <p className="text-sm font-bold">{Number(selectedPayment.amount).toLocaleString()} {selectedPayment.currency_code}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("common.status")}</p>
                  <Badge variant={STATUS_COLORS[selectedPayment.status] || "outline"}>
                    {STATUS_LABELS[selectedPayment.status] || selectedPayment.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Numéro expéditeur</p>
                  <p className="text-sm">{selectedPayment.sender_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Référence transaction</p>
                  <p className="text-sm font-mono">{selectedPayment.transaction_reference}</p>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Note</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedPayment.notes}</p>
                </div>
              )}

              {selectedPayment.proof_image_url && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Preuve de paiement</p>
                  <a
                    href={selectedPayment.proof_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Voir la capture d'écran
                  </a>
                </div>
              )}

              {selectedPayment.rejection_reason && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Raison du rejet</p>
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{selectedPayment.rejection_reason}</span>
                  </div>
                </div>
              )}

              {selectedPayment.approved_at && (
                <div className="text-xs text-muted-foreground">
                  Approuvé le {new Date(selectedPayment.approved_at).toLocaleString("fr-FR")}
                </div>
              )}

              {selectedPayment.rejected_at && (
                <div className="text-xs text-muted-foreground">
                  Rejeté le {new Date(selectedPayment.rejected_at).toLocaleString("fr-FR")}
                </div>
              )}

              {selectedPayment.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => {
                      setViewOpen(false);
                      setApproveOpen(true);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approuver
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setViewOpen(false);
                      setRejectOpen(true);
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Approuver le paiement</DialogTitle>
            <DialogDescription>
              L'abonnement sera activé automatiquement. Choisissez la durée d'activation.
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant reçu</span>
                  <span className="font-medium">{Number(selectedPayment.amount).toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Méthode</span>
                  <span className="font-medium capitalize">{selectedPayment.payment_method}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="approve-duration">Durée d'activation (mois)</Label>
                <Select value={approveDuration} onValueChange={setApproveDuration}>
                  <SelectTrigger id="approve-duration">
                    <SelectValue placeholder="Durée" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} mois</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="flex gap-3">
                <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={actionLoading}>
                  Annuler
                </Button>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {actionLoading ? "Approbation..." : "Confirmer l'approbation"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rejeter le paiement</DialogTitle>
            <DialogDescription>
              Une notification sera envoyée à l'utilisateur avec la raison du rejet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Raison du rejet</Label>
              <Textarea
                id="reject-reason"
                placeholder="Expliquez pourquoi ce paiement est rejeté..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={actionLoading}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                {actionLoading ? "Rejet..." : "Confirmer le rejet"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
