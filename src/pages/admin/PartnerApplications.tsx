import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, Search, ShieldAlert, UserCheck, XCircle, PauseCircle } from "lucide-react";

type PartnerStatus = "pending" | "approved" | "rejected" | "suspended" | "active";

interface PartnerApplicationRow {
  id: string;
  display_name: string;
  full_name?: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  department: string | null;
  partner_type: string | null;
  status: PartnerStatus;
  referral_code: string | null;
  referral_url: string | null;
  rejection_reason: string | null;
  created_at: string;
}

const statusLabel: Record<PartnerStatus, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
  suspended: "Suspendue",
  active: "Approuvée",
};

const statusBadgeVariant: Record<PartnerStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
  active: "default",
};

export default function PartnerApplicationsPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [applications, setApplications] = useState<PartnerApplicationRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<PartnerApplicationRow | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionMode, setDecisionMode] = useState<"reject" | "suspend" | null>(null);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("id, display_name, full_name, email, phone, city, department, partner_type, status, referral_code, referral_url, rejection_reason, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApplications((data || []) as PartnerApplicationRow[]);
    } catch (error: any) {
      toast.error(error.message || "Impossible de charger les demandes partenaires.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("partner-applications-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partners" },
        () => {
          void loadApplications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const totals = useMemo(() => {
    return applications.reduce(
      (acc, application) => {
        acc[application.status] = (acc[application.status] || 0) + 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, suspended: 0, active: 0 } as Record<PartnerStatus, number>
    );
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter((application) =>
      [application.display_name, application.full_name, application.email, application.phone, application.city, application.department, application.partner_type, application.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [applications, search]);

  const reviewApplication = async (application: PartnerApplicationRow, action: "approved" | "rejected" | "suspended") => {
    try {
      const rpcName = action === "approved" ? "approve_partner_application" : action === "rejected" ? "reject_partner_application" : "suspend_partner_application";
      const payload =
        action === "approved"
          ? { p_partner_id: application.id, p_partner_tier_id: null }
          : action === "rejected"
            ? { p_partner_id: application.id, p_rejection_reason: decisionReason.trim() || null }
            : { p_partner_id: application.id };

      const { error } = await supabase.rpc(rpcName, payload as any);
      if (error) throw error;

      toast.success(
        action === "approved"
          ? "Demande approuvée."
          : action === "rejected"
            ? "Demande refusée."
            : "Demande suspendue."
      );
      setDecisionReason("");
      setDecisionMode(null);
      setSelectedApplication(null);
      await loadApplications();
    } catch (error: any) {
      toast.error(error.message || "Impossible de traiter la demande.");
    }
  };

  return (
    <DashboardLayout
      role="super_admin"
      title="Demandes partenaires"
      subtitle="Validez, refusez ou suspendez les demandes de partenariat"
      userName={profile?.full_name || "Super Admin"}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">En attente</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{totals.pending}</p>
              {totals.pending > 0 ? <Badge variant="destructive">🔔 Nouvelle demande partenaire</Badge> : <Badge variant="outline">À jour</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Approuvées</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">{totals.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Refusées</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{totals.rejected}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Suspendues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals.suspended}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Queue de validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une demande"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-4">{t("common.name")}</th>
                      <th className="p-4">{t("common.email")}</th>
                      <th className="p-4">{t("common.phone")}</th>
                      <th className="p-4">Ville</th>
                      <th className="p-4">Département</th>
                      <th className="p-4">Type partenaire</th>
                      <th className="p-4">Date demande</th>
                      <th className="p-4">{t("common.status")}</th>
                      <th className="p-4 text-right">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((application) => (
                      <tr key={application.id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-4">
                          <div className="font-medium">{application.display_name || application.full_name || "—"}</div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{application.email || "—"}</td>
                        <td className="p-4 text-sm text-muted-foreground">{application.phone || "—"}</td>
                        <td className="p-4 text-sm text-muted-foreground">{application.city || "—"}</td>
                        <td className="p-4 text-sm text-muted-foreground">{application.department || "—"}</td>
                        <td className="p-4 text-sm text-muted-foreground">{application.partner_type || "—"}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(application.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="p-4">
                          <Badge variant={statusBadgeVariant[application.status]}>
                            {statusLabel[application.status]}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedApplication(application)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Voir
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => reviewApplication(application, "approved")}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Approuver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedApplication(application);
                                setDecisionMode("reject");
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Refuser
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedApplication(application);
                                setDecisionMode("suspend");
                              }}
                            >
                              <PauseCircle className="mr-2 h-4 w-4" />
                              Suspendre
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && filteredApplications.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                          Aucune demande trouvée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Demande partenaire</DialogTitle>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>{t("common.name")}</Label>
                  <div className="mt-1 rounded-md border p-3">{selectedApplication.display_name || selectedApplication.full_name || "—"}</div>
                </div>
                <div>
                  <Label>{t("common.email")}</Label>
                  <div className="mt-1 rounded-md border p-3">{selectedApplication.email || "—"}</div>
                </div>
                <div>
                  <Label>{t("common.phone")}</Label>
                  <div className="mt-1 rounded-md border p-3">{selectedApplication.phone || "—"}</div>
                </div>
                <div>
                  <Label>Type partenaire</Label>
                  <div className="mt-1 rounded-md border p-3">{selectedApplication.partner_type || "—"}</div>
                </div>
                <div>
                  <Label>Ville</Label>
                  <div className="mt-1 rounded-md border p-3">{selectedApplication.city || "—"}</div>
                </div>
                <div>
                  <Label>Département</Label>
                  <div className="mt-1 rounded-md border p-3">{selectedApplication.department || "—"}</div>
                </div>
              </div>

              {selectedApplication.referral_code && (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldAlert className="h-4 w-4" />
                    Code partenaire
                  </div>
                  <p className="mt-2 text-muted-foreground">{selectedApplication.referral_code}</p>
                </div>
              )}

              {selectedApplication.rejection_reason && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium text-destructive">Raison du refus</p>
                  <p className="mt-1 text-muted-foreground">{selectedApplication.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setSelectedApplication(null)}>
              Fermer
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => selectedApplication && reviewApplication(selectedApplication, "rejected")}
            >
              Refuser rapidement
            </Button>
            <Button
              type="button"
              onClick={() => selectedApplication && reviewApplication(selectedApplication, "approved")}
            >
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionMode !== null} onOpenChange={(open) => !open && setDecisionMode(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {decisionMode === "reject" ? "Refuser la demande" : "Suspendre la demande"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message optionnel</Label>
              <Textarea
                rows={4}
                placeholder="Votre demande n'a pas été approuvée."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDecisionMode(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant={decisionMode === "reject" ? "destructive" : "secondary"}
              onClick={() => {
                if (!selectedApplication || !decisionMode) return;
                void reviewApplication(selectedApplication, decisionMode);
              }}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
