import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Package, AlertTriangle, FileText, Download } from "lucide-react";
import { toast } from "sonner";

export default function PharmacyReports() {
  const [loading, setLoading] = useState(false);

  const downloadReport = (type: string) => {
    setLoading(true);
    setTimeout(() => {
      toast.success(`Le rapport ${type} a été généré et téléchargé.`);
      setLoading(false);
    }, 1500);
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
                <div className="text-2xl font-bold">0 HTG</div>
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
                <div className="text-2xl font-bold">0 HTG</div>
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
                <div className="text-2xl font-bold">0</div>
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
                <div className="text-2xl font-bold text-red-500">0 HTG</div>
                <p className="text-xs text-muted-foreground">0 lots périmés détruits</p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        <h2 className="text-xl font-bold mb-4">Générer des Rapports</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapport des Ventes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Historique complet des transactions, ventilé par méthode de paiement et par vendeur.</p>
              <Button onClick={() => downloadReport("Ventes")} disabled={loading} className="w-full">
                <Download className="w-4 h-4 mr-2" /> Exporter (PDF/Excel)
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inventaire Actuel & Valeur</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Liste de tous les produits en stock, incluant la valorisation FEFO et les ruptures.</p>
              <Button onClick={() => downloadReport("Inventaire")} disabled={loading} className="w-full" variant="outline">
                <Download className="w-4 h-4 mr-2" /> Exporter (PDF/Excel)
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapport des Péremptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Identification des lots expirant dans les 3 prochains mois pour actions de déstockage.</p>
              <Button onClick={() => downloadReport("Péremptions")} disabled={loading} className="w-full" variant="outline">
                <Download className="w-4 h-4 mr-2" /> Exporter (PDF/Excel)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
