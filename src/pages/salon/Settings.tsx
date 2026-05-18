import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Building2, Save, Sparkles, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface BusinessDay {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export default function SalonSettingsPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const { availableCurrencies, setCurrency, currencyCode: activeCurrencyCode } = useCurrency();
  const [salonName, setSalonName] = useState("");
  const [owner, setOwner] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [businessSnapshot, setBusinessSnapshot] = useState<Record<string, unknown> | null>(null);

  const [businessDays, setBusinessDays] = useState<BusinessDay[]>([
    { day: "Lundi", isOpen: false, openTime: "09:00", closeTime: "18:00" },
    { day: "Mardi", isOpen: true, openTime: "09:00", closeTime: "19:00" },
    { day: "Mercredi", isOpen: true, openTime: "09:00", closeTime: "19:00" },
    { day: "Jeudi", isOpen: true, openTime: "09:00", closeTime: "19:00" },
    { day: "Vendredi", isOpen: true, openTime: "09:00", closeTime: "20:00" },
    { day: "Samedi", isOpen: true, openTime: "09:00", closeTime: "18:00" },
    { day: "Dimanche", isOpen: false, openTime: "09:00", closeTime: "18:00" },
  ]);

  const handleDayToggle = (index: number) => {
    setBusinessDays(prev =>
      prev.map((day, idx) => (idx === index ? { ...day, isOpen: !day.isOpen } : day))
    );
  };

  const handleTimeChange = (index: number, field: "openTime" | "closeTime", value: string) => {
    setBusinessDays(prev =>
      prev.map((day, idx) => (idx === index ? { ...day, [field]: value } : day))
    );
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!isAuthenticated || !user?.id) return;

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, business_id")
          .eq("id", user.id)
          .single();

        if (profileData?.full_name) {
          setOwner(profileData.full_name);
        }

        if (!profileData?.business_id) return;

        const { data: businessData } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", profileData.business_id)
          .single();

        if (!businessData) return;

        setBusinessSnapshot(businessData as Record<string, unknown>);
        setSalonName((businessData.name as string) || "");
        setLogoUrl((businessData.logo_url as string) || null);
        setEmail((businessData.email as string) || "");
        setPhone((businessData.phone as string) || "");
        setAddress((businessData.address as string) || "");
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
        await supabase
          .from("profiles")
          .update({ full_name: owner.trim() })
          .eq("id", user.id);

        if (profile?.business_id) {
          const businessUpdate: Record<string, unknown> = {
            name: salonName.trim(),
            logo_url: logoUrl,
          };

          if (businessSnapshot && "email" in businessSnapshot) businessUpdate.email = email.trim();
          if (businessSnapshot && "phone" in businessSnapshot) businessUpdate.phone = phone.trim();
          if (businessSnapshot && "address" in businessSnapshot) businessUpdate.address = address.trim();
          if (businessSnapshot && "currency_code" in businessSnapshot) businessUpdate.currency_code = activeCurrencyCode;

          await supabase
            .from("businesses")
            .update(businessUpdate)
            .eq("id", profile.business_id);
        }

        toast.success("Les informations de votre salon ont été enregistrées avec succès.");
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
      title="Paramètres Salon"
      subtitle="Configurez l'identité et les horaires de votre établissement"
      userName={owner || "Administrateur"}
    >
      <StaggerContainer className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Salon Profile Settings */}
        <StaggerItem className="lg:col-span-2">
          <form onSubmit={handleSaveSettings} className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
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
                onImageUploaded={(url) => setLogoUrl(url)} 
                onImageDeleted={() => setLogoUrl(null)} 
                bucketName="logos"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="salon-name">Nom du salon *</Label>
                <Input id="salon-name" placeholder="Ex: Barber Studio Delmas" value={salonName} onChange={(e) => setSalonName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-name">Propriétaire / Gérant *</Label>
                <Input id="owner-name" placeholder="Ex: Jean Dupont" value={owner} onChange={(e) => setOwner(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salon-email">Email de contact *</Label>
                <Input id="salon-email" type="email" placeholder="Ex: contact@monstudio.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salon-phone">Téléphone *</Label>
                <Input id="salon-phone" placeholder="Ex: +509 37 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="salon-address">Adresse physique *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="salon-address" placeholder="Ex: Delmas 75, Port-au-Prince" value={address} onChange={(e) => setAddress(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="salon-currency">Devise du salon</Label>
                <div className="relative">
                  <select 
                    id="salon-currency"
                    value={activeCurrencyCode}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {availableCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.symbol}) - {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button type="submit" variant="hero" disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </StaggerItem>

        {/* Business Hours */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border p-6 shadow-card flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold font-display">Horaires d'ouverture</h3>
                  <p className="text-sm text-muted-foreground">Configurez vos créneaux d'activité</p>
                </div>
              </div>

              <div className="space-y-4">
                {businessDays.map((day, idx) => (
                  <div key={day.day} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-b-0">
                    <div className="flex items-center gap-3 w-[100px]">
                      <Switch checked={day.isOpen} onCheckedChange={() => handleDayToggle(idx)} />
                      <span className={`text-sm font-medium ${day.isOpen ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{day.day}</span>
                    </div>
                    
                    {day.isOpen ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={day.openTime}
                          onChange={(e) => handleTimeChange(idx, "openTime", e.target.value)}
                          className="h-8 w-16 text-center text-xs p-1"
                        />
                        <span className="text-xs text-muted-foreground">à</span>
                        <Input
                          type="text"
                          value={day.closeTime}
                          onChange={(e) => handleTimeChange(idx, "closeTime", e.target.value)}
                          className="h-8 w-16 text-center text-xs p-1"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic pr-4">Fermé</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 mt-6 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Les heures configurées ci-dessus déterminent la grille horaire de votre **Agenda de réservation** et de vos employés.
              </p>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
