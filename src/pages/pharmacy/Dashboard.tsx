import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Activity, Pill, Users, AlertTriangle, TrendingUp, ShoppingBag, DollarSign } from "lucide-react";
import { productService, setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { glowupStore } from "@/lib/store";

export default function PharmacyDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    categories: 0
  });

  useEffect(() => {
    try {
      const bizId = glowupStore.getSalons()[0]?.business_id;
      if (bizId) setPharmacyBusinessId(bizId);
    } catch (e) {}
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [prods, cats] = await Promise.all([
        productService.getProducts(),
        productService.getCategories()
      ]);
      setStats({
        products: prods.length,
        categories: cats.length,
        lowStock: prods.filter(p => p.total_stock_quantity <= p.min_stock_alert).length
      });
    } catch (e) {
      // ignore for now
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Tableau de Bord Pharmacie" subtitle="Aperçu de l'activité">
      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-6">
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Médicaments & Produits</CardTitle>
              <Pill className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.products}</div>
              <p className="text-xs text-muted-foreground">Dans {stats.categories} catégories</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.lowStock}</div>
              <p className="text-xs text-muted-foreground">Produits sous le seuil minimum</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventes du Jour</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 HTG</div>
              <p className="text-xs text-muted-foreground">0 ordonnances traitées</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Patients Inscrits</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Comptes actifs</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
      
      <div className="grid gap-4 md:grid-cols-2 p-6 pt-0">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Activités Récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente.</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Produits en Rupture</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStock === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tous les stocks sont normaux.</p>
            ) : (
              <p className="text-sm text-orange-500 text-center py-8">{stats.lowStock} produits nécessitent votre attention.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
