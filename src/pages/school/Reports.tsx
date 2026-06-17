import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, PieChart, TrendingUp } from "lucide-react";

export default function SchoolReports() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports & Analyses</h1>
          <p className="text-muted-foreground">
            Générez des rapports financiers et académiques pour votre établissement
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Bilan des Encaissements</CardTitle>
              <CardDescription>Rapport détaillé des paiements reçus par période.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Générer (PDF/Excel)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-10 w-10 bg-destructive/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-5 w-5 text-destructive" />
              </div>
              <CardTitle>Liste des Impayés</CardTitle>
              <CardDescription>Tous les élèves en retard de paiement avec les montants dus.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Générer (PDF/Excel)
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-10 w-10 bg-success/10 rounded-lg flex items-center justify-center mb-4">
                <PieChart className="h-5 w-5 text-success" />
              </div>
              <CardTitle>Bilan Dépenses vs Revenus</CardTitle>
              <CardDescription>Comparatif de la rentabilité de l'établissement.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Générer (PDF/Excel)
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <PieChart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Module de génération avancée à venir</h3>
            <p className="text-muted-foreground max-w-md">
              Les rapports personnalisés avec sélection de dates et de graphiques avancés seront disponibles dans la prochaine mise à jour.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
