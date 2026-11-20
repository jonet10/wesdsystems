import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Building2,
  Hotel,
  Printer,
  Shield,
  Save,
  Clock,
  DollarSign,
  Phone,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function BarSettings() {
  const { profile, user } = useAuth();
  const { format, currencyCode } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  // General settings
  const [businessName, setBusinessName] = useState("Le Relais — Bar, Resto & Hôtel");
  const [slogan, setSlogan] = useState("Bar Lounge, Fritay Créole & Chambres Confort");
  const [phone, setPhone] = useState("+509 37 00 00 00");
  const [whatsapp, setWhatsapp] = useState("+509 37 00 00 00");
  const [address, setAddress] = useState("Port-au-Prince, Haïti");

  // Hotel & Moments Settings
  const [defaultMomentPrice, setDefaultMomentPrice] = useState(1500);
  const [defaultMomentDuration, setDefaultMomentDuration] = useState(2); // 2 hours
  const [extraHourPrice, setExtraHourPrice] = useState(500);
  const [checkoutNightTime, setCheckoutNightTime] = useState("11:00");

  // Receipt & POS Settings
  const [receiptHeader, setReceiptHeader] = useState("BAR, RESTO & HÔTEL");
  const [receiptFooter, setReceiptFooter] = useState("Mèsi pou vizit ou ! Au plaisir de vous revoir.");
  const [showQrCode, setShowQrCode] = useState(true);

  // Security / Admin PIN
  const [adminPin, setAdminPin] = useState("1234");
  const [isSaving, setIsSaving] = useState(false);

  const SETTINGS_STORAGE_KEY = `wesd_bar_settings_${effectiveBranchId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.businessName) setBusinessName(parsed.businessName);
        if (parsed.slogan) setSlogan(parsed.slogan);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.whatsapp) setWhatsapp(parsed.whatsapp);
        if (parsed.address) setAddress(parsed.address);
        if (parsed.defaultMomentPrice) setDefaultMomentPrice(parsed.defaultMomentPrice);
        if (parsed.defaultMomentDuration) setDefaultMomentDuration(parsed.defaultMomentDuration);
        if (parsed.extraHourPrice) setExtraHourPrice(parsed.extraHourPrice);
        if (parsed.checkoutNightTime) setCheckoutNightTime(parsed.checkoutNightTime);
        if (parsed.receiptHeader) setReceiptHeader(parsed.receiptHeader);
        if (parsed.receiptFooter) setReceiptFooter(parsed.receiptFooter);
        if (parsed.adminPin) setAdminPin(parsed.adminPin);
      }
    } catch {
      // ignore
    }
  }, [effectiveBranchId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsPayload = {
        businessName,
        slogan,
        phone,
        whatsapp,
        address,
        defaultMomentPrice,
        defaultMomentDuration,
        extraHourPrice,
        checkoutNightTime,
        receiptHeader,
        receiptFooter,
        showQrCode,
        adminPin,
      };

      // 1. Sauvegarde locale immédiate
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsPayload));

      // 2. Mettre à jour salon_branches / businesses si existant
      try {
        if (effectiveBranchId) {
          await supabase
            .from("salon_branches")
            .update({ name: businessName, phone, address })
            .eq("id", effectiveBranchId);
        }
      } catch (err) {
        console.warn("Could not sync branch to DB:", err);
      }

      toast.success("Paramètres enregistrés avec succès !");
    } catch (err: any) {
      toast.error(err.message || "Erreur d'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Paramètres"
      subtitle="Configuration de l'établissement, des tarifs hôtel / moments et de la caisse"
    >
      <StaggerContainer className="max-w-4xl space-y-6">
        <StaggerItem>
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-xl font-black text-foreground">Paramètres Généraux</h2>
              <p className="text-xs text-muted-foreground">Bar, Resto & Hôtel</p>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2 font-bold bg-primary">
              <Save className="h-4 w-4" /> Enregistrer les modifications
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <Tabs defaultValue="hotel" className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-11 p-1 bg-muted/60">
              <TabsTrigger value="hotel" className="text-xs font-bold gap-1.5">
                <Hotel className="h-4 w-4 text-emerald-600" /> Chambres & Moments
              </TabsTrigger>
              <TabsTrigger value="business" className="text-xs font-bold gap-1.5">
                <Building2 className="h-4 w-4 text-primary" /> Établissement
              </TabsTrigger>
              <TabsTrigger value="pos" className="text-xs font-bold gap-1.5">
                <Printer className="h-4 w-4 text-blue-600" /> Caisse & Reçus
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs font-bold gap-1.5">
                <Shield className="h-4 w-4 text-purple-600" /> Sécurité & PIN
              </TabsTrigger>
            </TabsList>

            {/* TAB: HÔTEL & MOMENTS (Demande spécifique du client) */}
            <TabsContent value="hotel" className="space-y-4 pt-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
                    <Hotel className="h-5 w-5" /> Tarification des Séjours & Moments (Passages)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Définissez la durée et les tarifs standard pour les locations de chambres par moment (ex: 1 500 G pour 2h).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="moment-price" className="text-xs font-bold">
                        Tarif Standard d'un Moment (HTG)
                      </Label>
                      <Input
                        id="moment-price"
                        type="number"
                        value={defaultMomentPrice}
                        onChange={(e) => setDefaultMomentPrice(Number(e.target.value))}
                        className="h-10 text-base font-bold text-primary"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Exemple : 1 500 G pour un moment de passage.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="moment-duration" className="text-xs font-bold">
                        Durée Standard du Moment (Heures)
                      </Label>
                      <Input
                        id="moment-duration"
                        type="number"
                        min="1"
                        max="12"
                        value={defaultMomentDuration}
                        onChange={(e) => setDefaultMomentDuration(Number(e.target.value))}
                        className="h-10 text-base font-bold"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Durée initiale accordée au client (généralement 2h).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor="extra-hour" className="text-xs font-bold">
                        Prix par Heure Supplémentaire (HTG)
                      </Label>
                      <Input
                        id="extra-hour"
                        type="number"
                        value={extraHourPrice}
                        onChange={(e) => setExtraHourPrice(Number(e.target.value))}
                        className="h-10 font-bold"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Facturé en cas de prolongation ou de dépassement du moment (ex: 500 G / heure).
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="night-checkout" className="text-xs font-bold">
                        Heure Limite Check-out Nuitée
                      </Label>
                      <Input
                        id="night-checkout"
                        type="time"
                        value={checkoutNightTime}
                        onChange={(e) => setCheckoutNightTime(e.target.value)}
                        className="h-10 font-bold"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Heure à laquelle les clients de nuit doivent libérer la chambre (ex: 11:00).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1 text-emerald-900 dark:text-emerald-300">
                      <p className="font-bold">Fonctionnement automatique :</p>
                      <p>
                        Dès qu'un client prend un moment (ex: 2h), le système calcule automatiquement l'heure de départ prévue et affiche un compte à rebours en temps réel sur la chambre. Si le temps est dépassé, une alerte s'affiche pour facturer l'heure supplémentaire.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: ÉTABLISSEMENT */}
            <TabsContent value="business" className="space-y-4 pt-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> Informations de l'Établissement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-name" className="text-xs font-bold">Nom du Bar, Restaurant & Hôtel</Label>
                    <Input
                      id="biz-name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="biz-slogan" className="text-xs font-bold">Slogan / Sous-titre</Label>
                    <Input
                      id="biz-slogan"
                      value={slogan}
                      onChange={(e) => setSlogan(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-phone" className="text-xs font-bold">Téléphone</Label>
                      <Input
                        id="biz-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-wa" className="text-xs font-bold">WhatsApp Business</Label>
                      <Input
                        id="biz-wa"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="biz-addr" className="text-xs font-bold">Adresse physique</Label>
                    <Input
                      id="biz-addr"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: CAISSE & REÇUS */}
            <TabsContent value="pos" className="space-y-4 pt-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Printer className="h-5 w-5 text-blue-600" /> Ticket Thermique & Caisse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-header" className="text-xs font-bold">En-tête du Ticket</Label>
                    <Input
                      id="rec-header"
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rec-footer" className="text-xs font-bold">Message de bas de ticket</Label>
                    <Input
                      id="rec-footer"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-xs font-bold">Afficher le code QR sur le ticket</p>
                      <p className="text-[11px] text-muted-foreground">
                        Permet au client de scanner pour payer par MonCash ou vérifier la facture
                      </p>
                    </div>
                    <Switch checked={showQrCode} onCheckedChange={setShowQrCode} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: SÉCURITÉ */}
            <TabsContent value="security" className="space-y-4 pt-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-600" /> Sécurité & Code PIN Caisse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="space-y-1.5 max-w-xs">
                    <Label htmlFor="admin-pin" className="text-xs font-bold">
                      Code PIN Administrateur Caisse
                    </Label>
                    <Input
                      id="admin-pin"
                      type="password"
                      maxLength={6}
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      className="text-lg tracking-widest font-black"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Requis pour annuler une vente, appliquer une remise ou modifier un prix.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
