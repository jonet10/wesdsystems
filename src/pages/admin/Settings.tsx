import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Globe, Shield, CreditCard, Database, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/shared/LanguageSelector";

export default function SuperAdminSettingsPage() {
  const [siteName, setSiteName] = useState("Wesd Systems");
  const [supportEmail, setSupportEmail] = useState("support@wesdsystems.com");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [requireVerification, setRequireVerification] = useState(false);
  const [stripeLive, setStripeLive] = useState(false);
  const [stripePublicKey, setStripePublicKey] = useState("pk_test_51Nx...");
  const { t } = useTranslation();

  const handleSave = (section: string) => {
    toast.success(`Les paramètres de ${section} ont été sauvegardés avec succès !`);
  };

  return (
    <DashboardLayout
      role="super_admin"
      title="Paramètres Plateforme"
      subtitle="Configurez les options globales de Wesd Systems"
      userName="Admin Wesd Systems"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="general" className="flex items-center gap-2 rounded-lg py-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Général</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2 rounded-lg py-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Sécurité</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2 rounded-lg py-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Paiements</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2 rounded-lg py-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Système</span>
              </TabsTrigger>
            </TabsList>

            {/* GENERAL SETTINGS */}
            <TabsContent value="general" className="mt-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">Paramètres généraux</h3>
                  <p className="text-sm text-muted-foreground">Identité de marque et comportement de la plateforme</p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <p className="font-semibold text-sm">{t("settings.language.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("settings.language.subtitle")}</p>
                  </div>
                  <LanguageSelector compact />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="site-name">Nom du service</Label>
                    <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-email">Email de support</Label>
                    <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-base">Inscriptions ouvertes</Label>
                      <p className="text-sm text-muted-foreground">Autoriser de nouveaux salons à s'enregistrer en ligne</p>
                    </div>
                    <Switch checked={allowRegistration} onCheckedChange={setAllowRegistration} />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button variant="hero" onClick={() => handleSave("Général")}>
                    Enregistrer les modifications
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* SECURITY SETTINGS */}
            <TabsContent value="security" className="mt-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">Options de sécurité</h3>
                  <p className="text-sm text-muted-foreground">Politiques d'authentification et gestion des accès</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-base">Double facteur (2FA) obligatoire</Label>
                      <p className="text-sm text-muted-foreground">Forcer tous les comptes super admins et administrateurs de salons à activer le 2FA</p>
                    </div>
                    <Switch checked={requireVerification} onCheckedChange={setRequireVerification} />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <Label className="font-semibold text-base">Vérification de l'adresse email</Label>
                      <p className="text-sm text-muted-foreground">Exiger une confirmation par email lors de l'inscription d'un salon</p>
                    </div>
                    <Switch checked={requireVerification} onCheckedChange={setRequireVerification} />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button variant="hero" onClick={() => handleSave("Sécurité")}>
                    Sauvegarder la configuration
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* BILLING SETTINGS */}
            <TabsContent value="billing" className="mt-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">Passerelle Stripe</h3>
                  <p className="text-sm text-muted-foreground">Configurez vos clés API pour encaisser les abonnements</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <Label className="font-semibold text-base">Mode Production (Live)</Label>
                      <p className="text-sm text-muted-foreground">Passer de l'environnement test au mode de paiement réel</p>
                    </div>
                    <Switch checked={stripeLive} onCheckedChange={setStripeLive} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="stripe-pk">Clé Stripe Publique</Label>
                      <Input id="stripe-pk" value={stripePublicKey} onChange={(e) => setStripePublicKey(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripe-sk">Clé Stripe Secrète</Label>
                      <Input id="stripe-sk" type="password" value="••••••••••••••••••••••••" readOnly />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button variant="hero" onClick={() => handleSave("Paiements")}>
                    Sauvegarder les clés
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* SYSTEM SETTINGS */}
            <TabsContent value="system" className="mt-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">Maintenance & Sauvegarde</h3>
                  <p className="text-sm text-muted-foreground">Gérez l'état et les sauvegardes de la base de données</p>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <h4 className="font-semibold text-sm">Sauvegarde manuelle</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Téléchargez un instantané complet de toutes les données du système (JSON).</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toast.success("Sauvegarde générée et téléchargée avec succès !")}>
                      Télécharger SQL/JSON
                    </Button>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <div>
                      <Label className="font-semibold text-base">Mode maintenance global</Label>
                      <p className="text-sm text-muted-foreground">Mettre le site en maintenance et bloquer tout accès public aux tableaux de bord</p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
