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
import { useAuth } from "@/hooks/useAuth";

export default function PharmacyReports() {
  const businessId = usePharmacyBusinessId();
  const { format } = useCurrency();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [prescriptionsCount, setPrescriptionsCount] = useState(0);
  const [expiredLosses, setExpiredLosses] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [salesFilter, setSalesFilter] = useState<"all" | "valid_only" | "returns_only">("all");
  const [businessInfo, setBusinessInfo] = useState<{
    name: string;
    logo_url?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    const fetchBiz = async () => {
      try {
        const { data } = await supabase
          .from("businesses")
          .select("name, logo_url, phone, email, address")
          .eq("id", businessId)
          .maybeSingle();
        if (data) setBusinessInfo(data);
      } catch {}
    };
    fetchBiz();
  }, [businessId]);

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

  const printReport = (
    title: string,
    headers: string[],
    rows: (string | number)[][],
    summaryCards?: Array<{ label: string; value: string | number; color?: string }>,
    filterText?: string
  ) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour imprimer ou exporter en PDF.");
      return;
    }

    const companyName = businessInfo?.name || "Établissement Pharmaceutique";
    const companyAddress = businessInfo?.address || "";
    const companyPhone = businessInfo?.phone || "";
    const companyEmail = businessInfo?.email || "";
    const companyLogo = businessInfo?.logo_url || "";
    const operatorName = profile?.full_name || profile?.username || "Direction";
    const todayStr = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} — ${companyName}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              padding: 28px;
              color: #0f172a;
              background-color: #ffffff;
              margin: 0;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2.5px solid #0f766e;
              padding-bottom: 16px;
              margin-bottom: 22px;
            }
            .brand-left {
              display: flex;
              align-items: center;
              gap: 14px;
              max-width: 60%;
            }
            .brand-logo {
              max-height: 54px;
              max-width: 110px;
              object-fit: contain;
              border-radius: 6px;
            }
            .company-name {
              font-size: 21px;
              font-weight: 800;
              color: #0f766e;
              margin: 0 0 4px 0;
              letter-spacing: -0.3px;
              text-transform: uppercase;
            }
            .company-meta {
              font-size: 11.5px;
              color: #475569;
              line-height: 1.45;
            }
            .doc-right {
              text-align: right;
              min-width: 260px;
            }
            .doc-pill {
              display: inline-block;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              color: #0f766e;
              background-color: #ccfbf1;
              border: 1px solid #99f6e4;
              padding: 2px 8px;
              border-radius: 4px;
              margin-bottom: 6px;
            }
            .doc-title {
              font-size: 17px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 6px 0;
            }
            .doc-meta {
              font-size: 11px;
              color: #64748b;
              line-height: 1.4;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
              gap: 12px;
              margin-bottom: 22px;
            }
            .summary-card {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              background-color: #f8fafc;
              padding: 10px 14px;
            }
            .summary-label {
              font-size: 11px;
              text-transform: uppercase;
              font-weight: 600;
              color: #64748b;
              letter-spacing: 0.4px;
              margin-bottom: 4px;
            }
            .summary-value {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-top: 4px;
            }
            th {
              background-color: #f0fdf4;
              color: #115e59;
              text-align: left;
              padding: 9px 12px;
              border: 1px solid #cbd5e1;
              font-weight: 700;
              font-size: 11.5px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            td {
              padding: 8px 12px;
              border: 1px solid #e2e8f0;
              color: #1e293b;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .badge-returned {
              display: inline-block;
              padding: 2px 8px;
              font-size: 11px;
              font-weight: 700;
              border-radius: 9999px;
              background-color: #fee2e2;
              color: #991b1b;
              border: 1px solid #fca5a5;
            }
            .badge-paid {
              display: inline-block;
              padding: 2px 8px;
              font-size: 11px;
              font-weight: 700;
              border-radius: 9999px;
              background-color: #dcfce7;
              color: #166534;
              border: 1px solid #86efac;
            }
            .badge-credit {
              display: inline-block;
              padding: 2px 8px;
              font-size: 11px;
              font-weight: 700;
              border-radius: 9999px;
              background-color: #f3e8ff;
              color: #7e22ce;
              border: 1px solid #d8b4fe;
            }
            .report-footer {
              margin-top: 36px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 11px;
              color: #64748b;
            }
            .signature-box {
              min-width: 220px;
              text-align: center;
            }
            .signature-line {
              margin-top: 48px;
              border-top: 1.5px solid #0f172a;
              padding-top: 4px;
              font-size: 11px;
              font-weight: 600;
              color: #0f172a;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; size: landscape; }
            }
          </style>
        </head>
        <body>
          <!-- En-tête officiel de l'établissement -->
          <div class="report-header">
            <div class="brand-left">
              ${companyLogo ? `<img src="${companyLogo}" class="brand-logo" alt="Logo" />` : ""}
              <div>
                <h1 class="company-name">${companyName}</h1>
                <div class="company-meta">
                  ${companyAddress ? `<span>📍 ${companyAddress}</span><br />` : ""}
                  ${companyPhone ? `<span>📞 ${companyPhone}</span> ` : ""}
                  ${companyEmail ? `<span>• ✉️ ${companyEmail}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="doc-right">
              <div class="doc-pill">Document Comptable & Administratif</div>
              <div class="doc-title">${title}</div>
              <div class="doc-meta">
                <div><strong>Date d'émission :</strong> ${todayStr} à ${timeStr}</div>
                <div><strong>Édité par :</strong> ${operatorName}</div>
                ${filterText ? `<div><strong>Périmètre :</strong> ${filterText}</div>` : ""}
              </div>
            </div>
          </div>

          <!-- Synthèse chiffrée -->
          ${summaryCards && summaryCards.length > 0 ? `
            <div class="summary-grid">
              ${summaryCards.map((c) => `
                <div class="summary-card">
                  <div class="summary-label">${c.label}</div>
                  <div class="summary-value" style="${c.color ? `color: ${c.color};` : ''}">${c.value}</div>
                </div>
              `).join("")}
            </div>
          ` : ""}

          <!-- Tableau de données -->
          <table>
            <thead>
              <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.map((r) => `<tr>${r.map((c) => {
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

          <!-- Pied de page avec validation -->
          <div class="report-footer">
            <div>
              <p style="margin: 0 0 2px 0;">Rapport certifié exact et conforme aux écritures de caisse et de stock.</p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">Émis le ${todayStr} — Page 1 / 1</p>
            </div>
            <div class="signature-box">
              <div class="signature-line">Visa & Signature de la Direction</div>
            </div>
          </div>

          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 250); };
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

        const totalSalesAmount = filteredSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
        const returnsCount = filteredSales.filter((s: any) => Number(s.total || 0) === 0 || (s.notes && String(s.notes).toLowerCase().includes("retour"))).length;
        const validSalesCount = filteredSales.length - returnsCount;

        const summaryCards = [
          { label: "Transactions", value: filteredSales.length },
          { label: "Ventes Valides", value: validSalesCount, color: "#166534" },
          { label: "Total Encaissé", value: format(totalSalesAmount), color: "#0f766e" },
          { label: "Retours en Stock", value: `${returnsCount} transaction(s)`, color: returnsCount > 0 ? "#b91c1c" : "#64748b" },
        ];

        const filterLabel = salesFilter === "returns_only"
          ? "Retours en stock uniquement"
          : salesFilter === "valid_only"
          ? "Ventes valides (retours à 0 G masqués)"
          : "Toutes transactions confondues";

        if (exportFormat === "pdf") {
          printReport(reportTitle, headers, rows, summaryCards, filterLabel);
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

        const totalQty = prods.reduce((sum: number, p: any) => sum + Number(p.total_stock_quantity || 0), 0);
        const totalCostVal = prods.reduce((sum: number, p: any) => sum + (Number(p.total_stock_quantity || 0) * Number(p.cost_price || 0)), 0);
        const totalSaleVal = prods.reduce((sum: number, p: any) => sum + (Number(p.total_stock_quantity || 0) * Number(p.sale_price || 0)), 0);

        const summaryCards = [
          { label: "Articles Référencés", value: prods.length },
          { label: "Stock Total (Unités)", value: totalQty },
          { label: "Valeur au Coût d'Achat", value: format(totalCostVal), color: "#0f766e" },
          { label: "Valeur Potentielle de Vente", value: format(totalSaleVal), color: "#166534" },
        ];

        if (exportFormat === "pdf") {
          printReport("Inventaire Actuel & Valeur du Stock", headers, rows, summaryCards, "Stock global actif");
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

        const totalRiskLosses = batches.reduce((sum: number, b: any) => sum + (Number(b.current_quantity || 0) * Number(b.cost_price || 0)), 0);
        const expiredBatchesCount = batches.filter((b: any) => new Date(b.expiration_date) < today).length;

        const summaryCards = [
          { label: "Lots Actifs", value: batches.length },
          { label: "Lots Déjà Périmés", value: expiredBatchesCount, color: expiredBatchesCount > 0 ? "#b91c1c" : "#166534" },
          { label: "Valeur Financière à Risque", value: format(totalRiskLosses), color: "#ea580c" },
        ];

        if (exportFormat === "pdf") {
          printReport("Rapport des Péremptions & Lots à Risque", headers, rows, summaryCards, "Lots en stock");
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
