import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Zap, CheckCircle2, Clock, DollarSign,
  AlertCircle, Wallet, Users, TrendingDown, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { usePayroll, useGeneratePayroll, useUpdatePayroll, useMarkPayrollPaid } from "@/hooks/useSchoolData";
import type { SchoolPayroll } from "@/modules/school/types";

const MONTHS_FR = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const PAY_METHODS = ["Cash", "MonCash", "NatCash", "Virement", "Chèque", "Autre"];

function calcNet(gross: number, absences: number, deduction: number, workingDays = 22) {
  const daily = gross / workingDays;
  return Math.max(0, Math.round(gross - daily * absences - deduction));
}

export default function SchoolPayroll() {
  const { format: formatAmount } = useCurrency();
  const { settings } = useSchoolSettings();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: payrolls = [], isLoading } = usePayroll(month, year);
  const generateMutation = useGeneratePayroll();
  const updateMutation = useUpdatePayroll();
  const markPaidMutation = useMarkPayrollPaid();

  // Pay dialog
  const [payDialog, setPayDialog] = useState<{ open: boolean; entry: SchoolPayroll | null }>({ open: false, entry: null });
  const [payMethod, setPayMethod] = useState("Cash");
  const [isPaying, setIsPaying] = useState(false);

  // Inline edit state (keyed by payroll id)
  const [editValues, setEditValues] = useState<Record<string, { gross: string; absences: string; deduction: string }>>({});

  const workingDays = settings?.weeks_per_month ? Math.round(settings.weeks_per_month * 5) : 22;

  // Navigation
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({ month, year });
      toast.success(`Payroll de ${MONTHS_FR[month]} ${year} généré avec succès !`);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    }
  };

  const getEdit = (id: string, entry: SchoolPayroll) =>
    editValues[id] ?? {
      gross: String(entry.gross_salary),
      absences: String(entry.absence_days),
      deduction: String(entry.deduction),
    };

  const setEdit = (id: string, field: "gross" | "absences" | "deduction", val: string) => {
    setEditValues(prev => ({
      ...prev,
      [id]: { ...getEdit(id, payrolls.find(p => p.id === id)!), [field]: val },
    }));
  };

  const handleBlurSave = async (entry: SchoolPayroll) => {
    const ev = editValues[entry.id];
    if (!ev) return;
    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        month,
        year,
        payload: {
          gross_salary: parseFloat(ev.gross) || 0,
          absence_days: parseFloat(ev.absences) || 0,
          deduction: parseFloat(ev.deduction) || 0,
        },
      });
      // clear local edits
      setEditValues(prev => { const n = { ...prev }; delete n[entry.id]; return n; });
    } catch (e: any) {
      toast.error("Erreur de mise à jour");
    }
  };

  const handleMarkPaid = async () => {
    if (!payDialog.entry) return;
    setIsPaying(true);
    try {
      await markPaidMutation.mutateAsync({ id: payDialog.entry.id, payMethod, month, year });
      toast.success(`Paiement enregistré ! Une dépense "Salaires" a été créée automatiquement.`);
      setPayDialog({ open: false, entry: null });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement");
    } finally {
      setIsPaying(false);
    }
  };

  // Summary stats
  const totalBrut = payrolls.reduce((s, p) => s + Number(p.gross_salary), 0);
  const totalNet = payrolls.reduce((s, p) => s + Number(p.net_salary), 0);
  const totalPaid = payrolls.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.net_salary), 0);
  const totalPending = payrolls.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.net_salary), 0);
  const countPaid = payrolls.filter(p => p.status === "paid").length;
  const countPending = payrolls.filter(p => p.status === "pending").length;
  const generated = payrolls.length > 0;

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" /> Payroll Mensuel
            </h1>
            <p className="text-muted-foreground">Générez et gérez les fiches de paie du personnel</p>
          </div>

          {/* Month navigator */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-center min-w-[140px]">
              <p className="font-semibold text-base">{MONTHS_FR[month]} {year}</p>
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {generated && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Personnel</p>
              <p className="text-xl font-bold">{payrolls.length}</p>
              <p className="text-xs text-muted-foreground">{countPaid} payé · {countPending} en attente</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Total Brut</p>
              <p className="text-xl font-bold text-foreground">{formatAmount(totalBrut)}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Total Net</p>
              <p className="text-xl font-bold text-primary">{formatAmount(totalNet)}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Payé</p>
              <p className="text-xl font-bold text-green-500">{formatAmount(totalPaid)}</p>
              {totalPending > 0 && <p className="text-xs text-muted-foreground">Restant : {formatAmount(totalPending)}</p>}
            </Card>
          </div>
        )}

        {/* ── Generate button or main table ── */}
        {!generated && !isLoading ? (
          <Card className="p-10 flex flex-col items-center justify-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Aucun payroll pour {MONTHS_FR[month]} {year}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cliquez sur le bouton ci-dessous pour générer automatiquement les fiches de paie de tout le personnel actif avec leurs salaires configurés.
              </p>
            </div>
            <Button size="lg" onClick={handleGenerate} disabled={generateMutation.isPending}>
              <Zap className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? "Génération..." : `Générer le payroll de ${MONTHS_FR[month]} ${year}`}
            </Button>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-semibold text-sm text-muted-foreground">
                {isLoading ? "Chargement..." : `${payrolls.length} fiche(s) — ${MONTHS_FR[month]} ${year}`}
              </p>
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generateMutation.isPending}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {generateMutation.isPending ? "..." : "Ajouter les manquants"}
              </Button>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Fonction</TableHead>
                    <TableHead className="text-right">Salaire Brut</TableHead>
                    <TableHead className="text-center">Abs. (j)</TableHead>
                    <TableHead className="text-right">Déduction</TableHead>
                    <TableHead className="text-right font-semibold">Net à Payer</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : payrolls.map(entry => {
                    const ev = editValues[entry.id];
                    const displayGross = ev ? parseFloat(ev.gross) || 0 : Number(entry.gross_salary);
                    const displayAbs = ev ? parseFloat(ev.absences) || 0 : Number(entry.absence_days);
                    const displayDed = ev ? parseFloat(ev.deduction) || 0 : Number(entry.deduction);
                    const previewNet = ev ? calcNet(displayGross, displayAbs, displayDed, workingDays) : Number(entry.net_salary);

                    return (
                      <TableRow key={entry.id} className={entry.status === "paid" ? "opacity-70" : undefined}>
                        <TableCell className="font-medium">
                          {entry.teacher?.first_name} {entry.teacher?.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.teacher?.job_title || "Professeur"}
                        </TableCell>

                        {/* Gross — editable if pending */}
                        <TableCell>
                          {entry.status === "paid" ? (
                            <span className="text-right block font-medium">{formatAmount(entry.gross_salary)}</span>
                          ) : (
                            <div className="relative">
                              <Input
                                type="number"
                                value={ev?.gross ?? String(entry.gross_salary)}
                                onChange={e => setEdit(entry.id, "gross", e.target.value)}
                                onFocus={e => { e.target.select(); if (!ev) setEditValues(p => ({ ...p, [entry.id]: { gross: String(entry.gross_salary), absences: String(entry.absence_days), deduction: String(entry.deduction) } })); }}
                                onBlur={() => handleBlurSave(entry)}
                                className="h-8 text-right font-medium w-28 ml-auto"
                              />
                            </div>
                          )}
                        </TableCell>

                        {/* Absences */}
                        <TableCell className="text-center">
                          {entry.status === "paid" ? (
                            <span>{entry.absence_days}</span>
                          ) : (
                            <Input
                              type="number" min="0" step="0.5"
                              value={ev?.absences ?? String(entry.absence_days)}
                              onChange={e => setEdit(entry.id, "absences", e.target.value)}
                              onFocus={e => { e.target.select(); if (!ev) setEditValues(p => ({ ...p, [entry.id]: { gross: String(entry.gross_salary), absences: String(entry.absence_days), deduction: String(entry.deduction) } })); }}
                              onBlur={() => handleBlurSave(entry)}
                              className="h-8 text-center w-16 mx-auto"
                            />
                          )}
                        </TableCell>

                        {/* Deduction */}
                        <TableCell>
                          {entry.status === "paid" ? (
                            <span className="text-right block">{formatAmount(entry.deduction)}</span>
                          ) : (
                            <div className="relative">
                              <Input
                                type="number" min="0"
                                value={ev?.deduction ?? String(entry.deduction)}
                                onChange={e => setEdit(entry.id, "deduction", e.target.value)}
                                onFocus={e => { e.target.select(); if (!ev) setEditValues(p => ({ ...p, [entry.id]: { gross: String(entry.gross_salary), absences: String(entry.absence_days), deduction: String(entry.deduction) } })); }}
                                onBlur={() => handleBlurSave(entry)}
                                className="h-8 text-right w-24 ml-auto"
                              />
                            </div>
                          )}
                        </TableCell>

                        {/* Net */}
                        <TableCell className="text-right">
                          <span className={`font-bold text-base ${ev ? "text-amber-500" : "text-primary"}`}>
                            {formatAmount(previewNet)}
                          </span>
                          {ev && (
                            <span className="block text-xs text-muted-foreground">aperçu</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {entry.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                              <CheckCircle2 className="h-3 w-3" /> Payé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                              <Clock className="h-3 w-3" /> En attente
                            </span>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right">
                          {entry.status === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => { setPayDialog({ open: true, entry }); setPayMethod("Cash"); }}
                            >
                              <DollarSign className="h-3.5 w-3.5 mr-1" /> Payer
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {entry.pay_method} · {entry.paid_at ? new Date(entry.paid_at).toLocaleDateString("fr-FR") : ""}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── Pay Dialog ── */}
        <Dialog open={payDialog.open} onOpenChange={open => setPayDialog(p => ({ ...p, open }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmer le paiement</DialogTitle>
            </DialogHeader>
            {payDialog.entry && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Employé</span>
                    <span className="font-medium">{payDialog.entry.teacher?.first_name} {payDialog.entry.teacher?.last_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fonction</span>
                    <span>{payDialog.entry.teacher?.job_title || "Professeur"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Période</span>
                    <span>{MONTHS_FR[month]} {year}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Net à payer</span>
                    <span className="font-bold text-lg text-primary">{formatAmount(payDialog.entry.net_salary)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mode de paiement</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAY_METHODS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`py-2 px-3 rounded-lg text-sm border-2 transition-all font-medium ${payMethod === m ? "border-primary bg-primary/5 text-primary" : "border-muted hover:bg-muted/30"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Une dépense "Salaires" sera automatiquement créée dans la page Dépenses.
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setPayDialog({ open: false, entry: null })}>Annuler</Button>
                  <Button onClick={handleMarkPaid} disabled={isPaying}>
                    {isPaying ? "Enregistrement..." : `Confirmer le paiement`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
