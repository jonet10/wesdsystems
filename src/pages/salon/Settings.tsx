import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Save, Sparkles, MapPin, Clock, Globe, Smartphone, FileText, Hash, CreditCard, AlertCircle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { useSubscriptionPaymentReminder } from "@/hooks/useSubscriptionPaymentReminder";
import { SubscriptionDashboard } from "@/components/subscription/SubscriptionDashboard";
import { SubscriptionPaymentCard } from "@/components/dashboard/SubscriptionPaymentCard";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
import { ReceiptTemplate } from "@/components/printing/ReceiptTemplate";
import { Printer, Eye } from "lucide-react";

interface BusinessDay {
  day: string;
  dayIndex: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface BusinessRow {
  id: string;
  name?: string | null;
  logo_url?: string | null;
  currency_code?: string | null;
  nif?: string | null;
  receipt_footer_message?: string | null;
  receipt_policy_message?: string | null;
  show_qr_code?: boolean | null;
  show_barcode?: boolean | null;
}

interface SalonBusinessProfileRow {
  id: string;
  business_id: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  slogan?: string | null;
  whatsapp?: string | null;
  tax_number?: string | null;
  website?: string | null;
}

interface SalonBusinessHourRow {
  id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

const DAYS_OF_WEEK: { label: string; index: number }[] = [
  { label: "Lundi", index: 1 },
  { label: "Mardi", index: 2 },
  { label: "Mercredi", index: 3 },
  { label: "Jeudi", index: 4 },
  { label: "Vendredi", index: 5 },
  { label: "Samedi", index: 6 },
  { label: "Dimanche", index: 0 },
];

export default function SalonSettingsPage() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const { availableCurrencies, setCurrency, currencyCode: activeCurrencyCode } = useCurrency();
  const subscriptionReminder = useSubscriptionPaymentReminder();

  // Profile fields
  const [salonName, setSalonName] = useState("");
  const [owner, setOwner] = useState("");
  const [slogan, setSlogan] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [printerWidth, setPrinterWidth] = useState("58");
  const [receiptFooterMessage, setReceiptFooterMessage] = useState("Merci pour votre confiance.");
  const [receiptPolicyMessage, setReceiptPolicyMessage] = useState("Aucun échange ni remboursement après sortie du magasin.");
  const [showQrCode, setShowQrCode] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);

  const persistBusinessPatch = useCallback(
    async (patch: Partial<Omit<BusinessRow, "id">>) => {
      const targetBusinessId = profile?.business_id ?? businessId ?? user?.user_metadata?.business_id;
      if (!isAuthenticated || !user?.id || !targetBusinessId) {
        return;
      }

      const { error } = await supabase
        .from("businesses")
        .update(patch)
        .eq("id", targetBusinessId);

      if (error) {
        console.error("[SalonSettings] Impossible de mettre à jour le business", {
          businessId: targetBusinessId,
          patch,
          error,
        });
        throw new Error(error.message);
      }
    },
    [businessId, isAuthenticated, profile?.business_id, user?.id]
  );

  // Business hours
  const [businessDays, setBusinessDays] = useState<BusinessDay[]>(
    DAYS_OF_WEEK.map((d) => ({
      day: d.label,
      dayIndex: d.index,
      isOpen: d.index >= 1 && d.index <= 6,
      openTime: "09:00",
      closeTime: d.index === 5 ? "20:00" : "19:00",
    }))
  );

  const handleDayToggle = (index: number) => {
    setBusinessDays((prev) =>
      prev.map((day, idx) => (idx === index ? { ...day, isOpen: !day.isOpen } : day))
    );
  };

  const handleTimeChange = (index: number, field: "openTime" | "closeTime", value: string) => {
    setBusinessDays((prev) =>
      prev.map((day, idx) => (idx === index ? { ...day, [field]: value } : day))
    );
  };

  useEffect(() => {
    setPrinterWidth(localStorage.getItem('wesd_pos_printer_width') || '58');
    const loadSettings = async () => {
      if (!isAuthenticated || !user?.id) return;

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, business_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw new Error(profileError.message);
        }

        if (profileData?.full_name) setOwner(profileData.full_name);
        const bizId = profileData?.business_id ?? profile?.business_id ?? user?.user_metadata?.business_id;
        if (!bizId) {
          console.debug("[SalonSettings] Aucun business_id trouvé", { userId: user.id });
          return;
        }
        setBusinessId(bizId);

        const { data: businessData, error: businessError } = await supabase
          .from("businesses")
          .select("id, name, logo_url, currency_code, nif, receipt_footer_message, receipt_policy_message, show_qr_code, show_barcode")
          .eq("id", bizId)
          .maybeSingle();

        if (businessError) {
          throw new Error(businessError.message);
        }

        if (businessData) {
          setSalonName(businessData.name || "");
          setLogoUrl(businessData.logo_url || null);
          if (businessData.nif) setTaxNumber(businessData.nif);
          if (businessData.receipt_footer_message) setReceiptFooterMessage(businessData.receipt_footer_message);
          if (businessData.receipt_policy_message) setReceiptPolicyMessage(businessData.receipt_policy_message);
          if (businessData.show_qr_code !== undefined && businessData.show_qr_code !== null) setShowQrCode(businessData.show_qr_code);
          if (businessData.show_barcode !== undefined && businessData.show_barcode !== null) setShowBarcode(businessData.show_barcode);
        }

        const { data: profileData2, error: profile2Error } = await supabase
          .from("salon_business_profiles")
          .select("*")
          .eq("business_id", bizId)
          .maybeSingle();

        if (profile2Error) {
          throw new Error(profile2Error.message);
        }

        if (profileData2) {
          const ext = profileData2 as SalonBusinessProfileRow;
          setEmail(ext.email || "");
          setPhone(ext.phone || "");
          setAddress(ext.address || "");
          setSlogan(ext.slogan || "");
          setWhatsapp(ext.whatsapp || "");
          setTaxNumber(ext.tax_number || "");
          setWebsite(ext.website || "");
          if (!businessData?.name || !ext.address) {
            console.debug("[SalonSettings] Données business incomplètes détectées", {
              businessId: bizId,
              name: businessData?.name,
              address: ext.address,
              logoUrl: businessData?.logo_url,
            });
          }
        }

        const { data: hoursData, error: hoursError } = await supabase
          .from("salon_business_hours")
          .select("*")
          .eq("business_id", bizId)
          .order("day_of_week");

        if (hoursError) {
          throw new Error(hoursError.message);
        }

        if (hoursData && hoursData.length > 0) {
          const normalizedHours = hoursData as SalonBusinessHourRow[];
          setBusinessDays(
            DAYS_OF_WEEK.map((d) => {
              const h = normalizedHours.find((hour) => hour.day_of_week === d.index);
              return {
                day: d.label,
                dayIndex: d.index,
                isOpen: h ? h.is_open : false,
                openTime: h ? h.open_time.slice(0, 5) : "09:00",
                closeTime: h ? h.close_time.slice(0, 5) : "18:00",
              };
            })
          );
        }
      } catch (error) {
        console.error("Erreur chargement paramètres salon:", error);
      }
    };

    loadSettings();
  }, [isAuthenticated, user?.id]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const saveSettings = async () => {
      if (!isAuthenticated || !user?.id) {
        toast.error("Vous devez être connecté pour enregistrer.");
        return;
      }
      setIsSaving(true);
      try {
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({ full_name: owner.trim() })
          .eq("id", user.id);

        if (profileUpdateError) {
          throw new Error(profileUpdateError.message);
        }

        const bizId = profile?.business_id ?? businessId ?? user?.user_metadata?.business_id;
        if (bizId) {
          await persistBusinessPatch({
            name: salonName.trim(),
            logo_url: logoUrl,
            currency_code: activeCurrencyCode,
            nif: taxNumber.trim() || null,
            receipt_footer_message: receiptFooterMessage.trim(),
            receipt_policy_message: receiptPolicyMessage.trim(),
            show_qr_code: showQrCode,
            show_barcode: showBarcode,
          });

          const { data: existingProfile, error: existingProfileError } = await supabase
            .from("salon_business_profiles")
            .select("id")
            .eq("business_id", bizId)
            .maybeSingle();

          if (existingProfileError) {
            throw new Error(existingProfileError.message);
          }

          if (existingProfile) {
            const { error: updateProfileError } = await supabase.from("salon_business_profiles").update({
              email: email.trim() || null,
              phone: phone.trim() || null,
              address: address.trim() || null,
              slogan: slogan.trim(),
              whatsapp: whatsapp.trim(),
              tax_number: taxNumber.trim(),
              website: website.trim(),
            }).eq("id", existingProfile.id);

            if (updateProfileError) {
              throw new Error(updateProfileError.message);
            }
          } else {
            const { error: insertProfileError } = await supabase.from("salon_business_profiles").insert({
              business_id: bizId,
              email: email.trim() || null,
              phone: phone.trim() || null,
              address: address.trim() || null,
              slogan: slogan.trim(),
              whatsapp: whatsapp.trim(),
              tax_number: taxNumber.trim(),
              website: website.trim(),
            });

            if (insertProfileError) {
              throw new Error(insertProfileError.message);
            }
          }

          for (const day of businessDays) {
            const { data: existing, error: lookupError } = await supabase
              .from("salon_business_hours")
              .select("id")
              .eq("business_id", bizId)
              .eq("day_of_week", day.dayIndex)
              .maybeSingle();

            if (lookupError) {
              throw new Error(lookupError.message);
            }

            const payload = {
              business_id: bizId,
              day_of_week: day.dayIndex,
              is_open: day.isOpen,
              open_time: day.openTime,
              close_time: day.closeTime,
            };

            if (existing) {
              const { error: updateHoursError } = await supabase.from("salon_business_hours").update(payload).eq("id", existing.id);
              if (updateHoursError) {
                throw new Error(updateHoursError.message);
              }
            } else {
              const { error: insertHoursError } = await supabase.from("salon_business_hours").insert(payload);
              if (insertHoursError) {
                throw new Error(insertHoursError.message);
              }
            }
          }
        }

        toast.success("Paramètres enregistrés avec succès.");
      } catch (error) {
        console.error("Erreur sauvegarde paramètres salon:", error);
        toast.error("Impossible d'enregistrer pour le moment.");
      } finally {
        setIsSaving(false);
      }
    };
    void saveSettings();
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Paramètres"
      subtitle="Configurez l'identité, les horaires et la fiscalité de votre établissement"
      userName={owner || "Administrateur"}
    >
      <StaggerContainer>
        <form onSubmit={handleSaveSettings} className="max-w-4xl">
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
              <TabsTrigger value="hours" className="gap-2">
                <Clock className="h-4 w-4" /> Horaires
              </TabsTrigger>
              <TabsTrigger value="pos" className="gap-2">
                <Smartphone className="h-4 w-4" /> POS
              </TabsTrigger>
              <TabsTrigger value="printing" className="gap-2">
                <FileText className="h-4 w-4" /> Impression
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
                      <p className="text-sm text-muted-foreground">Ces informations seront visibles par vos clients</p>
                    </div>
                  </div>

                  <div className="border-b border-border pb-6">
                    <Label className="mb-4 block">Logo de l'entreprise</Label>
                    <ImageUploader
                      currentImageUrl={logoUrl}
                      onImageUploaded={(url) => {
                        setLogoUrl(url);
                        void persistBusinessPatch({ logo_url: url }).catch((error) => {
                          console.error("[SalonSettings] Logo non persisté immédiatement", error);
                          toast.error("Logo téléversé, mais la sauvegarde automatique a échoué.");
                        });
                      }}
                      onImageDeleted={() => {
                        setLogoUrl(null);
                        void persistBusinessPatch({ logo_url: null }).catch((error) => {
                          console.error("[SalonSettings] Suppression du logo non persistée", error);
                          toast.error("Logo supprimé localement, mais la mise à jour serveur a échoué.");
                        });
                      }}
                      bucketName="logos"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="salon-name">Nom de l'établissement *</Label>
                      <Input id="salon-name" placeholder="Nom de votre établissement" value={salonName} onChange={(e) => setSalonName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-name">Propriétaire / Gérant *</Label>
                      <Input id="owner-name" placeholder="Ex: Jean Dupont" value={owner} onChange={(e) => setOwner(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salon-slogan">Slogan</Label>
                      <Input id="salon-slogan" placeholder="Ex: L'excellence à votre service" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salon-email">Email de contact</Label>
                      <Input id="salon-email" type="email" placeholder="Ex: contact@monstudio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salon-phone">{t("common.phone")}</Label>
                      <Input id="salon-phone" placeholder="Ex: +509 37 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salon-whatsapp">
                        <Smartphone className="h-3.5 w-3.5 inline mr-1" />
                        WhatsApp
                      </Label>
                      <Input id="salon-whatsapp" placeholder="Ex: +509 37 00 00 00" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="salon-address">Adresse physique</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="salon-address" placeholder="Ex: Delmas 75, Port-au-Prince" value={address} onChange={(e) => setAddress(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax-number">
                        <Hash className="h-3.5 w-3.5 inline mr-1" />
                        NIF / Numéro fiscal (optionnel)
                      </Label>
                      <Input id="tax-number" placeholder="Ex: 001-234-567-8" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">
                        <Globe className="h-3.5 w-3.5 inline mr-1" />
                        Site web
                      </Label>
                      <Input id="website" placeholder="Ex: https://monstudio.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="salon-currency">Devise</Label>
                      <select
                        id="salon-currency"
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

            <TabsContent value="hours" className="space-y-6">
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Horaires d'ouverture</h3>
                      <p className="text-sm text-muted-foreground">Ces horaires sont utilisés pour l'agenda et les rendez-vous</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {businessDays.map((day, idx) => (
                      <div key={day.day} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-b-0">
                        <div className="flex items-center gap-3 w-[120px]">
                          <Switch checked={day.isOpen} onCheckedChange={() => handleDayToggle(idx)} />
                          <span className={`text-sm font-medium ${day.isOpen ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{day.day}</span>
                        </div>
                        {day.isOpen ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={day.openTime}
                              onChange={(e) => handleTimeChange(idx, "openTime", e.target.value)}
                              className="h-8 w-24 text-center text-xs"
                            />
                            <span className="text-xs text-muted-foreground">à</span>
                            <Input
                              type="time"
                              value={day.closeTime}
                              onChange={(e) => handleTimeChange(idx, "closeTime", e.target.value)}
                              className="h-8 w-24 text-center text-xs"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic pr-4">Fermé</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

            <TabsContent value="pos" className="space-y-6">
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                  <div className="flex items-center gap-3">
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
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all",
                            printerWidth === w.id
                              ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                              : w.id === "custom"
                              ? "opacity-50 cursor-not-allowed border-border bg-muted/20"
                              : "border-border hover:border-primary/40 hover:bg-muted/40"
                          )}
                        >
                          <span className="text-sm font-bold">{w.id.toUpperCase()}</span>
                          <span className="text-[10px] text-muted-foreground mt-1">{w.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="receipt-footer-msg" className="text-sm font-semibold">Message de remerciement (Pied de ticket)</Label>
                      <Input
                        id="receipt-footer-msg"
                        type="text"
                        value={receiptFooterMessage}
                        onChange={(e) => setReceiptFooterMessage(e.target.value)}
                        placeholder="Merci de votre visite !"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receipt-policy-msg" className="text-sm font-semibold">Message de politique / Conditions</Label>
                      <Input
                        id="receipt-policy-msg"
                        type="text"
                        value={receiptPolicyMessage}
                        onChange={(e) => setReceiptPolicyMessage(e.target.value)}
                        placeholder="Aucun remboursement après sortie."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">Imprimer le QR Code</Label>
                        <p className="text-xs text-muted-foreground">Inclure un QR Code de validation en bas du ticket</p>
                      </div>
                      <Switch
                        checked={showQrCode}
                        onCheckedChange={setShowQrCode}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">Imprimer le Code-barres</Label>
                        <p className="text-xs text-muted-foreground">Inclure un code-barres sur le ticket (si supporté)</p>
                      </div>
                      <Switch
                        checked={showBarcode}
                        onCheckedChange={setShowBarcode}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t gap-4">
                    <div className="text-xs text-muted-foreground">
                      Le changement de format est instantané sur cet appareil.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const sampleData = {
                          business: {
                            name: salonName || "Mon Salon de Coiffure",
                            address: address || "Adresse de l'établissement",
                            phone: phone || "Téléphone",
                            nif: taxNumber || undefined,
                            receipt_footer_message: receiptFooterMessage || undefined,
                            receipt_policy_message: receiptPolicyMessage || undefined,
                            show_qr_code: showQrCode,
                            show_barcode: showBarcode
                          },
                          transaction: {
                            invoiceNumber: "TEST-0001",
                            date: new Date(),
                            cashierName: owner || "Caissier Test",
                            clientName: "Client Démo",
                            barberName: "Coiffeur Démo"
                          },
                          items: [
                            { name: "Coupe Homme Classique", quantity: 1, price: 1500, total: 1500 },
                            { name: "Lotion Cheveux Premium", quantity: 1, price: 1000, total: 1000 }
                          ],
                          totals: {
                            subtotal: 2500,
                            discount: 250,
                            total: 2250
                          },
                          payment: {
                            method: "Espèces",
                            amountReceived: 2500,
                            amountTendered: 2500,
                            changeGiven: 250
                          },
                          currencyCode: activeCurrencyCode || "HTG"
                        };
                        const formatAmount = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: activeCurrencyCode || 'HTG' }).format(val);
                        await printUnifiedReceipt(sampleData, formatAmount);
                      }}
                      className="gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Tester l'impression
                    </Button>
                  </div>
                </div>
              </StaggerItem>

              {/* Aperçu du ticket */}
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold font-display">Aperçu du ticket</h3>
                  </div>
                  <div className="p-4 bg-muted/20 border rounded-xl flex justify-center max-h-[500px] overflow-y-auto">
                    <ReceiptTemplate
                      data={{
                        business: {
                          name: salonName || "Mon Salon de Coiffure",
                          address: address || "Adresse de l'établissement",
                          phone: phone || "Téléphone",
                          nif: taxNumber || undefined,
                          receipt_footer_message: receiptFooterMessage || undefined,
                          receipt_policy_message: receiptPolicyMessage || undefined,
                          show_qr_code: showQrCode,
                          show_barcode: showBarcode
                        },
                        transaction: {
                          invoiceNumber: "TEST-0001",
                          date: new Date(),
                          cashierName: owner || "Caissier Test",
                          clientName: "Client Démo",
                          barberName: "Coiffeur Démo"
                        },
                        items: [
                          { name: "Coupe Homme Classique", quantity: 1, price: 1500, total: 1500 },
                          { name: "Lotion Cheveux Premium", quantity: 1, price: 1000, total: 1000 }
                        ],
                        totals: {
                          subtotal: 2500,
                          discount: 250,
                          total: 2250
                        },
                        payment: {
                          method: "Espèces",
                          amountReceived: 2500,
                          amountTendered: 2500,
                          changeGiven: 250
                        },
                        currencyCode: activeCurrencyCode || "HTG"
                      }}
                      formatAmount={(val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: activeCurrencyCode || 'HTG' }).format(val)}
                      printerWidth={printerWidth}
                    />
                  </div>
                </div>
              </StaggerItem>
            </TabsContent>

            <TabsContent value="printing" className="space-y-6">
              <StaggerItem>
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-display">Configuration d'impression</h3>
                      <p className="text-sm text-muted-foreground">Personnalisez l'affichage de vos documents imprimés</p>
                    </div>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Les informations de votre profil sont automatiquement utilisées sur les reçus, factures et rapports imprimés.
                    </p>
                    <p className="mt-2 text-xs">
                      Formats supportés : impression thermique 80mm, PDF A4, impression navigateur.
                    </p>
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
