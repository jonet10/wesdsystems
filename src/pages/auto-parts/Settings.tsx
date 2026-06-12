import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { toast } from "sonner";
import { getBusinessSettings, upsertBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import type { AutoPartsBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AutoPartsSettingsPage() {
  const businessId = useAutoPartsBusinessId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AutoPartsBusinessSettings>({
    business_id: "",
    company_name: "",
    invoice_prefix: "INV-",
    quote_prefix: "DEV-",
    delivery_note_prefix: "BL-",
    low_stock_threshold: 5,
  });

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const existing = await getBusinessSettings(businessId);
        if (existing) setSettings(existing);
      } catch { } finally { setLoading(false); }
    })();
  }, [businessId]);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      await upsertBusinessSettings(businessId, settings);
      toast.success("Paramètres sauvegardés");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const update = <K extends keyof AutoPartsBusinessSettings>(k: K, v: AutoPartsBusinessSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  if (!businessId) {
    return (
      <DashboardLayout role="salon_admin" title="Paramètres" subtitle="Configuration du module auto-parts">
        <p className="text-muted-foreground p-8">
          Connectez-vous avec un établissement pour configurer les paramètres.
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Paramètres" subtitle="Configuration du module auto-parts">
      <StaggerContainer>
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Établissement</TabsTrigger>
            <TabsTrigger value="legal">Légal</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <StaggerItem>
              <Card>
                <CardHeader><CardTitle className="text-base">Informations de l'établissement</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Nom de l'établissement</Label>
                      <Input value={settings.company_name} onChange={(e) => update("company_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input value={settings.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={settings.email ?? ""} onChange={(e) => update("email", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Label>Adresse</Label>
                      <Textarea value={settings.address ?? ""} onChange={(e) => update("address", e.target.value)} />
                    </div>
                    <div>
                      <Label>Site web</Label>
                      <Input value={settings.website ?? ""} onChange={(e) => update("website", e.target.value)} />
                    </div>
                    <div>
                      <Label>URL du logo</Label>
                      <Input value={settings.logo_url ?? ""} onChange={(e) => update("logo_url", e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </TabsContent>

          <TabsContent value="legal">
            <StaggerItem>
              <Card>
                <CardHeader><CardTitle className="text-base">Identifiants légaux</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>NIF (Numéro d'Identification Fiscale)</Label>
                      <Input value={settings.nif ?? ""} onChange={(e) => update("nif", e.target.value)} />
                    </div>
                    <div>
                      <Label>Patente</Label>
                      <Input value={settings.patente ?? ""} onChange={(e) => update("patente", e.target.value)} />
                    </div>
                    <div>
                      <Label>RC (Registre de Commerce)</Label>
                      <Input value={settings.rc ?? ""} onChange={(e) => update("rc", e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Coordonnées bancaires</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Banque</Label>
                      <Input value={settings.bank_name ?? ""} onChange={(e) => update("bank_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>Compte bancaire</Label>
                      <Input value={settings.bank_account ?? ""} onChange={(e) => update("bank_account", e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </TabsContent>

          <TabsContent value="documents">
            <StaggerItem>
              <Card>
                <CardHeader><CardTitle className="text-base">Préfixes de documents</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Facture</Label>
                      <Input value={settings.invoice_prefix} onChange={(e) => update("invoice_prefix", e.target.value)} />
                    </div>
                    <div>
                      <Label>Devis</Label>
                      <Input value={settings.quote_prefix} onChange={(e) => update("quote_prefix", e.target.value)} />
                    </div>
                    <div>
                      <Label>Bon de livraison</Label>
                      <Input value={settings.delivery_note_prefix} onChange={(e) => update("delivery_note_prefix", e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Personnalisation des reçus / tickets</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Entête du ticket</Label>
                    <Textarea value={settings.receipt_header ?? ""} onChange={(e) => update("receipt_header", e.target.value)} placeholder="Ex: Merci de votre visite !" />
                  </div>
                  <div>
                    <Label>Pied de ticket</Label>
                    <Textarea value={settings.receipt_footer ?? ""} onChange={(e) => update("receipt_footer", e.target.value)} placeholder="Ex: Document généré électroniquement" />
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </TabsContent>

          <TabsContent value="stock">
            <StaggerItem>
              <Card>
                <CardHeader><CardTitle className="text-base">Seuil d'alerte stock</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Seuil minimum</Label>
                    <Input
                      type="number" min="0"
                      value={settings.low_stock_threshold}
                      onChange={(e) => update("low_stock_threshold", Number(e.target.value))}
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Une alerte sera générée quand le stock passe en dessous de ce seuil.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </TabsContent>
        </Tabs>

        <StaggerItem>
          <div className="flex justify-end mt-6">
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Sauvegarde..." : "Sauvegarder tous les paramètres"}
            </Button>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
