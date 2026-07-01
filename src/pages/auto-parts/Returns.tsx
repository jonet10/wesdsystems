import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import {
  listReturnRequests,
  createReturnRequest,
  approveReturn,
  rejectReturn,
  type AutoPartsReturnRequest,
} from "@/modules/auto-parts/services/returns";
import { listSales } from "@/modules/auto-parts/services/sales";
import { AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {
  ArrowLeftRight, Search, CheckCircle2, XCircle, Clock,
  AlertTriangle, PackageOpen, ChevronDown, ChevronUp, User,
} from "lucide-react";
import type { AutoPartsSale, AutoPartsSaleItem } from "@/modules/auto-parts/types";

interface ReturnItemDraft {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  max_quantity: number;
}

const STATUS_CONFIG = {
  EN_ATTENTE: { label: "En attente",  icon: Clock,         color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-500/10",  badge: "secondary" as const },
  APPROUVE:   { label: "Approuvé",    icon: CheckCircle2,  color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-500/10",  badge: "default" as const },
  REFUSE:     { label: "Refusé",      icon: XCircle,       color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-500/10",    badge: "destructive" as const },
};

export default function AutoPartsReturnsPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const { hasAutoPartsPermission, autoPartsStaffSession } = useAuth();
  const { format } = useCurrency();

  const canApprove = hasAutoPartsPermission(PERMISSIONS.RETURNS_MANAGE);
  const canViewAll = hasAutoPartsPermission(PERMISSIONS.REPORTS_VIEW);
  const isStrictlyCashier = !canViewAll && autoPartsStaffSession?.role === "cashier";

  const [requests, setRequests] = useState<AutoPartsReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"EN_ATTENTE" | "APPROUVE" | "REFUSE" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New return request form state
  const [openCreate, setOpenCreate] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [foundSale, setFoundSale] = useState<(AutoPartsSale & { items: AutoPartsSaleItem[] }) | null>(null);
  const [searching, setSearching] = useState(false);
  const [draftItems, setDraftItems] = useState<ReturnItemDraft[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Approve/Reject dialog state
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const { profile } = useAuth();

  const load = async () => {
    setLoading(true);
    try {
      const staffFilter = isStrictlyCashier ? autoPartsStaffSession?.id : null;
      const data = await listReturnRequests(businessId!, staffFilter, filterStatus);
      setRequests(data ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (businessId) load(); }, [businessId, filterStatus, isStrictlyCashier]);

  // ── Search invoice ──────────────────────────────────────────────────────────
  const searchInvoice = async () => {
    if (!invoiceSearch.trim() || !businessId) return;
    setSearching(true);
    setFoundSale(null);
    try {
      const staffFilter = isStrictlyCashier ? autoPartsStaffSession?.id : null;
      const sales = await listSales(businessId, null, staffFilter);
      const sale = sales.find(
        (s) => s.invoice_number.toLowerCase() === invoiceSearch.trim().toLowerCase()
      );
      if (!sale) { toast.error("Facture introuvable"); return; }
      if ((sale as any).status === "RETURNED") {
        toast.error("Cette facture a déjà été retournée intégralement"); return;
      }
      setFoundSale(sale);
      setDraftItems(
        (sale.items || []).map((item) => ({
          product_id: item.product_id ?? "",
          product_name: item.product_name,
          quantity: 0,
          unit_price: item.unit_price,
          max_quantity: item.quantity,
        }))
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const toggleItem = (idx: number) =>
    setDraftItems((prev) =>
      prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity > 0 ? 0 : it.max_quantity } : it)
    );

  const setQty = (idx: number, qty: number) =>
    setDraftItems((prev) =>
      prev.map((it, i) => i === idx ? { ...it, quantity: Math.min(Math.max(0, qty), it.max_quantity) } : it)
    );

  // ── Submit return request ───────────────────────────────────────────────────
  const handleSubmitRequest = async () => {
    if (!businessId || !foundSale) return;
    const items = draftItems.filter((i) => i.quantity > 0);
    if (items.length === 0) { toast.error("Sélectionnez au moins un article"); return; }
    setSubmitting(true);
    try {
      const result = await createReturnRequest(
        businessId,
        foundSale.id,
        items.map(({ product_id, product_name, quantity, unit_price }) => ({
          product_id, product_name, quantity, unit_price,
        })),
        autoPartsStaffSession?.id ?? null,
        reason || undefined
      );
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la demande");
      } else {
        toast.success("Demande de retour créée — en attente de validation");
        setOpenCreate(false);
        setInvoiceSearch("");
        setFoundSale(null);
        setDraftItems([]);
        setReason("");
        load();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve ─────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!approveTarget || !businessId) return;
    if (!adminPassword.trim()) {
      toast.error("Veuillez saisir le mot de passe de l'administrateur de l'entreprise.");
      return;
    }
    setVerifyingPassword(true);
    try {
      // 1. Récupérer l'e-mail de l'administrateur principal (salon_admin) de cette entreprise
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("business_id", businessId)
        .eq("role", "salon_admin")
        .limit(1)
        .maybeSingle();

      const targetEmail = adminProfile?.email || profile?.email || "";
      if (!targetEmail) {
        toast.error("Impossible d'identifier l'administrateur de l'entreprise.");
        setVerifyingPassword(false);
        return;
      }

      // 2. Vérifier le mot de passe par rapport à cet e-mail
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: adminPassword,
      });

      if (authError) {
        toast.error("Mot de passe administrateur incorrect.");
        setVerifyingPassword(false);
        return;
      }

      const r = await approveReturn(approveTarget, autoPartsStaffSession?.id ?? profile?.id ?? null);
      if (!r.success) { toast.error(r.error || "Erreur"); }
      else { toast.success("Retour approuvé — stock réinjecté"); load(); }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVerifyingPassword(false);
      setAdminPassword("");
      setApproveTarget(null);
    }
  };

  // ── Reject ──────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      const r = await rejectReturn(rejectTarget, autoPartsStaffSession?.id ?? profile?.id ?? null, rejectionReason || undefined);
      if (!r.success) { toast.error(r.error || "Erreur"); }
      else { toast.success("Demande de retour refusée"); load(); }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRejectTarget(null);
      setRejectionReason("");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const pending = requests.filter((r) => r.status === "EN_ATTENTE").length;

  return (
    <DashboardLayout role="salon_admin" title="Retours produits" subtitle="Gestion des retours avec validation">
      <StaggerContainer className="space-y-4">
        <StaggerItem>
          <AutoPartsPageHeader
            title="Retours produits"
            description={`${requests.length} demande(s)${pending > 0 ? ` · ${pending} en attente` : ""}`}
            action={{ label: "Nouvelle demande de retour", onClick: () => setOpenCreate(true) }}
          />
        </StaggerItem>

        {/* Filter tabs */}
        <StaggerItem>
          <div className="flex gap-2 flex-wrap">
            {([null, "EN_ATTENTE", "APPROUVE", "REFUSE"] as const).map((s) => {
              const cfg = s ? STATUS_CONFIG[s] : null;
              return (
                <Button
                  key={s ?? "all"}
                  variant={filterStatus === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(s)}
                  className="gap-1"
                >
                  {cfg ? <cfg.icon className="h-3.5 w-3.5" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                  {cfg?.label ?? "Tous"}
                </Button>
              );
            })}
          </div>
        </StaggerItem>

        {/* List */}
        <StaggerItem>
          <div className="space-y-3">
            {loading && <p className="text-muted-foreground text-sm">{t("common.loading")}</p>}
            {!loading && requests.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <PackageOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Aucune demande de retour</p>
              </div>
            )}
            {requests.map((req) => {
              const cfg = STATUS_CONFIG[req.status];
              const Icon = cfg.icon;
              const expanded = expandedId === req.id;
              return (
                <Card key={req.id} className={`border-l-4 ${req.status === "EN_ATTENTE" ? "border-l-amber-400" : req.status === "APPROUVE" ? "border-l-green-500" : "border-l-red-400"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${cfg.color} flex-shrink-0`} />
                        <div>
                          <p className="font-semibold text-sm">Facture #{req.invoice_number}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <User className="h-3 w-3" />
                            <span>{req.staff_name ?? "—"}</span>
                            <span>·</span>
                            <span>{new Date(req.created_at).toLocaleString("fr-FR")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cfg.badge}>{cfg.label}</Badge>
                        {/* Admin actions */}
                        {canApprove && req.status === "EN_ATTENTE" && (
                          <>
                            <Button
                              size="sm" variant="outline"
                              className="border-green-300 text-green-700 hover:bg-green-50 h-7 text-xs"
                              onClick={() => setApproveTarget(req.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approuver
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50 h-7 text-xs"
                              onClick={() => { setRejectTarget(req.id); setRejectionReason(""); }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2"
                          onClick={() => setExpandedId(expanded ? null : req.id)}
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {expanded && (
                    <CardContent className="pt-0">
                      <Separator className="mb-3" />
                      {req.reason && (
                        <p className="text-sm mb-3">
                          <span className="font-medium">Motif :</span>{" "}
                          <span className="text-muted-foreground">{req.reason}</span>
                        </p>
                      )}
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Articles concernés</p>
                      <div className="space-y-1">
                        {(req.items || []).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                            <span>{item.product_name}</span>
                            <span className="text-muted-foreground">
                              {item.quantity} × {format(item.unit_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {req.status !== "EN_ATTENTE" && (
                        <div className={`mt-3 p-2 rounded text-xs ${cfg.bg} ${cfg.color}`}>
                          {req.reviewer_name && (
                            <span>
                              {req.status === "APPROUVE" ? "Approuvé" : "Refusé"} par{" "}
                              <strong>{req.reviewer_name}</strong>{" "}
                              le {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString("fr-FR") : "—"}
                            </span>
                          )}
                          {req.rejection_reason && (
                            <p className="mt-1">Motif de refus : {req.rejection_reason}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* ── Create return request dialog ────────────────────────────────────── */}
      <Dialog open={openCreate} onOpenChange={(o) => { if (!o) { setFoundSale(null); setInvoiceSearch(""); } setOpenCreate(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" /> Nouvelle demande de retour
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>La demande sera soumise à validation par un administrateur ou gérant avant réinjection du stock.</span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Numéro de facture (INV-...)"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchInvoice()}
                  className="pl-10"
                />
              </div>
              <Button onClick={searchInvoice} disabled={searching}>
                {searching ? "..." : "Chercher"}
              </Button>
            </div>

            {foundSale && (
              <>
                <div className="border rounded-lg p-4 bg-muted/30 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{foundSale.invoice_number}</span>
                    <Badge variant="outline">{foundSale.client_name || "Client divers"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(foundSale.created_at).toLocaleDateString("fr-FR")} · Total : {format(foundSale.total)}
                    {foundSale.staff_name && ` · Caissier : ${foundSale.staff_name}`}
                  </p>
                </div>

                <div>
                  <Label className="mb-2 block">Articles à retourner</Label>
                  <div className="border rounded-md">
                    {draftItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/20">
                        <input
                          type="checkbox"
                          checked={item.quantity > 0}
                          onChange={() => toggleItem(idx)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{format(item.unit_price)} · max {item.max_quantity}</p>
                        </div>
                        <Input
                          type="number" min="0" max={item.max_quantity}
                          value={item.quantity}
                          onChange={(e) => setQty(idx, Number(e.target.value))}
                          className="w-20 h-8 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Motif du retour</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Décrivez la raison du retour..."
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-between text-sm text-muted-foreground border-t pt-3">
                  <span>Articles : {draftItems.filter((i) => i.quantity > 0).length}</span>
                  <span>Qté totale : {draftItems.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={!foundSale || submitting || draftItems.filter((i) => i.quantity > 0).length === 0}
            >
              {submitting ? "Envoi..." : "Soumettre la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Approve confirmation ─────────────────────────────────────────────── */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => { if (!o) { setApproveTarget(null); setAdminPassword(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Approuver ce retour ?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Le stock sera réinjecté automatiquement et la facture sera marquée comme retournée. Cette action est irréversible.
            </p>
            <div className="space-y-1.5">
              <Label>Mot de passe administrateur</Label>
              <Input
                type="password"
                placeholder="Saisissez votre mot de passe pour confirmer"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApprove()}
                className="rounded-xl h-11"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setApproveTarget(null); setAdminPassword(""); }} disabled={verifyingPassword}>
              Annuler
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={verifyingPassword || !adminPassword}
            >
              {verifyingPassword ? "Vérification..." : "Confirmer l'approbation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectionReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" /> Refuser ce retour
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motif du refus (optionnel)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Expliquer pourquoi le retour est refusé..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectionReason(""); }}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
