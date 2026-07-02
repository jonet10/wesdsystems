import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Save, Globe, Smartphone, FileText, Hash,
  CreditCard, AlertCircle, Sparkles, MapPin, Package, CalendarDays, Lock, Unlock
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { useSubscriptionPaymentReminder } from "@/hooks/useSubscriptionPaymentReminder";
import { SubscriptionDashboard } from "@/components/subscription/SubscriptionDashboard";
import { SubscriptionPaymentCard } from "@/components/dashboard/SubscriptionPaymentCard";
import { useSchool } from "@/hooks/useSchool";
import { SchoolType } from "@/modules/school/engine/types";
import type { SchoolSetting } from "@/modules/school/types";

export default function SchoolSettingsPage() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const { availableCurrencies, setCurrency, currencyCode: activeCurrencyCode } = useCurrency();
  const subscriptionReminder = useSubscriptionPaymentReminder();
  
  const { engine, schoolType, refetchConfig } = useSchool();
  const [settingsTypeDialogOpen, setSettingsTypeDialogOpen] = useState(false);
  const [newSettingsType, setNewSettingsType] = useState<SchoolType>(schoolType);

  // Profile fields
  const [schoolName, setSchoolName]   = useState("");
  const [owner, setOwner]             = useState("");
  const [slogan, setSlogan]           = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [whatsapp, setWhatsapp]       = useState("");
  const [address, setAddress]         = useState("");
  const [nif, setNif]                 = useState("");
  const [website, setWebsite]         = useState("");
  const [logoUrl, setLogoUrl]         = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [printerWidth, setPrinterWidth] = useState("58");

  // Document fields
  const [invoicePrefix, setInvoicePrefix]   = useState("FACT-");
  const [receiptPrefix, setReceiptPrefix]   = useState("REC-");
  const [receiptHeader, setReceiptHeader]   = useState("");
  const [receiptFooter, setReceiptFooter]   = useState("");
  const [terms, setTerms]                   = useState("");

  // Stock
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  // SMS Gateway config & logs
  const [smsProvider, setSmsProvider] = useState<'Twilio' | 'Mock'>("Mock");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("");
  const [smsAttendanceAlert, setSmsAttendanceAlert] = useState(false);
  const [smsPaymentAlert, setSmsPaymentAlert] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  const [isSaving, setIsSaving]       = useState(false);
  const [businessId, setBusinessId]   = useState<string | null>(null);
  const [settingsId, setSettingsId]   = useState<string | null>(null);

  const handleUpdateType = async () => {
    if (!businessId) return;
    try {
      const { error } = await supabase
        .from("school_configurations")
        .update({ school_type: newSettingsType })
        .eq("business_id", businessId);
      if (error) throw error;
      toast.success("Type d'établissement mis à jour. Rechargement...");
      setSettingsTypeDialogOpen(false);
      await refetchConfig();
      window.location.reload();
    } catch (err: any) {
      toast.error("Impossible de modifier", { description: err.message });
    }
  };

  // Persist logo / name directly to businesses table (same as salon & auto-parts)
  const persistBusinessPatch = useCallback(
    async (patch: Partial<{ name: string; logo_url: string | null; currency_code: string }>) => {
      const targetId = profile?.business_id ?? businessId ?? user?.user_metadata?.business_id;
      if (!isAuthenticated || !user?.id || !targetId) return;
      const { error } = await supabase.from("businesses").update(patch).eq("id", targetId);
      if (error) throw new Error(error.message);
    },
    [businessId, isAuthenticated, profile?.business_id, user?.id]
  );

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated || !user?.id) return;
      try {
        // 1. Profile (owner name + business_id)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, business_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileData?.full_name) setOwner(profileData.full_name);
        const bizId = profileData?.business_id ?? profile?.business_id ?? user?.user_metadata?.business_id;
        if (!bizId) return;
        setBusinessId(bizId);

        // 2. Business name + logo
        const { data: bizData } = await supabase
          .from("businesses")
          .select("name, logo_url")
          .eq("id", bizId)
          .maybeSingle();
        if (bizData) {
          setSchoolName(bizData.name || "");
          setLogoUrl(bizData.logo_url || null);
        }

        // 3. School-specific settings
        const { data: settingsData, error: settingsErr } = await supabase
          .from("school_settings")
          .select("*")
          .eq("business_id", bizId)
          .maybeSingle();

        if (settingsErr) throw settingsErr;
        if (settingsData) {
          const s = settingsData as SchoolSetting;
          setSettingsId(s.id);
          setSlogan((s as any).slogan ?? "");
          setEmail(s.email || "");
          setPhone(s.phone || "");
          setWhatsapp((s as any).whatsapp ?? "");
          setAddress(s.address || "");
          setNif((s as any).nif ?? "");
          setWebsite(s.website || "");
          setInvoicePrefix(s.invoice_prefix || "FACT-");
          setReceiptPrefix(s.receipt_prefix || "REC-");
          setReceiptHeader((s as any).receipt_header ?? "");
          setReceiptFooter((s as any).receipt_footer ?? "");
          setTerms(s.terms || "");
          setLowStockThreshold((s as any).low_stock_threshold ?? 5);
          if (s.currency && s.currency !== activeCurrencyCode) {
            setCurrency(s.currency as any);
          }
        }

        // 4. SMS Settings
        const { data: smsData } = await supabase
          .from("school_sms_settings")
          .select("*")
          .eq("business_id", bizId)
          .maybeSingle();
        if (smsData) {
          setSmsProvider(smsData.provider);
          setSmsApiKey(smsData.api_key || "");
          setSmsSenderId(smsData.sender_id || "");
          setSmsAttendanceAlert(smsData.enable_attendance_alert);
          setSmsPaymentAlert(smsData.enable_payment_alert);
        }

        // 5. SMS Logs
        const { data: logData } = await supabase
          .from("school_sms_logs")
          .select("*")
          .eq("business_id", bizId)
          .order("created_at", { ascending: false });
        if (logData) {
          setSmsLogs(logData);
        }
      } catch (err) {
        console.error("Erreur chargement paramètres école:", err);
      }
    };
    load();
    setPrinterWidth(localStorage.getItem('wesd_pos_printer_width') || '58');
  }, [isAuthenticated, user?.id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user?.id || !businessId) {
      toast.error("Vous devez être connecté pour enregistrer.");
      return;
    }
    setIsSaving(true);
    try {
      // Update owner name in profiles
      await supabase.from("profiles").update({ full_name: owner.trim() }).eq("id", user.id);

      // Update business name + logo in businesses table
      await persistBusinessPatch({
        name: schoolName.trim(),
        logo_url: logoUrl,
        currency_code: activeCurrencyCode,
      });

      // Upsert school_settings
      const payload = {
        business_id: businessId,
        name: schoolName.trim(),
        slogan: slogan.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        address: address.trim() || null,
        nif: nif.trim() || null,
        website: website.trim() || null,
        logo_url: logoUrl,
        invoice_prefix: invoicePrefix.trim() || "FACT-",
        receipt_prefix: receiptPrefix.trim() || "REC-",
        receipt_header: receiptHeader.trim() || null,
        receipt_footer: receiptFooter.trim() || null,
        terms: terms.trim() || null,
        currency: activeCurrencyCode,
        low_stock_threshold: lowStockThreshold,
      };

      if (settingsId) {
        const { error } = await supabase.from("school_settings").update(payload).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("school_settings").insert([payload]).select().single();
        if (error) throw error;
        if (data) setSettingsId((data as any).id);
      }

      // Save SMS settings
      const { data: existingSms } = await supabase
        .from("school_sms_settings")
        .select("id")
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingSms) {
        await supabase
          .from("school_sms_settings")
          .update({
            provider: smsProvider,
            api_key: smsApiKey || null,
            sender_id: smsSenderId || null,
            enable_attendance_alert: smsAttendanceAlert,
            enable_payment_alert: smsPaymentAlert,
          })
          .eq("id", existingSms.id);
      } else {
        await supabase
          .from("school_sms_settings")
          .insert([{
            business_id: businessId,
            provider: smsProvider,
            api_key: smsApiKey || null,
            sender_id: smsSenderId || null,
            enable_attendance_alert: smsAttendanceAlert,
            enable_payment_alert: smsPaymentAlert,
          }]);
      }

      toast.success("Paramètres enregistrés avec succès.");
    } catch (error: any) {
      console.error(error);
      toast.error("Impossible d'enregistrer.", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Paramètres"
      subtitle="Configurez l'identité, les documents et les préférences de votre établissement"
      userName={owner || "Administrateur"}
    >
      <StaggerContainer>
        <form onSubmit={handleSaveSettings} className="max-w-4xl">

          {/* Subscription reminder banner */}
          {subscriptionReminder.shouldPrompt && (
            <StaggerItem>
              <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{subscriptionReminder.title}</p>
                        <p className="text-sm text-muted-foreground">{subscriptionReminder.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {subscriptionReminder.planName ? `${subscriptionReminder.planName} • ` : ""}
                          {subscriptionReminder.businessName}
                        </p>
                      </div>
                    </div>
                    <Button asChild disabled={!subscriptionReminder.paymentUrl}>
                      <Link to={subscriptionReminder.paymentUrl || "#"}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {subscriptionReminder.ctaLabel}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          )}

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="profile" className="gap-2">
                <Building2 className="h-4 w-4" /> Profil
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="h-4 w-4" /> Documents
              </TabsTrigger>
              <TabsTrigger value="stock" className="gap-2">
                <Package className="h-4 w-4" /> Stock
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-2">
                <Smartphone className="h-4 w-4" /> SMS Gateway
              </TabsTrigger>
              <TabsTrigger value="subscription" className="gap-2">
                <CalendarDays className="h-4 w-4" /> Abonnement
              </TabsTrigger>
            </TabsList>

            {/* ── PROFIL ── */}
            <TabsContent value="profile" className="space-y-6">
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Fiche de l'établissement</h3>
                      <p className="text-sm text-muted-foreground">Ces informations apparaissent sur vos documents et reçus</p>
                    </div>
                  </div>

                  {/* Logo */}
                  <div className="border-b border-border pb-6">
                    <Label className="mb-4 block">Logo de l'établissement</Label>
                    <ImageUploader
                      currentImageUrl={logoUrl}
                      onImageUploaded={(url) => {
                        setLogoUrl(url);
                        void persistBusinessPatch({ logo_url: url }).catch(() =>
                          toast.error("Logo téléversé, mais la sauvegarde automatique a échoué.")
                        );
                      }}
                      onImageDeleted={() => {
                        setLogoUrl(null);
                        void persistBusinessPatch({ logo_url: null }).catch(() =>
                          toast.error("Échec de la mise à jour du logo.")
                        );
                      }}
                      bucketName="logos"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="school-name">Nom de l'établissement *</Label>
                      <Input id="school-name" placeholder="Ex: École Nationale..." value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner">Directeur / Gérant *</Label>
                      <Input id="owner" placeholder="Ex: Jean Dupont" value={owner} onChange={(e) => setOwner(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slogan">Slogan</Label>
                      <Input id="slogan" placeholder="Ex: L'excellence au service de l'éducation" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email de contact</Label>
                      <Input id="email" type="email" placeholder="Ex: contact@ecole.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("common.phone")}</Label>
                      <Input id="phone" placeholder="Ex: +509 37 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">
                        <Smartphone className="h-3.5 w-3.5 inline mr-1" />
                        WhatsApp
                      </Label>
                      <Input id="whatsapp" placeholder="Ex: +509 37 00 00 00" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Adresse physique</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="address" placeholder="Ex: Delmas 75, Port-au-Prince" value={address} onChange={(e) => setAddress(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nif">
                        <Hash className="h-3.5 w-3.5 inline mr-1" />
                        NIF / Numéro fiscal (optionnel)
                      </Label>
                      <Input id="nif" placeholder="Ex: 001-234-567-8" value={nif} onChange={(e) => setNif(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">
                        <Globe className="h-3.5 w-3.5 inline mr-1" />
                        Site web
                      </Label>
                      <Input id="website" placeholder="Ex: https://ecole.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="currency">Devise</Label>
                      <select
                        id="currency"
                        value={activeCurrencyCode}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {availableCurrencies.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.symbol}) - {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* School Engine Type Configuration */}
                  <div className="border-t border-border pt-6 mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Type d'établissement</Label>
                        <p className="text-xs text-muted-foreground">
                          Configuration active : <span className="font-bold text-primary">{engine.getActivePlugin().name}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {profile?.role === "super_admin" ? (
                          <Dialog open={settingsTypeDialogOpen} onOpenChange={setSettingsTypeDialogOpen}>
                            <DialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm">Modifier (Super Admin)</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Changer le type d'établissement</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 pt-4">
                                <Label>Nouveau type</Label>
                                <select
                                  value={newSettingsType}
                                  onChange={(e) => setNewSettingsType(e.target.value as SchoolType)}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="CLASSIC">École Classique</option>
                                  <option value="VOCATIONAL">École Professionnelle</option>
                                  <option value="UNIVERSITY">Université</option>
                                </select>
                                <Button type="button" onClick={handleUpdateType} className="w-full mt-4">Confirmer le changement</Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-3">
                            <Lock className="h-3 w-3" /> Verrouillé
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

            {/* ── DOCUMENTS ── */}
            <TabsContent value="documents" className="space-y-6">
              {/* Préfixes */}
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Préfixes de documents</h3>
                      <p className="text-sm text-muted-foreground">Personnalisez les préfixes des documents générés</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Préfixe Factures</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="FACT-" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Préfixe Reçus</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value)} placeholder="REC-" />
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* Personnalisation des reçus */}
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Personnalisation des reçus</h3>
                      <p className="text-sm text-muted-foreground">Texte affiché sur les tickets de caisse et reçus</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Entête du ticket</Label>
                      <Textarea
                        value={receiptHeader}
                        onChange={(e) => setReceiptHeader(e.target.value)}
                        placeholder="Ex: Merci de votre confiance !"
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pied de ticket</Label>
                      <Textarea
                        value={receiptFooter}
                        onChange={(e) => setReceiptFooter(e.target.value)}
                        placeholder="Ex: Document généré électroniquement"
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Termes et conditions (Factures)</Label>
                      <Textarea
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        placeholder="Ex: Les frais de scolarité sont payables d'avance. Aucun remboursement après 30 jours."
                        className="min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              </StaggerItem>

              <StaggerItem>
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card mt-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold font-display">Configuration du POS / Imprimante</h3>
                        <p className="text-sm text-muted-foreground">Configurez le matériel d'impression connecté à votre caisse</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Largeur du papier</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "58", label: "58 mm (Thermique Compact)" },
                          { id: "80", label: "80 mm (Thermique Large)" },
                          { id: "A4", label: "A4 (Facture Standard)" },
                          { id: "custom", label: "Personnalisée (Futur)" },
                        ].map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            disabled={w.id === "custom"}
                            onClick={() => {
                              setPrinterWidth(w.id);
                              localStorage.setItem('wesd_pos_printer_width', w.id);
                              toast.success(`Format d'impression mis à jour : ${w.label}`);
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                              printerWidth === w.id
                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                : w.id === "custom"
                                ? "opacity-50 cursor-not-allowed border-border bg-muted/20"
                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <span className="text-sm font-bold">{w.id.toUpperCase()}</span>
                            <span className="text-[10px] text-muted-foreground mt-1">{w.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
            </TabsContent>

            {/* ── STOCK ── */}
            <TabsContent value="stock" className="space-y-6">
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Seuil d'alerte stock</h3>
                      <p className="text-sm text-muted-foreground">Configurez quand déclencher une alerte de stock faible</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="low-stock">Seuil minimum</Label>
                    <Input
                      id="low-stock"
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Une alerte sera générée quand le stock d'une fourniture passe en dessous de ce seuil.
                    </p>
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

            {/* ── ABONNEMENT ── */}
            <TabsContent value="subscription" className="space-y-6">
              <SubscriptionPaymentCard />
              <SubscriptionDashboard />
            </TabsContent>

            {/* ── SMS GATEWAY ── */}
            <TabsContent value="sms" className="space-y-6">
              <StaggerItem>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* SMS Config Form */}
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold font-display">Passerelle SMS</h3>
                        <p className="text-sm text-muted-foreground">Configurez votre fournisseur d'envoi de messages</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Fournisseur</Label>
                      <select
                        value={smsProvider}
                        onChange={e => setSmsProvider(e.target.value as any)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                      >
                        <option value="Mock">Simulateur Local (Gratuit / Test)</option>
                        <option value="Twilio">Twilio Gateway (Production)</option>
                      </select>
                    </div>

                    {smsProvider === "Twilio" && (
                      <>
                        <div className="space-y-1.5">
                          <Label>Twilio Account SID / API Key</Label>
                          <Input
                            type="password"
                            placeholder="Entrez votre Account SID"
                            value={smsApiKey}
                            onChange={e => setSmsApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Twilio Sender ID / N° expéditeur</Label>
                          <Input
                            placeholder="Ex: +1234567890"
                            value={smsSenderId}
                            onChange={e => setSmsSenderId(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-4 pt-2 border-t">
                      <h4 className="font-semibold text-sm">Alertes automatisées</h4>
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Notifications d'absences</Label>
                          <p className="text-xs text-muted-foreground">Envoyer un SMS automatique aux parents lorsqu'un élève est marqué absent.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={smsAttendanceAlert}
                          onChange={e => setSmsAttendanceAlert(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Notifications financières</Label>
                          <p className="text-xs text-muted-foreground">Envoyer un SMS automatique aux parents pour les factures émises et les reçus de paiement.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={smsPaymentAlert}
                          onChange={e => setSmsPaymentAlert(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SMS logs */}
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4 flex flex-col h-[400px]">
                    <div className="flex items-center justify-between border-b pb-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Journal des SMS Envoyés ({smsLogs.length})</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {smsLogs.length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-10">Aucun SMS envoyé pour le moment.</p>
                      ) : smsLogs.map((log, index) => (
                        <div key={index} className="p-3 rounded-lg border text-xs space-y-1 hover:bg-muted/10 transition-all">
                          <div className="flex justify-between font-semibold text-muted-foreground">
                            <span>Destinataire : {log.recipient}</span>
                            <span className={log.status === 'sent' ? 'text-green-600' : 'text-destructive'}>
                              {log.status === 'sent' ? '✓ Envoyé' : '✗ Échec'}
                            </span>
                          </div>
                          <p className="text-foreground">{log.message}</p>
                          <p className="text-[10px] text-muted-foreground text-right">{new Date(log.created_at).toLocaleString("fr-FR")}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </StaggerItem>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-6">
            <Button type="submit" variant="hero" disabled={isSaving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </form>
      </StaggerContainer>
    </DashboardLayout>
  );
}
