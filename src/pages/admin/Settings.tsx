import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Globe, Shield, CreditCard, Database, Check, Copy, Smartphone, Building2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/shared/LanguageSelector";
import { MONCASH_PUBLIC_URLS } from "@/lib/moncash";
import { supabase } from "@/lib/supabase";

export default function SuperAdminSettingsPage() {
  const [siteName, setSiteName] = useState("Wesd Systems");
  const [supportEmail, setSupportEmail] = useState("support@wesdsystems.com");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [requireVerification, setRequireVerification] = useState(false);
  const [stripeLive, setStripeLive] = useState(false);
  const [stripePublicKey, setStripePublicKey] = useState("pk_test_51Nx...");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [manualPaymentMoncashName, setManualPaymentMoncashName] = useState("Jonet Jean Francois");
  const [manualPaymentMoncashNumber, setManualPaymentMoncashNumber] = useState("38073835");
  const [manualPaymentNatcashName, setManualPaymentNatcashName] = useState("Jonet Jean Francois");
  const [manualPaymentNatcashNumber, setManualPaymentNatcashNumber] = useState("40011619");

  // Global WhatsApp Settings states
  const [whatsappGlobalEnabled, setWhatsappGlobalEnabled] = useState(true);
  const [whatsappGlobalProvider, setWhatsappGlobalProvider] = useState("openwa");
  const [whatsappGlobalApiUrl, setWhatsappGlobalApiUrl] = useState("");
  const [whatsappGlobalApiKey, setWhatsappGlobalApiKey] = useState("");
  const [whatsappGlobalSessionName, setWhatsappGlobalSessionName] = useState("default");

  // Local WhatsApp Gateway states
  const [localGwStatus, setLocalGwStatus] = useState<string>("OFFLINE");
  const [localGwQr, setLocalGwQr] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState<string>("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRequestingPairing, setIsRequestingPairing] = useState<boolean>(false);

  useEffect(() => {
    const loadConfig = async () => {
      const { data, error } = await supabase.from("app_config").select("key, value");
      if (error || !data) return;
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.manual_payment_moncash_name) setManualPaymentMoncashName(map.manual_payment_moncash_name);
      if (map.manual_payment_moncash_number) setManualPaymentMoncashNumber(map.manual_payment_moncash_number);
      if (map.manual_payment_natcash_name) setManualPaymentNatcashName(map.manual_payment_natcash_name);
      if (map.manual_payment_natcash_number) setManualPaymentNatcashNumber(map.manual_payment_natcash_number);

      // Load WhatsApp global configurations
      if (map.whatsapp_global_enabled) setWhatsappGlobalEnabled(map.whatsapp_global_enabled === "true");
      if (map.whatsapp_global_provider) setWhatsappGlobalProvider(map.whatsapp_global_provider);
      if (map.whatsapp_global_api_url) setWhatsappGlobalApiUrl(map.whatsapp_global_api_url);
      if (map.whatsapp_global_api_key) setWhatsappGlobalApiKey(map.whatsapp_global_api_key);
      if (map.whatsapp_global_session_name) setWhatsappGlobalSessionName(map.whatsapp_global_session_name);
    };
    void loadConfig();
  }, []);

  const checkLocalGatewayStatus = useCallback(async () => {
    // Determine the base url to query. Fallback to localhost if empty
    const baseUrl = whatsappGlobalApiUrl ? whatsappGlobalApiUrl.replace(/\/$/, "") : "http://localhost:3000";
    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) {
        const data = await response.json();
        setLocalGwStatus(data.state);
        setLocalGwQr(data.qr);
      } else {
        setLocalGwStatus("OFFLINE");
      }
    } catch (err) {
      setLocalGwStatus("OFFLINE");
    }
  }, [whatsappGlobalApiUrl]);

  useEffect(() => {
    let interval: any;
    if (whatsappGlobalProvider === "openwa") {
      checkLocalGatewayStatus();
      interval = setInterval(checkLocalGatewayStatus, 5000);
    } else {
      setLocalGwStatus("OFFLINE");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [whatsappGlobalProvider, whatsappGlobalApiUrl, checkLocalGatewayStatus]);

  const handleRequestPairingCode = async () => {
    if (!pairingPhone) {
      toast.error("Veuillez saisir un numéro de téléphone.");
      return;
    }
    setIsRequestingPairing(true);
    setPairingCode(null);
    const baseUrl = whatsappGlobalApiUrl ? whatsappGlobalApiUrl.replace(/\/$/, "") : "http://localhost:3000";
    try {
      const response = await fetch(`${baseUrl}/request-pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pairingPhone })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.code) {
          setPairingCode(data.code);
          toast.success("Code d'association généré ! Entrez-le sur votre téléphone.");
        } else {
          toast.error("Impossible de générer le code d'association.");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erreur de connexion avec le serveur local.");
      }
    } catch (err: any) {
      toast.error("Impossible de joindre le serveur local.");
    } finally {
      setIsRequestingPairing(false);
    }
  };

  const { t } = useTranslation();

  const handleSave = (section: string) => {
    toast.success(`Les paramètres de ${section} ont été sauvegardés avec succès !`);
  };

  const saveManualPaymentConfig = async () => {
    const entries = [
      { key: "manual_payment_moncash_name", value: manualPaymentMoncashName },
      { key: "manual_payment_moncash_number", value: manualPaymentMoncashNumber },
      { key: "manual_payment_natcash_name", value: manualPaymentNatcashName },
      { key: "manual_payment_natcash_number", value: manualPaymentNatcashNumber },
    ];
    const { error } = await supabase.from("app_config").upsert(entries, { onConflict: "key" });
    if (error) {
      toast.error("Erreur lors de la sauvegarde des paramètres de paiement manuel.");
    } else {
      toast.success("Paramètres de paiement manuel sauvegardés avec succès !");
    }
  };

  const saveWhatsappConfig = async () => {
    const entries = [
      { key: "whatsapp_global_enabled", value: String(whatsappGlobalEnabled) },
      { key: "whatsapp_global_provider", value: whatsappGlobalProvider },
      { key: "whatsapp_global_api_url", value: whatsappGlobalApiUrl },
      { key: "whatsapp_global_api_key", value: whatsappGlobalApiKey },
      { key: "whatsapp_global_session_name", value: whatsappGlobalSessionName },
    ];
    const { error } = await supabase.from("app_config").upsert(entries, { onConflict: "key" });
    if (error) {
      toast.error("Erreur lors de la sauvegarde de la configuration WhatsApp.");
    } else {
      toast.success("Configuration WhatsApp globale mise à jour !");
    }
  };

  const copyUrl = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedUrl(label);
      toast.success(`${label} copié.`);
      window.setTimeout(() => setCopiedUrl((current) => (current === label ? null : current)), 1500);
    } catch {
      toast.error(`Impossible de copier ${label.toLowerCase()}.`);
    }
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
            <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full max-w-3xl bg-muted/50 p-1 rounded-xl">
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
              <TabsTrigger value="manual-payments" className="flex items-center gap-2 rounded-lg py-2">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">Manuel</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2 rounded-lg py-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
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

                <div className="pt-6 border-t border-border space-y-4">
                  <div>
                    <h4 className="text-base font-semibold font-display">Configuration MonCash</h4>
                    <p className="text-sm text-muted-foreground">
                      URLs à fournir à MonCash pour connecter les notifications et la page de confirmation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="moncash-website">Website Url</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => copyUrl(MONCASH_PUBLIC_URLS.websiteUrl, "Website Url")}
                        >
                          {copiedUrl === "Website Url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedUrl === "Website Url" ? "Copié" : "Copier"}
                        </Button>
                      </div>
                      <Input id="moncash-website" value={MONCASH_PUBLIC_URLS.websiteUrl} readOnly />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="moncash-return">Return Url</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => copyUrl(MONCASH_PUBLIC_URLS.returnUrl, "Return Url")}
                        >
                          {copiedUrl === "Return Url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedUrl === "Return Url" ? "Copié" : "Copier"}
                        </Button>
                      </div>
                      <Input id="moncash-return" value={MONCASH_PUBLIC_URLS.returnUrl} readOnly />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="moncash-alert">Alert Url</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => copyUrl(MONCASH_PUBLIC_URLS.alertUrl, "Alert Url")}
                        >
                          {copiedUrl === "Alert Url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedUrl === "Alert Url" ? "Copié" : "Copier"}
                        </Button>
                      </div>
                      <Input id="moncash-alert" value={MONCASH_PUBLIC_URLS.alertUrl} readOnly />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* MANUAL PAYMENTS SETTINGS */}
            <TabsContent value="manual-payments" className="mt-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">Paiement manuel</h3>
                  <p className="text-sm text-muted-foreground">
                    Numéros et noms des bénéficiaires affichés aux salons lors du paiement manuel
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/10">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      MonCash
                    </h4>
                    <div className="space-y-2">
                      <Label htmlFor="moncash-name">Nom du bénéficiaire</Label>
                      <Input
                        id="moncash-name"
                        value={manualPaymentMoncashName}
                        onChange={(e) => setManualPaymentMoncashName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="moncash-number">Numéro de téléphone</Label>
                      <Input
                        id="moncash-number"
                        value={manualPaymentMoncashNumber}
                        onChange={(e) => setManualPaymentMoncashNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/10">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      NatCash
                    </h4>
                    <div className="space-y-2">
                      <Label htmlFor="natcash-name">Nom du bénéficiaire</Label>
                      <Input
                        id="natcash-name"
                        value={manualPaymentNatcashName}
                        onChange={(e) => setManualPaymentNatcashName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="natcash-number">Numéro de téléphone</Label>
                      <Input
                        id="natcash-number"
                        value={manualPaymentNatcashNumber}
                        onChange={(e) => setManualPaymentNatcashNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button variant="hero" onClick={saveManualPaymentConfig}>
                    Sauvegarder les bénéficiaires
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* GLOBAL WHATSAPP SETTINGS */}
            <TabsContent value="whatsapp" className="mt-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">Passerelle WhatsApp Globale</h3>
                  <p className="text-sm text-muted-foreground font-sans">
                    Configurez la connexion WhatsApp globale partagée par l'ensemble des modules (Pharmacie, École, etc.).
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                  <div>
                    <Label className="font-semibold text-base">Activer WhatsApp à l'échelle de la plateforme</Label>
                    <p className="text-sm text-muted-foreground font-sans">Permet l'envoi automatique de notifications pour tous les établissements abonnés.</p>
                  </div>
                  <Switch checked={whatsappGlobalEnabled} onCheckedChange={setWhatsappGlobalEnabled} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="wa-provider">Fournisseur de service</Label>
                    <select
                      id="wa-provider"
                      value={whatsappGlobalProvider}
                      onChange={(e) => setWhatsappGlobalProvider(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="openwa">OpenWA (Conseillé)</option>
                      <option value="ultramsg">UltraMsg</option>
                      <option value="meta">Meta Cloud API</option>
                      <option value="twilio">Twilio API</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wa-session">Nom de Session / Expéditeur Twilio</Label>
                    <Input
                      id="wa-session"
                      placeholder="default / whatsapp:+14155238886"
                      value={whatsappGlobalSessionName}
                      onChange={(e) => setWhatsappGlobalSessionName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-url">API URL de la Passerelle</Label>
                  <Input
                    id="wa-url"
                    placeholder={whatsappGlobalProvider === "meta" ? "https://graph.facebook.com/v17.0/PHONE_NUMBER_ID/messages" : "https://api.example.com"}
                    value={whatsappGlobalApiUrl}
                    onChange={(e) => setWhatsappGlobalApiUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-key">Clé d'API ou Jeton d'Accès</Label>
                  <Input
                    id="wa-key"
                    type="password"
                    placeholder="Bearer token or authorization key"
                    value={whatsappGlobalApiKey}
                    onChange={(e) => setWhatsappGlobalApiKey(e.target.value)}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button variant="hero" onClick={saveWhatsappConfig}>
                    Sauvegarder la configuration WhatsApp
                  </Button>
                </div>

                {/* LOCAL GATEWAY STATUS & PAIRING UI */}
                {whatsappGlobalProvider === "openwa" && (
                  <div className="mt-8 border-t border-border pt-6 space-y-6">
                    <div>
                      <h4 className="text-base font-semibold font-display">Statut de la Passerelle Locale (OpenWA)</h4>
                      <p className="text-sm text-muted-foreground font-sans">
                        Statut en temps réel de votre serveur de messagerie local (port 3000).
                      </p>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
                      <div className={`w-3 h-3 rounded-full ${
                        localGwStatus === "CONNECTED" ? "bg-emerald-500 animate-pulse" :
                        localGwStatus === "INITIALIZING" ? "bg-amber-500 animate-pulse" :
                        localGwStatus === "DISCONNECTED" ? "bg-red-500 animate-pulse" : "bg-zinc-500"
                      }`} />
                      <div>
                        <p className="font-semibold text-sm">
                          {localGwStatus === "CONNECTED" && "Connecté (Prêt)"}
                          {localGwStatus === "INITIALIZING" && "Initialisation..."}
                          {localGwStatus === "DISCONNECTED" && "En attente de connexion"}
                          {localGwStatus === "OFFLINE" && "Serveur Hors-ligne (Lancer npm run dev)"}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans">
                          {localGwStatus === "OFFLINE" ? "Assurez-vous que le serveur local tourne sur le port 3000." : `Passerelle active sur ${whatsappGlobalApiUrl || "http://localhost:3000"}`}
                        </p>
                      </div>
                    </div>

                    {localGwStatus === "DISCONNECTED" && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-muted/10 p-6 rounded-xl border border-border">
                        {/* QR CODE VIEW */}
                        <div className="flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border pb-6 lg:pb-0 lg:pr-6 space-y-4">
                          <p className="font-medium text-sm text-center">Option 1 : Scannez le QR Code officiel</p>
                          {localGwQr ? (
                            <img src={localGwQr} alt="WhatsApp QR Code" className="border border-border rounded-xl p-2 bg-white" style={{ width: 220 }} />
                          ) : (
                            <div className="w-[220px] h-[220px] bg-muted flex items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground text-center p-4">
                              Génération du QR Code en cours...
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                            Ouvrez WhatsApp sur votre mobile > Appareils connectés > Connecter un appareil, puis scannez ce code.
                          </p>
                        </div>

                        {/* PAIRING CODE VIEW */}
                        <div className="flex flex-col justify-center space-y-4">
                          <p className="font-medium text-sm text-center lg:text-left">Option 2 : Associer par numéro de téléphone</p>
                          <p className="text-xs text-muted-foreground">
                            Entrez votre numéro au format international (sans le + devant) pour recevoir un code à 8 chiffres.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="ex: 50938073835"
                              value={pairingPhone}
                              onChange={(e) => setPairingPhone(e.target.value)}
                              disabled={isRequestingPairing}
                            />
                            <Button
                              variant="outline"
                              onClick={handleRequestPairingCode}
                              disabled={isRequestingPairing}
                            >
                              {isRequestingPairing ? "Génération..." : "Obtenir le code"}
                            </Button>
                          </div>

                          {pairingCode && (
                            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center space-y-2">
                              <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider">Code d'association</p>
                              <p className="text-2xl font-bold font-mono tracking-widest text-emerald-500">{pairingCode}</p>
                              <p className="text-[11px] text-muted-foreground font-sans">
                                Ouvrez WhatsApp > Appareils connectés > Connecter > Se connecter plutôt par numéro, et tapez ce code.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
