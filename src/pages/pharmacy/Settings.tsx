import { useTranslation } from "react-i18next";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Printer, Shield, Bell } from "lucide-react";

export default function PharmacySettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Simulated settings state
  const [settings, setSettings] = useState({
    pharmacyName: "Ma Pharmacie",
    address: "123 Rue de la Santé",
    phone: "+509 12 34 56 78",
    taxRate: 10,
    enableFEFO: true,
    requirePrescriptionUpload: false,
    lowStockAlertThreshold: 15,
    autoPrintReceipt: true,
    receiptHeader: "MERCI DE VOTRE VISITE",
    receiptFooter: "Les médicaments ne sont ni repris ni échangés."
  });

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setLoading(true);
    // In a real app, this would save to a Supabase settings table linked to business_id
    setTimeout(() => {
      toast.success("Paramètres sauvegardés avec succès");
      setLoading(false);
    }, 800);
  };

  return (
    <DashboardLayout role="salon_admin" title="Paramètres Pharmacie" subtitle="Configuration de votre établissement">
      <div className="p-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-8">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="inventory">Inventaire</TabsTrigger>
            <TabsTrigger value="printing">Impression</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
          </TabsList>
          
          <StaggerContainer>
            {/* GENERAL TAB */}
            <TabsContent value="general">
              <StaggerItem>
                <Card>
                  <CardHeader>
                    <CardTitle>Informations Générales</CardTitle>
                    <CardDescription>Informations affichées sur vos documents officiels.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 max-w-xl">
                    <div className="space-y-2">
                      <Label>Nom de la Pharmacie</Label>
                      <Input value={settings.pharmacyName} onChange={e => handleChange("pharmacyName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse</Label>
                      <Input value={settings.address} onChange={e => handleChange("address", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("common.phone")}</Label>
                      <Input value={settings.phone} onChange={e => handleChange("phone", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Taux de Taxe (%)</Label>
                      <Input type="number" value={settings.taxRate} onChange={e => handleChange("taxRate", Number(e.target.value))} />
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </TabsContent>

            {/* INVENTORY TAB */}
            <TabsContent value="inventory">
              <StaggerItem>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5"/> Règles d'Inventaire</CardTitle>
                    <CardDescription>Configuration de la gestion des stocks et péremptions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 max-w-xl">
                    <div className="flex items-center justify-between border p-4 rounded-lg">
                      <div>
                        <Label className="text-base">Méthode FEFO (Strict)</Label>
                        <p className="text-sm text-muted-foreground">Obliger le système à toujours vendre le lot qui expire en premier.</p>
                      </div>
                      <Switch checked={settings.enableFEFO} onCheckedChange={v => handleChange("enableFEFO", v)} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Seuil d'alerte de stock global par défaut</Label>
                      <p className="text-xs text-muted-foreground mb-2">Sera appliqué si un produit n'a pas de seuil spécifique configuré.</p>
                      <Input type="number" value={settings.lowStockAlertThreshold} onChange={e => handleChange("lowStockAlertThreshold", Number(e.target.value))} />
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </TabsContent>

            {/* PRINTING TAB */}
            <TabsContent value="printing">
              <StaggerItem>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Printer className="w-5 h-5"/> Configuration d'Impression</CardTitle>
                    <CardDescription>Personnalisation des tickets de caisse POS.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 max-w-xl">
                    <div className="flex items-center justify-between border p-4 rounded-lg">
                      <div>
                        <Label className="text-base">Impression Automatique</Label>
                        <p className="text-sm text-muted-foreground">Imprimer le reçu automatiquement après chaque vente.</p>
                      </div>
                      <Switch checked={settings.autoPrintReceipt} onCheckedChange={v => handleChange("autoPrintReceipt", v)} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>En-tête du Ticket</Label>
                      <Input value={settings.receiptHeader} onChange={e => handleChange("receiptHeader", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pied de page (Mentions légales)</Label>
                      <Input value={settings.receiptFooter} onChange={e => handleChange("receiptFooter", e.target.value)} />
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </TabsContent>

            {/* SECURITY TAB */}
            <TabsContent value="security">
              <StaggerItem>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5"/> Réglementations</CardTitle>
                    <CardDescription>Contraintes de vente et conformité.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 max-w-xl">
                    <div className="flex items-center justify-between border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg">
                      <div>
                        <Label className="text-base text-red-700 dark:text-red-400">Scan d'Ordonnance Obligatoire</Label>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80">Exiger qu'un fichier soit téléversé pour valider l'enregistrement d'une ordonnance.</p>
                      </div>
                      <Switch checked={settings.requirePrescriptionUpload} onCheckedChange={v => handleChange("requirePrescriptionUpload", v)} />
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </TabsContent>
          </StaggerContainer>

          <div className="mt-8 flex justify-end max-w-2xl">
            <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Sauvegarde..." : "Sauvegarder les modifications"}
            </Button>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
