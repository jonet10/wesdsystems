import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Package, AlertTriangle, FileText, Download, RefreshCw, Printer, Filter } from "lucide-react";
import { toast } from "sonner";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { reportsService } from "@/modules/pharmacy/services/reportsService";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";

export default function PharmacyReports() {
  const businessId = usePharmacyBusinessId();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [prescriptionsCount, setPrescriptionsCount] = useState(0);
  const [expiredLosses, setExpiredLosses] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [salesFilter, setSalesFilter] = useState<"all" | "valid_only" | "returns_only">("all");

  const loadStats = async () => {
    if (!businessId) return;
    setStatsLoading(true);
    try {
      const data = await reportsService.getDashboardStats(businessId);
      setStats(data);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch prescriptions count
      const { count: prescCount, error: prescError } = await supabase
        .from("pharmacy_prescriptions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", startOfMonth.toISOString());
      
      if (!prescError) {
        setPrescriptionsCount(prescCount || 0);
      }

      // Fetch expired batches
      const { data: expiredBatches, error: expError } = await supabase
        .from("pharmacy_batches")
        .select("current_quantity, cost_price")
        .eq("business_id", businessId)
        .lt("expiration_date", new Date().toISOString().split('T')[0])
        .gt("current_quantity", 0);

      if (!expError && expiredBatches) {
        const losses = expiredBatches.reduce((sum, b) => sum + Number(b.current_quantity) * Number(b.cost_price || 0), 0);
        setExpiredLosses(losses);
        setExpiredCount(expiredBatches.length);
      }

    } catch (error) {
      console.error("Error loading report stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [businessId]);

  const exportToCsv = (filename: string, rows: (string | number)[][]) => {
    const csvContent = "\uFEFF" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = (title: string, headers: string[], rows: (string | number)[][]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour imprimer ou exporter en PDF.");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #07A278; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; color: #07A278; }
            .date { font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { background-color: #f0fdf4; color: #166534; text-align: left; padding: 8px 12px; border: 1px solid #cbd5e1; }
            td { padding: 8px 12px; border: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge-returned {
              display: inline-block;
              padding: 2px 8px;
              font-size: 11px;
              font-weight: 600;
              border-radius: 9999px;
              background-color: #fee2e2;
              color: #b91c1c;
              border: 1px solid #fca5a5;
            }
            .badge-paid {
              display: inline-block;
              padding: 2px 8px;
              font-size: 11px;
              font-weight: 600;
              border-radius: 9999px;
              background-color: #dcfce7;
              color: #15803d;
              border: 1px solid #86efac;
            }
            .badge-credit {
              display: inline-block;
              padding: 2px 8px;
              font-size: 11px;
              font-weight: 600;
              border-radius: 9999px;
              background-color: #f3e8ff;
              color: #7e22ce;
              border: 1px solid #d8b4fe;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; size: landscape; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${title}</div>
              <div class="date">WESD Systems — Module Pharmacie</div>
            </div>
            <div class="date">Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</div>
          </div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>${r.map(c => {
                const val = String(c ?? "-");
                if (val === "Retourné en stock") {
                  return `<td><span class="badge-returned">↩ Retourné en stock</span></td>`;
                }
                if (val === "Payé") {
                  return `<td><span class="badge-paid">✓ Payé</span></td>`;
                }
                if (val.startsWith("Crédit")) {
                  return `<td><span class="badge-credit">${val}</span></td>`;
                }
                return `<td>${val}</td>`;
              }).join("")}</tr>`).join("")}
            </tbody>
          </table>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 200); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const downloadReport = async (type: string, exportFormat: "excel" | "pdf" = "excel") => {
    if (!businessId) {
      toast.error("Veuillez sélectionner une pharmacie");
      return;
    }

    setLoading(true);
    try {
      if (type === "Ventes") {
        const { data: sales, error } = await supabase
          .from("pharmacy_sales")
          .select("created_at, receipt_number, total, payment_method, payment_status, notes, customer:customer_id(first_name, last_name)")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!sales || sales.length === 0) {
          toast.info("Aucune vente enregistrée pour le moment.");
          return;
        }

        // Filtrage selon le choix :
        // - "valid_only" : supprime du rapport les produits retournés à 0 G
        // - "returns_only" : n'affiche que les retours
        // - "all" : affiche tout avec statut explicite "Retourné en stock"
        const filteredSales = sales.filter((s: any) => {
          const isReturn = Number(s.total || 0) === 0 || (s.notes && String(s.notes).toLowerCase().includes("retour")) || s.payment_status === "returned";
          if (salesFilter === "valid_only") return !isReturn;
          if (salesFilter === "returns_only") return isReturn;
          return true;
        });

        if (filteredSales.length === 0) {
          toast.info(salesFilter === "valid_only" ? "Aucune vente active trouvée (toutes ont été retournées)." : "Aucun retour produit trouvé.");
          return;
        }

        const headers = ["Date", "N° Reçu", "Client", "Mode de Paiement", "Total", "Statut"];
        const rows: (string | number)[][] = filteredSales.map((s: any) => {
          const isReturn = Number(s.total || 0) === 0 || (s.notes && String(s.notes).toLowerCase().includes("retour")) || s.payment_status === "returned";
          let statusLabel = "Payé";
          if (isReturn) {
            statusLabel = "Retourné en stock";
          } else if (s.payment_status === "credit") {
            statusLabel = "Crédit (En attente)";
          } else if (s.payment_status === "partial") {
            statusLabel = "Partiel";
          }

          return [
            new Date(s.created_at).toLocaleString("fr-FR"),
            s.receipt_number || "-",
            s.customer ? `${s.customer.first_name || ""} ${s.customer.last_name || ""}`.trim() : "Client de passage",
            s.payment_method?.toUpperCase() || "CASH",
            s.total || 0,
            statusLabel
          ];
        });

        const reportTitle = salesFilter === "returns_only"
          ? "Rapport des Retours Produits en Stock — Pharmacie"
          : salesFilter === "valid_only"
          ? "Rapport des Ventes Nettes — Pharmacie"
          : "Rapport des Ventes — Pharmacie";

        if (exportFormat === "pdf") {
          printReport(reportTitle, headers, rows);
        } else {
          exportToCsv("rapport_ventes_pharmacie", [headers, ...rows]);
        }
        toast.success("Rapport des ventes généré avec succès !");

      } else if (type === "Inventaire") {
        const { data: prods, error } = await supabase
          .from("pharmacy_products")
          .select("name, generic_name, cost_price, sale_price, total_stock_quantity, min_stock_alert, category:category_id(name)")
          .eq("business_id", businessId)
          .order("name");

        if (error) throw error;
        if (!prods || prods.length === 0) {
          toast.info("Aucun produit dans l'inventaire.");
          return;
        }

        const headers = ["Médicament / Produit", "Nom Générique", "Catégorie", "Stock Actuel", "Alerte Min", "Prix d'Achat", "Prix de Vente", "Valeur Stock (Achat)", "Valeur Stock (Vente)"];
        const rows: (string | number)[][] = prods.map((p: any) => {
          const stock = Number(p.total_stock_quantity || 0);
          const cost = Number(p.cost_price || 0);
          const sale = Number(p.sale_price || 0);
          return [
            p.name || "-",
            p.generic_name || "-",
            p.category?.name || "Sans catégorie",
            stock,
            p.min_stock_alert || 0,
            cost,
            sale,
            (stock * cost).toFixed(2),
            (stock * sale).toFixed(2)
          ];
        });

        if (exportFormat === "pdf") {
          printReport("Inventaire Actuel & Valeur du Stock", headers, rows);
        } else {
          exportToCsv("inventaire_pharmacie", [headers, ...rows]);
        }
        toast.success("Inventaire généré avec succès !");

      } else if (type === "Péremptions") {
        const { data: batches, error } = await supabase
          .from("pharmacy_batches")
          .select("batch_number, expiration_date, initial_quantity, current_quantity, cost_price, sale_price, product:product_id(name)")
          .eq("business_id", businessId)
          .gt("current_quantity", 0)
          .order("expiration_date", { ascending: true });

        if (error) throw error;
        if (!batches || batches.length === 0) {
          toast.info("Aucun lot en stock pour le moment.");
          return;
        }

        const today = new Date();
        const headers = ["Numéro de Lot", "Médicament", "Date d'Expiration", "Jours Restants", "Quantité Restante", "Prix Coûtant", "Valeur à Risque", "Statut"];
        const rows: (string | number)[][] = batches.map((b: any) => {
          const exp = new Date(b.expiration_date);
          const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const qty = Number(b.current_quantity || 0);
          const cost = Number(b.cost_price || 0);
          const status = daysLeft < 0 ? "PÉRIMÉ" : daysLeft <= 30 ? "CRITIQUE (≤30j)" : daysLeft <= 90 ? "ATTENTION (≤90j)" : "VALIDE";
          return [
            b.batch_number || "-",
            b.product?.name || "-",
            b.expiration_date || "-",
            daysLeft,
            qty,
            cost,
            (qty * cost).toFixed(2),
            status
          ];
        });

        if (exportFormat === "pdf") {
          printReport("Rapport des Péremptions & Lots à Risque", headers, rows);
        } else {
          exportToCsv("rapport_peremptions_pharmacie", [headers, ...rows]);
        }
        toast.success("Rapport des péremptions généré avec succès !");
      }
    } catch (err: any) {
      toast.error("Erreur lors de l'export : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Rapports & Statistiques" subtitle="Analyses de l'activité de la pharmacie">
      <div className="p-6">
        <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chiffre d'Affaires Mensuel</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : `${format(stats?.salesMonth ?? 0)}`}
                </div>
                <p className="text-xs text-muted-foreground">+0% par rapport au mois dernier</p>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valeur du Stock</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : `${format(stats?.totalStockValue ?? 0)}`}
                </div>
                <p className="text-xs text-muted-foreground">Au prix d'achat</p>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ordonnances Traitées</CardTitle>
                <FileText className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : prescriptionsCount}
                </div>
                <p className="text-xs text-muted-foreground">Ce mois-ci</p>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pertes (Péremptions)</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {statsLoading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : `${format(expiredLosses)}`}
                </div>
                <p className="text-xs text-muted-foreground">{expiredCount} lots périmés en stock</p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        <h2 className="text-xl font-bold mb-4">Générer des Rapports</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Rapport des Ventes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Historique des transactions, avec détection automatique des retours produits et ajustements de stock.
              </p>

              <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
                <Label htmlFor="sales-filter-select" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Filter className="h-3.5 w-3.5 text-primary" /> Filtrer le contenu du rapport :
                </Label>
                <Select
                  value={salesFilter}
                  onValueChange={(val: any) => setSalesFilter(val)}
                >
                  <SelectTrigger id="sales-filter-select" className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Sélectionner un filtre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      📋 Toutes les transactions (avec mention « Retourné en stock »)
                    </SelectItem>
                    <SelectItem value="valid_only">
                      ✨ Ventes valides uniquement (masquer les retours à 0 G)
                    </SelectItem>
                    <SelectItem value="returns_only">
                      ↩️ Retours en stock uniquement (audit)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {salesFilter === "valid_only" && "Les produits retournés à 0 G sont masqués du rapport."}
                  {salesFilter === "all" && "Les produits retournés affichent explicitement le statut « Retourné en stock »."}
                  {salesFilter === "returns_only" && "Seules les ventes retournées et réintégrées au stock seront listées."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button onClick={() => downloadReport("Ventes", "excel")} disabled={loading} className="flex-1 bg-primary hover:bg-primary-dark text-primary-fg shadow-sm gap-1.5">
                  <Download className="w-4 h-4" /> Excel (.csv)
                </Button>
                <Button onClick={() => downloadReport("Ventes", "pdf")} disabled={loading} variant="outline" className="flex-1 gap-1.5 border-border/80">
                  <Printer className="w-4 h-4" /> Imprimer / PDF
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Inventaire Actuel & Valeur</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Liste de tous les produits en stock, incluant la valorisation FEFO et les ruptures.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => downloadReport("Inventaire", "excel")} disabled={loading} className="flex-1 bg-primary hover:bg-primary-dark text-primary-fg shadow-sm gap-1.5">
                  <Download className="w-4 h-4" /> Excel (.csv)
                </Button>
                <Button onClick={() => downloadReport("Inventaire", "pdf")} disabled={loading} variant="outline" className="flex-1 gap-1.5 border-border/80">
                  <Printer className="w-4 h-4" /> Imprimer / PDF
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Rapport des Péremptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Identification des lots expirant dans les 3 prochains mois pour actions de déstockage.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => downloadReport("Péremptions", "excel")} disabled={loading} className="flex-1 bg-primary hover:bg-primary-dark text-primary-fg shadow-sm gap-1.5">
                  <Download className="w-4 h-4" /> Excel (.csv)
                </Button>
                <Button onClick={() => downloadReport("Péremptions", "pdf")} disabled={loading} variant="outline" className="flex-1 gap-1.5 border-border/80">
                  <Printer className="w-4 h-4" /> Imprimer / PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
