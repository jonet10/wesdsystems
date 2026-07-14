import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Send, Settings, ShieldAlert, AlertTriangle } from "lucide-react";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { whatsappService } from "@/modules/pharmacy/services/whatsappService";

export default function PharmacyWhatsappSettings() {
  const businessId = usePharmacyBusinessId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("openwa");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sessionName, setSessionName] = useState("default");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [largeSaleThreshold, setLargeSaleThreshold] = useState("10000");

  const [sendDailyReport, setSendDailyReport] = useState(true);
  const [sendWeeklyReport, setSendWeeklyReport] = useState(true);
  const [sendMonthlyReport, setSendMonthlyReport] = useState(true);
  const [sendLowStockAlerts, setSendLowStockAlerts] = useState(true);
  const [sendExpiryAlerts, setSendExpiryAlerts] = useState(true);
  const [sendSalesAlerts, setSendSalesAlerts] = useState(true);
  const [sendRegisterAlerts, setSendRegisterAlerts] = useState(true);
  const [sendVoidAlerts, setSendVoidAlerts] = useState(true);
  const [sendReturnAlerts, setSendReturnAlerts] = useState(true);

  useEffect(() => {
    if (businessId) {
      loadSettings();
    }
  }, [businessId]);

  const loadSettings = async () => {
    try {
      const data = await whatsappService.getSettings(businessId!);
      if (data) {
        setEnabled(data.enabled ?? false);
        setProvider(data.provider ?? "openwa");
        setApiUrl(data.api_url ?? "");
        setApiKey(data.api_key ?? "");
        setSessionName(data.session_name ?? "default");
        setOwnerPhone(data.owner_phone ?? "");
        setLargeSaleThreshold(String(data.large_sale_threshold ?? "10000"));
        setSendDailyReport(data.send_daily_report ?? true);
        setSendWeeklyReport(data.send_weekly_report ?? true);
        setSendMonthlyReport(data.send_monthly_report ?? true);
        setSendLowStockAlerts(data.send_low_stock_alerts ?? true);
        setSendExpiryAlerts(data.send_expiry_alerts ?? true);
        setSendSalesAlerts(data.send_sales_alerts ?? true);
        setSendRegisterAlerts(data.send_register_alerts ?? true);
        setSendVoidAlerts(data.send_void_alerts ?? true);
        setSendReturnAlerts(data.send_return_alerts ?? true);
      }
    } catch (e: any) {
      toast.error("Erreur lors de la récupération des paramètres : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      await whatsappService.saveSettings(businessId, {
        enabled,
        provider,
        api_url: apiUrl,
        api_key: apiKey,
        session_name: sessionName,
        owner_phone: ownerPhone,
        large_sale_threshold: Number(largeSaleThreshold || 0),
        send_daily_report: sendDailyReport,
        send_weekly_report: sendWeeklyReport,
        send_monthly_report: sendMonthlyReport,
        send_low_stock_alerts: sendLowStockAlerts,
        send_expiry_alerts: sendExpiryAlerts,
        send_sales_alerts: sendSalesAlerts,
        send_register_alerts: sendRegisterAlerts,
        send_void_alerts: sendVoidAlerts,
        send_return_alerts: sendReturnAlerts
      });
      toast.success("Paramètres WhatsApp sauvegardés avec succès !");
    } catch (e: any) {
      toast.error("Erreur de sauvegarde : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!ownerPhone) {
      toast.error("Veuillez d'abord renseigner le numéro de téléphone de test");
      return;
    }
    setTesting(true);
    try {
      const settings = {
        provider,
        api_url: apiUrl,
        api_key: apiKey,
        session_name: sessionName
      };
      const res = await whatsappService.sendTestMessage(businessId!, ownerPhone, settings);
      if (res.success) {
        toast.success("Message de test envoyé avec succès !");
      } else {
        toast.error("Échec de l'envoi du message : " + res.errorMessage);
      }
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Paramètres WhatsApp" subtitle="Configuration des alertes">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Chargement des paramètres...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Notifications WhatsApp" subtitle="Configuration des alertes et rapports automatisés">
      <StaggerContainer className="grid lg:grid-cols-3 gap-6 p-6">
        
        {/* CONFIGURATION GENERALE */}
        <StaggerItem className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border border-purple-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Configuration de la connexion API
              </CardTitle>
              <CardDescription>
                Définissez les clés d'accès et paramètres de votre passerelle d'envoi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-purple-50/50 dark:bg-purple-950/10 rounded-lg border border-purple-100 dark:border-purple-900/50">
                <div>
                  <Label className="font-bold text-sm">Activer les Notifications WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Active ou désactive globalement tous les envois automatiques</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Fournisseur de Service</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openwa">OpenWA (Conseillé)</SelectItem>
                      <SelectItem value="ultramsg">UltraMsg</SelectItem>
                      <SelectItem value="meta">Meta Cloud API</SelectItem>
                      <SelectItem value="twilio">Twilio API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Numéro du Destinataire (Propriétaire)</Label>
                  <Input 
                    placeholder="+50937012345" 
                    value={ownerPhone} 
                    onChange={e => setOwnerPhone(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>API URL de la Passerelle</Label>
                <Input 
                  placeholder={provider === "meta" ? "https://graph.facebook.com/v17.0/PHONE_NUMBER_ID/messages" : "https://api.example.com"} 
                  value={apiUrl} 
                  onChange={e => setApiUrl(e.target.value)} 
                />
              </div>

              <div className="space-y-1.5">
                <Label>Clé API ou Jeton d'Accès</Label>
                <Input 
                  type="password" 
                  placeholder="Bearer token or authorization key" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nom de Session / Expéditeur Twilio</Label>
                  <Input 
                    placeholder="default / whatsapp:+14155238886" 
                    value={sessionName} 
                    onChange={e => setSessionName(e.target.value)} 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Seuil de Grosse Vente (HTG)</Label>
                  <Input 
                    type="number" 
                    placeholder="10000" 
                    value={largeSaleThreshold} 
                    onChange={e => setLargeSaleThreshold(e.target.value)} 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t">
                <Button 
                  variant="outline" 
                  onClick={handleTestMessage} 
                  disabled={testing}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {testing ? "Envoi..." : "Envoyer un message de test"}
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="bg-primary hover:bg-primary/95 text-white gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* ACTIVATION INDIVIDUELLE DES ALERTES */}
        <StaggerItem className="space-y-6">
          <Card className="shadow-sm border border-purple-500/10 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Alertes & Rapports Actifs
              </CardTitle>
              <CardDescription>
                Cochez individuellement les événements à notifier.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Rapport Quotidien</Label>
                  <p className="text-[11px] text-muted-foreground">Envoyé tous les soirs à 20h00</p>
                </div>
                <Switch checked={sendDailyReport} onCheckedChange={setSendDailyReport} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Rapport Hebdomadaire</Label>
                  <p className="text-[11px] text-muted-foreground">Envoyé les dimanches à 20h00</p>
                </div>
                <Switch checked={sendWeeklyReport} onCheckedChange={setSendWeeklyReport} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Rapport Mensuel</Label>
                  <p className="text-[11px] text-muted-foreground">Envoyé le 1er de chaque mois</p>
                </div>
                <Switch checked={sendMonthlyReport} onCheckedChange={setSendMonthlyReport} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Alertes de Stock Faible</Label>
                  <p className="text-[11px] text-muted-foreground">Stock inférieur au seuil configuré</p>
                </div>
                <Switch checked={sendLowStockAlerts} onCheckedChange={setSendLowStockAlerts} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Alertes de Péremption</Label>
                  <p className="text-[11px] text-muted-foreground">Médicaments approchant de l'expiration</p>
                </div>
                <Switch checked={sendExpiryAlerts} onCheckedChange={setSendExpiryAlerts} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Alertes de Grandes Ventes</Label>
                  <p className="text-[11px] text-muted-foreground">Ventes supérieures au seuil spécifié</p>
                </div>
                <Switch checked={sendSalesAlerts} onCheckedChange={setSendSalesAlerts} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Ouvertures/Fermetures caisse</Label>
                  <p className="text-[11px] text-muted-foreground">Alertes sur les sessions de caisse</p>
                </div>
                <Switch checked={sendRegisterAlerts} onCheckedChange={setSendRegisterAlerts} />
              </div>

              <div className="flex items-center justify-between p-2 border-b pb-3">
                <div>
                  <Label className="font-semibold text-sm">Annulations de Ventes</Label>
                  <p className="text-[11px] text-muted-foreground">Factures annulées / supprimées</p>
                </div>
                <Switch checked={sendVoidAlerts} onCheckedChange={setSendVoidAlerts} />
              </div>

              <div className="flex items-center justify-between p-2 pb-3">
                <div>
                  <Label className="font-semibold text-sm">Retours Produits</Label>
                  <p className="text-[11px] text-muted-foreground">Remboursements et retours clients</p>
                </div>
                <Switch checked={sendReturnAlerts} onCheckedChange={setSendReturnAlerts} />
              </div>

            </CardContent>
          </Card>
        </StaggerItem>

      </StaggerContainer>
    </DashboardLayout>
  );
}
