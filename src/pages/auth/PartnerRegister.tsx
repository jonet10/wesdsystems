import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Building2, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";

const partnerSchema = z.object({
  full_name: z.string().min(2, "Le nom complet est requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Minimum 8 caractères"),
  phone: z.string().min(6, "Numéro requis"),
  whatsapp_number: z.string().min(6, "Numéro WhatsApp requis"),
  city: z.string().min(2, "Ville requise"),
  department: z.string().min(2, "Département requis"),
  partner_type: z.string().min(2, "Type de partenaire requis"),
  facebook_url: z.string().optional().nullable(),
  instagram_url: z.string().optional().nullable(),
  tiktok_url: z.string().optional().nullable(),
  youtube_url: z.string().optional().nullable(),
  website_url: z.string().optional().nullable(),
  moncash_number: z.string().optional().nullable(),
  natcash_number: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

const partnerTypes = [
  "Influencer",
  "IT Technician",
  "Marketing Agency",
  "Digital Agency",
  "Web Developer",
  "Trainer",
  "Consultant",
  "Business Advisor",
  "Other",
];

const makePendingCode = (fullName: string) => {
  const base = fullName.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase().slice(0, 12) || "PARTNER";
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

export default function PartnerRegister() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      phone: "",
      whatsapp_number: "",
      city: "",
      department: "",
      partner_type: "Influencer",
      facebook_url: "",
      instagram_url: "",
      tiktok_url: "",
      youtube_url: "",
      website_url: "",
      moncash_number: "",
      natcash_number: "",
      bank_account_number: "",
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
          data: {
            role: "partner",
            role_normalized: "partner",
            full_name: values.full_name,
          },
        },
      });

      if (error) throw error;
      if (!data.user?.id) throw new Error("Impossible de créer le compte partenaire.");

      const referralCode = makePendingCode(values.full_name);
      const { error: partnerError } = await supabase.from("partners").insert([{
        user_id: data.user.id,
        display_name: values.full_name,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        whatsapp_number: values.whatsapp_number,
        city: values.city,
        department: values.department,
        partner_type: values.partner_type,
        facebook_url: values.facebook_url || null,
        instagram_url: values.instagram_url || null,
        tiktok_url: values.tiktok_url || null,
        youtube_url: values.youtube_url || null,
        website_url: values.website_url || null,
        moncash_number: values.moncash_number || null,
        natcash_number: values.natcash_number || null,
        bank_account: values.bank_account_number ? { account_number: values.bank_account_number } : {},
        notes: values.notes || null,
        status: "pending",
        partner_level: "affiliate",
        referral_code: referralCode,
        referral_url: null,
        application_source: "partner_registration",
      }]);

      if (partnerError) throw partnerError;

      setSubmitted(true);
      toast({
        title: "Demande envoyée",
        description: "Votre dossier partenaire est en attente d'approbation.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur d'inscription partenaire",
        description: error.message || "Une erreur est survenue.",
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
          <div className="flex gap-3">
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
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/20">
        <FadeUp className="w-full max-w-3xl">
          <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
            <div className="text-center mb-8">
              <Link to="/" className="inline-block">
                <Logo size="lg" />
              </Link>
              <h1 className="text-2xl font-bold font-sans mt-6 mb-2 tracking-tight">
                Devenir partenaire WESD
              </h1>
              <p className="text-muted-foreground text-sm">
                Rejoignez le programme partenaire, ambassadeur et apportez des clients à la plateforme.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input {...form.register("full_name")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" {...form.register("email")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" {...form.register("password")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input {...form.register("phone")} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input {...form.register("whatsapp_number")} />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input {...form.register("city")} />
                </div>
                <div className="space-y-2">
                  <Label>Département</Label>
                  <Input {...form.register("department")} />
                </div>
                <div className="space-y-2">
                  <Label>Type de partenaire</Label>
                  <select
                    {...form.register("partner_type")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {partnerTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input {...form.register("facebook_url")} placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input {...form.register("instagram_url")} placeholder="https://instagram.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>TikTok</Label>
                  <Input {...form.register("tiktok_url")} placeholder="https://tiktok.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>YouTube</Label>
                  <Input {...form.register("youtube_url")} placeholder="https://youtube.com/..." />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Site web</Label>
                  <Input {...form.register("website_url")} placeholder="https://..." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Numéro MonCash</Label>
                  <Input {...form.register("moncash_number")} />
                </div>
                <div className="space-y-2">
                  <Label>Numéro NatCash</Label>
                  <Input {...form.register("natcash_number")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Compte bancaire</Label>
                  <Input {...form.register("bank_account_number")} />
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
                      Un code partenaire et un lien de parrainage seront générés automatiquement après approbation par le Super Admin.
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
