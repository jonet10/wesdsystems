import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Save, Globe, Smartphone, FileText, Hash, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { SchoolSetting } from "@/modules/school/types";

export default function SchoolSettingsPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const { availableCurrencies, setCurrency, currencyCode: activeCurrencyCode } = useCurrency();

  // Profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Finance fields
  const [invoicePrefix, setInvoicePrefix] = useState("FACT-");
  const [receiptPrefix, setReceiptPrefix] = useState("REC-");
  const [terms, setTerms] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!isAuthenticated || !user?.id) return;

      try {
        const bizId = profile?.business_id || user?.user_metadata?.business_id;
        if (!bizId) return;
        setBusinessId(bizId);

        const { data, error } = await supabase
          .from("school_settings")
          .select("*")
          .eq("business_id", bizId)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (data) {
          const settings = data as SchoolSetting;
          setSettingsId(settings.id);
          setName(settings.name || "");
          setEmail(settings.email || "");
          setPhone(settings.phone || "");
          setAddress(settings.address || "");
          setWebsite(settings.website || "");
          setLogoUrl(settings.logo_url || null);
          setInvoicePrefix(settings.invoice_prefix || "FACT-");
          setReceiptPrefix(settings.receipt_prefix || "REC-");
          setTerms(settings.terms || "");
          if (settings.currency && settings.currency !== activeCurrencyCode) {
            setCurrency(settings.currency as any);
          }
        }
      } catch (error) {
        console.error("Erreur chargement paramètres école:", error);
      }
    };

    loadSettings();
  }, [isAuthenticated, user?.id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user?.id || !businessId) {
      toast.error("Vous devez être connecté pour enregistrer.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        website: website.trim(),
        logo_url: logoUrl,
        invoice_prefix: invoicePrefix.trim(),
        receipt_prefix: receiptPrefix.trim(),
        terms: terms.trim(),
        currency: activeCurrencyCode,
      };

      if (settingsId) {
        const { error } = await supabase
          .from("school_settings")
          .update(payload)
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("school_settings")
          .insert([payload]);
        if (error) throw error;
      }

      toast.success("Paramètres enregistrés avec succès");
    } catch (error: any) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement", {
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres de l'établissement</h1>
          <p className="text-muted-foreground">
            Configurez les informations et préférences de votre école
          </p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
              <Building2 className="h-4 w-4 mr-2" />
              Général
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
              <CreditCard className="h-4 w-4 mr-2" />
              Facturation
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSaveSettings}>
            <TabsContent value="general" className="m-0">
              <StaggerContainer className="space-y-6">
                <StaggerItem>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nom de l'établissement</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="address">Adresse</Label>
                            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="phone">Téléphone</Label>
                              <div className="relative">
                                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="phone" className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="email">Email de contact</Label>
                              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="website">Site Web</Label>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input id="website" className="pl-9" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
                            </div>
                          </div>
                        </div>

                        <div className="w-full md:w-64 space-y-4 shrink-0">
                          <Label>Logo (Factures & Reçus)</Label>
                          <ImageUploader
                            bucket="avatars"
                            path={`business/${businessId}/logo`}
                            onUpload={(url) => setLogoUrl(url)}
                            defaultImage={logoUrl || undefined}
                            aspectRatio="square"
                            className="w-full aspect-square"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </TabsContent>

            <TabsContent value="billing" className="m-0">
              <StaggerContainer className="space-y-6">
                <StaggerItem>
                  <Card>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Devise Principale</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={activeCurrencyCode}
                            onChange={(e) => setCurrency(e.target.value as any)}
                          >
                            {availableCurrencies.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} ({c.symbol})
                              </option>
                            ))}
                          </select>
                        </div>
                        
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

                      <div className="space-y-2">
                        <Label>Termes et Conditions par défaut (Affichés sur les factures)</Label>
                        <textarea
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={terms}
                          onChange={(e) => setTerms(e.target.value)}
                          placeholder="Ex: Les frais de scolarité sont payables d'avance. Aucun remboursement après 30 jours."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </TabsContent>

            <div className="flex justify-end gap-4 mt-6">
              <Button type="submit" disabled={isSaving} className="min-w-[150px]">
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Enregistrement...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Enregistrer les modifications
                  </span>
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
