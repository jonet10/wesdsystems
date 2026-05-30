import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const departments = [
  "Artibonite",
  "Centre",
  "Grand'Anse",
  "Nippes",
  "Nord",
  "Nord-Est",
  "Nord-Ouest",
  "Ouest",
  "Sud",
  "Sud-Est",
] as const;

const partnerTypes = [
  "Influenceur",
  "Technicien informatique",
  "Agence marketing",
  "Agence digitale",
  "Développeur web",
  "Formateur",
  "Consultant",
  "Comptable",
  "Conseiller en entreprise",
  "Autre",
] as const;

const partnerSchema = z.object({
  nom_complet: z.string().min(2, "Le nom complet est requis"),
  email: z.string().email("Email invalide"),
  telephone: z.string().min(6, "Le téléphone est requis"),
  whatsapp: z.string().optional().nullable(),
  ville: z.string().min(2, "La ville est requise"),
  departement: z.enum(departments),
  type_partenaire: z.enum(partnerTypes),
  facebook: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  tiktok: z.string().optional().nullable(),
  youtube: z.string().optional().nullable(),
  site_web: z.string().optional().nullable(),
  moncash: z.string().optional().nullable(),
  natcash: z.string().optional().nullable(),
  compte_bancaire: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  mot_de_passe: z.string().min(8, "Minimum 8 caractères"),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

const emptyDefaults: PartnerFormValues = {
  nom_complet: "",
  email: "",
  telephone: "",
  whatsapp: "",
  ville: "",
  departement: "Ouest",
  type_partenaire: "Influenceur",
  facebook: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  site_web: "",
  moncash: "",
  natcash: "",
  compte_bancaire: "",
  notes: "",
  mot_de_passe: "",
};

const friendlyError = (error: unknown) => {
  const message = String((error as { message?: string } | undefined)?.message || "").toLowerCase();
  if (message.includes("already") || message.includes("déjà") || message.includes("duplicate")) {
    return "Vous avez déjà une demande de partenariat en cours.";
  }
  if (message.includes("auth") || message.includes("uid") || message.includes("connect")) {
    return "Vous devez être connecté pour soumettre une demande de partenariat.";
  }
  return "Impossible de soumettre votre demande. Veuillez réessayer.";
};

export default function PartnerRegister() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: emptyDefaults,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.mot_de_passe,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
          data: {
            role: "partner",
            role_normalized: "partner",
            full_name: values.nom_complet,
          },
        },
      });

      if (signUpError) throw signUpError;

      const currentUser = signUpData.user?.id
        ? signUpData.user
        : (await supabase.auth.getUser()).data.user;

      if (!currentUser?.id) {
        throw new Error("AUTH_REQUIRED");
      }

      const { error: insertError } = await supabase.rpc("submit_partner_application", {
        p_payload: {
          nom_complet: values.nom_complet,
          email: values.email,
          telephone: values.telephone,
          whatsapp: values.whatsapp || null,
          ville: values.ville,
          departement: values.departement,
          type_partenaire: values.type_partenaire,
          facebook: values.facebook || null,
          instagram: values.instagram || null,
          tiktok: values.tiktok || null,
          youtube: values.youtube || null,
          site_web: values.site_web || null,
          moncash: values.moncash || null,
          natcash: values.natcash || null,
          compte_bancaire: values.compte_bancaire || null,
          notes: values.notes || null,
        },
      });

      if (insertError) throw insertError;

      setSubmitted(true);
      toast({
        title: "Demande envoyée",
        description: "Votre demande de partenariat est en attente d'approbation.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur d'inscription partenaire",
        description: friendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground">
        <div className="max-w-xl w-full rounded-2xl border border-border bg-card p-8 shadow-elevated">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Demande reçue</h1>
              <p className="text-sm text-muted-foreground">Votre inscription partenaire est bien enregistrée.</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Un administrateur va examiner votre dossier. Une fois approuvé, votre code partenaire et votre lien de parrainage seront générés automatiquement.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => navigate("/auth/login")} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              Aller au login
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-muted/20">
        <FadeUp className="w-full max-w-4xl">
          <div className="bg-card rounded-2xl shadow-elevated border border-border p-5 sm:p-8">
            <div className="text-center mb-8">
              <Link to="/" className="inline-block">
                <Logo size="lg" />
              </Link>
              <h1 className="text-2xl font-bold font-sans mt-6 mb-2 tracking-tight">
                Inscription partenaire WESD
              </h1>
              <p className="text-muted-foreground text-sm">
                Ambassadeur, revendeur, agence ou consultant: rejoignez le réseau WESD en Haïti.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom complet *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input {...form.register("nom_complet")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" {...form.register("email")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input {...form.register("telephone")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" {...form.register("mot_de_passe")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input {...form.register("whatsapp")} />
                </div>
                <div className="space-y-2">
                  <Label>Ville *</Label>
                  <Input {...form.register("ville")} />
                </div>
                <div className="space-y-2">
                  <Label>Département *</Label>
                  <select
                    {...form.register("departement")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Type de partenaire *</Label>
                  <select
                    {...form.register("type_partenaire")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {partnerTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input {...form.register("facebook")} placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input {...form.register("instagram")} placeholder="https://instagram.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>TikTok</Label>
                  <Input {...form.register("tiktok")} placeholder="https://tiktok.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>YouTube</Label>
                  <Input {...form.register("youtube")} placeholder="https://youtube.com/..." />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Site web</Label>
                  <Input {...form.register("site_web")} placeholder="https://..." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Numéro MonCash</Label>
                  <Input {...form.register("moncash")} />
                </div>
                <div className="space-y-2">
                  <Label>Numéro NatCash</Label>
                  <Input {...form.register("natcash")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Compte bancaire</Label>
                  <Input {...form.register("compte_bancaire")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea rows={4} {...form.register("notes")} />
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">Après validation</p>
                    <p className="text-muted-foreground">
                      Votre code partenaire et votre lien de parrainage seront générés automatiquement par le Super Admin.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Envoi..." : "Soumettre ma demande"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </div>
        </FadeUp>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden bg-foreground">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <div className="relative z-10 text-center text-primary-foreground max-w-lg">
          <h2 className="text-4xl font-bold font-sans tracking-tight mb-6 text-white">
            Programme partenaire
          </h2>
          <p className="text-lg opacity-85 mb-8 text-muted/20">
            Développez vos revenus en apportant de nouveaux business sur WESD Systems.
          </p>
          <ul className="space-y-4 text-left">
            {["Code de parrainage unique", "Commissions récurrentes", "Gestion de vos clients assignés"].map((item) => (
              <li key={item} className="flex items-center gap-3 text-base font-semibold">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
