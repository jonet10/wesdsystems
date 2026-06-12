import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Save, FileText, Package, CalendarDays, Globe, MapPin, Smartphone, Hash, CreditCard, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { useSubscriptionPaymentReminder } from "@/hooks/useSubscriptionPaymentReminder";
import { SubscriptionDashboard } from "@/components/subscription/SubscriptionDashboard";
import { SubscriptionPaymentCard } from "@/components/dashboard/SubscriptionPaymentCard";
import { getBusinessSettings, upsertBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import type { AutoPartsBusinessSettings } from "@/modules/auto-parts/services/businessSettings";

export default function AutoPartsSettingsPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const { availableCurrencies, setCurrency, currencyCode: activeCurrencyCode } = useCurrency();
  const subscriptionReminder = useSubscriptionPaymentReminder();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [nif, setNif] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [quotePrefix, setQuotePrefix] = useState("DEV-");
  const [deliveryNotePrefix, setDeliveryNotePrefix] = useState("BL-");
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const persistBusinessPatch = useCallback(
    async (patch: Partial<{ name: string; logo_url: string | null; currency_code: string }>) => {
      const targetBusinessId = profile?.business_id ?? businessId;
      if (!isAuthenticated || !user?.id || !targetBusinessId) return;
      const { error } = await supabase.from("businesses").update(patch).eq("id", targetBusinessId);
      if (error) throw new Error(error.message);
    },
    [businessId, isAuthenticated, profile?.business_id, user?.id]
  );

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated || !user?.id) return;
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, business_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profileData?.full_name) setOwner(profileData.full_name);
        if (!profileData?.business_id) { setLoading(false); return; }

        const bizId = profileData.business_id;
        setBusinessId(bizId);

        const { data: bizData } = await supabase
          .from("businesses")
          .select("name, logo_url")
          .eq("id", bizId)
          .maybeSingle();
        if (bizData) {
          setCompanyName(bizData.name || "");
          setLogoUrl(bizData.logo_url || null);
        }

        const existing = await getBusinessSettings(bizId);
        if (existing) {
          setSlogan(existing.slogan ?? "");
          setEmail(existing.email ?? "");
          setPhone(existing.phone ?? "");
          setWhatsapp(existing.whatsapp ?? "");
          setAddress(existing.address ?? "");
          setNif(existing.nif ?? "");
          setWebsite(existing.website ?? "");
          setInvoicePrefix(existing.invoice_prefix);
          setQuotePrefix(existing.quote_prefix);
          setDeliveryNotePrefix(existing.delivery_note_prefix);
          setReceiptHeader(existing.receipt_header ?? "");
          setReceiptFooter(existing.receipt_footer ?? "");
          setLowStockThreshold(existing.low_stock_threshold);
        }
      } catch { } finally { setLoading(false); }
    };
    load();
  }, [isAuthenticated, user?.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      if (profile?.business_id) {
        await persistBusinessPatch({
          name: companyName.trim(),
          logo_url: logoUrl,
          currency_code: activeCurrencyCode,
        });
      }

      if (profile?.full_name !== owner.trim()) {
        await supabase.from("profiles").update({ full_name: owner.trim() }).eq("id", user!.id);
      }

      await upsertBusinessSettings(businessId, {
        company_name: companyName,
        logo_url: logoUrl,
        address: address || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        slogan: slogan || null,
        whatsapp: whatsapp || null,
        nif: nif || null,
        patente: null,
        rc: null,
        bank_name: null,
        bank_account: null,
        invoice_prefix: invoicePrefix,
        quote_prefix: quotePrefix,
        delivery_note_prefix: deliveryNotePrefix,
        receipt_footer: receiptFooter || null,
        receipt_header: receiptHeader || null,
        low_stock_threshold: lowStockThreshold,
      });

      toast.success("Paramètres enregistrés");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Paramètres"
      subtitle="Configurez votre établissement pour le module auto-parts"
    >
      <StaggerContainer>
        <form onSubmit={save} className="max-w-4xl">
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
              <TabsTrigger value="subscription" className="gap-2">
                <CalendarDays className="h-4 w-4" /> Abonnement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Fiche de l'établissement</h3>
                      <p className="text-sm text-muted-foreground">Informations utilisées sur les documents et reçus</p>
                    </div>
                  </div>

                  <div className="border-b border-border pb-6">
                    <Label className="mb-4 block">Logo de l'entreprise</Label>
                    <ImageUploader
                      currentImageUrl={logoUrl}
                      onImageUploaded={(url) => {
                        setLogoUrl(url);
                        void persistBusinessPatch({ logo_url: url }).catch(() => {
                          toast.error("Logo téléversé, mais la sauvegarde a échoué.");
                        });
                      }}
                      onImageDeleted={() => {
                        setLogoUrl(null);
                        void persistBusinessPatch({ logo_url: null }).catch(() => {
                          toast.error("Échec de la mise à jour du logo.");
                        });
                      }}
                      bucketName="logos"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Nom de l'établissement *</Label>
                      <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner">Propriétaire / Gérant</Label>
                      <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slogan">Slogan</Label>
                      <Input id="slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Ex: L'excellence à votre service" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email de contact</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">
                        <Smartphone className="h-3.5 w-3.5 inline mr-1" />
                        WhatsApp
                      </Label>
                      <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Adresse physique</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nif">
                        <Hash className="h-3.5 w-3.5 inline mr-1" />
                        NIF
                      </Label>
                      <Input id="nif" value={nif} onChange={(e) => setNif(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">
                        <Globe className="h-3.5 w-3.5 inline mr-1" />
                        Site web
                      </Label>
                      <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="currency">Devise</Label>
                      <select
                        id="currency"
                        value={activeCurrencyCode}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {availableCurrencies.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.symbol}) - {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Facture</Label>
                      <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Devis</Label>
                      <Input value={quotePrefix} onChange={(e) => setQuotePrefix(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bon de livraison</Label>
                      <Input value={deliveryNotePrefix} onChange={(e) => setDeliveryNotePrefix(e.target.value)} />
                    </div>
                  </div>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Personnalisation des reçus</h3>
                      <p className="text-sm text-muted-foreground">Texte affiché sur les tickets de caisse</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Entête du ticket</Label>
                      <Textarea value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} placeholder="Ex: Merci de votre visite !" />
                    </div>
                    <div className="space-y-2">
                      <Label>Pied de ticket</Label>
                      <Textarea value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} placeholder="Ex: Document généré électroniquement" />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

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
                    <Label>Seuil minimum</Label>
                    <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Number(e.target.value))} />
                    <p className="text-xs text-muted-foreground">Une alerte sera générée quand le stock passe en dessous de ce seuil.</p>
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

            <TabsContent value="subscription" className="space-y-6">
              <SubscriptionPaymentCard />
              <SubscriptionDashboard />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-6">
            <Button type="submit" variant="hero" disabled={saving || loading} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </form>
      </StaggerContainer>
    </DashboardLayout>
  );
}
