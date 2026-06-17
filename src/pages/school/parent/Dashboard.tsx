import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Wallet, FileText, CreditCard, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export default function ParentDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { format: formatAmount } = useCurrency();

  const [parentRecord, setParentRecord] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchParentData = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        // 1. Get the parent record linked to this user account
        const { data: parentData, error: parentErr } = await supabase
          .from("school_parents")
          .select("*, business:business_id(name)")
          .eq("user_id", user.id)
          .maybeSingle();

        if (parentErr) throw parentErr;
        if (!parentData) {
          setIsLoading(false);
          return;
        }

        setParentRecord(parentData);

        // 2. Get their children
        const { data: childrenData, error: childErr } = await supabase
          .from("school_student_parents")
          .select("student:student_id(*)")
          .eq("parent_id", parentData.id);

        if (childErr) throw childErr;
        
        const kids = childrenData?.map(c => c.student) || [];
        setChildren(kids);

        // 3. Get invoices for those children
        if (kids.length > 0) {
          const studentIds = kids.map(k => k.id);
          const { data: invData, error: invErr } = await supabase
            .from("school_invoices")
            .select("*, academic_year:academic_year_id(name)")
            .in("student_id", studentIds)
            .order("created_at", { ascending: false });
            
          if (invErr) throw invErr;
          setInvoices(invData || []);
        }

      } catch (error: any) {
        toast.error("Erreur", { description: error.message });
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) fetchParentData();
  }, [user?.id, isAuthenticated]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Chargement de votre espace parent...</div>
      </DashboardLayout>
    );
  }

  if (!parentRecord) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto mt-12 text-center space-y-4">
          <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
          <h2 className="text-2xl font-bold">Bienvenue sur le Portail Parent</h2>
          <p className="text-muted-foreground">
            Votre compte n'est pas encore lié à un dossier parent par l'administration de l'école.
            Veuillez contacter le secrétariat pour lier votre compte.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const totalBalanceDue = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Espace Parent</h1>
            <p className="text-muted-foreground">
              Bienvenue, {parentRecord.first_name} {parentRecord.last_name} ({parentRecord.business?.name})
            </p>
          </div>
          {totalBalanceDue > 0 && (
            <Button className="bg-primary text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-2" />
              Payer en ligne
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Solde Total à Payer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${totalBalanceDue > 0 ? 'text-destructive' : 'text-success'}`}>
                {formatAmount(totalBalanceDue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalBalanceDue > 0 ? "Paiement requis" : "Vous êtes à jour !"}
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vos Enfants Inscrits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {children.map(child => (
                  <div key={child.id} className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg border min-w-[200px]">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{child.first_name} {child.last_name}</div>
                      <div className="text-xs text-muted-foreground">{child.matricule || "Sans matricule"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Historique des Factures
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Année</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Reste (Solde)</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Reçu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune facture</TableCell></TableRow>
                ) : (
                  invoices.map(inv => {
                    const child = children.find(c => c.id === inv.student_id);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.invoice_number}
                          <div className="text-[10px] text-muted-foreground">{format(new Date(inv.issue_date || inv.created_at), "dd/MM/yyyy")}</div>
                        </TableCell>
                        <TableCell>{child ? `${child.first_name} ${child.last_name}` : "Inconnu"}</TableCell>
                        <TableCell>{inv.academic_year?.name}</TableCell>
                        <TableCell>{formatAmount(inv.total_amount)}</TableCell>
                        <TableCell className={inv.balance > 0 ? "text-destructive font-bold" : ""}>
                          {formatAmount(inv.balance)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                            ${inv.status === 'paid' ? 'bg-success/10 text-success' : 
                              inv.status === 'partial' ? 'bg-warning/10 text-warning' : 
                              'bg-destructive/10 text-destructive'}`}>
                            {inv.status === 'paid' ? 'Payé' : inv.status === 'partial' ? 'Partiel' : 'Non Payé'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="Télécharger">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
