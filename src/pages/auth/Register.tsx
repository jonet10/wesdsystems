import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { Eye, EyeOff, Mail, Lock, User, Building2, ArrowRight, Check, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { glowupStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const planFeatures = {
  basic: ["1 business actif", "Jusqu'à 3 employés", "Caisse POS standard", "Support client standard"],
  pro: ["2 business actifs", "Jusqu'à 10 employés", "Statistiques avancées", "SMS alertes automatique"],
  premium: ["Business illimités", "Employés illimités", "Inventaire & Tables avancés", "Support VIP 24/7"],
};

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
    businessType: "salon",
    plan: "pro",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      setStep(2);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            business_name: formData.businessName,
            business_type: formData.businessType,
            plan: formData.plan
          }
        }
      });

      if (error) throw error;

      // Send confirmation/welcome email asynchronously via Edge Function
      await supabase.functions.invoke("send-confirmation-email", {
        body: {
          to: formData.email,
          full_name: formData.name,
          business_name: formData.businessName,
          email_type: "welcome",
        },
      });

      // Save their chosen business type in the global store!
      glowupStore.setActiveBusiness(formData.businessType as any);
      navigate("/salon");
      toast({
        title: "Compte créé avec succès !",
        description: "Bienvenue sur Wesd Systems. Votre essai de 14 jours commence maintenant.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur lors de l'inscription",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/20">
        <FadeUp className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
            <div className="text-center mb-8">
              <Link to="/" className="inline-block">
                <Logo size="lg" />
              </Link>
              <h1 className="text-2xl font-bold font-sans mt-6 mb-2 tracking-tight">
                {step === 1 ? "Créer un compte" : "Votre commerce"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {step === 1 ? "Essai gratuit pendant 14 jours" : "Dernière étape pour démarrer"}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-8">
              <div className={`flex-1 h-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
              <div className={`flex-1 h-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Jean Dupont"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email professionnel</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="votre@entreprise.com"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 8 caractères"
                        value={formData.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className="pl-10 pr-10"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Nom de votre commerce</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="businessName"
                        type="text"
                        placeholder="Mon Établissement"
                        value={formData.businessName}
                        onChange={(e) => updateField("businessName", e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessType">Secteur d'activité</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select
                        id="businessType"
                        value={formData.businessType}
                        onChange={(e) => updateField("businessType", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                      >
                        <option value="salon">💇‍♀️ Salon de beauté & Barber Shop</option>
                        <option value="pharmacie">💊 Pharmacie & Santé</option>
                        <option value="restaurant">🍔 Restaurant, Café & Bar</option>
                        <option value="market">🛒 Provision & Supermarché</option>
                        <option value="boutique">🛍️ Boutique Générale / Habillement</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Choisissez votre plan</Label>
                    <div className="space-y-3">
                      {(["basic", "pro", "premium"] as const).map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => updateField("plan", plan)}
                          className={`w-full p-4 rounded-xl border text-left transition-all ${
                            formData.plan === plan
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold capitalize text-sm">{plan === "basic" ? "Start-up" : plan === "pro" ? "Professionnel" : "Entreprise"}</span>
                            {plan === "pro" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-full uppercase tracking-wider">
                                Recommandé
                              </span>
                            )}
                          </div>
                          <ul className="space-y-1">
                            {planFeatures[plan].map((feature, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                                <Check className="h-3 w-3 text-success flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" variant="hero" className="w-full shadow-md" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {step === 1 ? "Continuer" : "Créer mon compte"}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>

              {step === 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-foreground hover:bg-muted"
                  onClick={() => setStep(1)}
                >
                  Retour
                </Button>
              )}
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                Déjà un compte ?{" "}
                <Link to="/auth/login" className="text-primary font-bold hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-6 leading-relaxed">
              En créant un compte, vous acceptez nos{" "}
              <a href="#" className="underline hover:text-foreground">Conditions d'utilisation</a>
              {" "}et notre{" "}
              <a href="#" className="underline hover:text-foreground">Politique de confidentialité</a>.
            </p>
          </div>
        </FadeUp>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden bg-foreground">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <div className="relative z-10 text-center text-primary-foreground max-w-lg">
          <h2 className="text-4xl font-bold font-sans tracking-tight mb-6 text-white">
            14 jours d'essai gratuit
          </h2>
          <p className="text-lg opacity-85 mb-8 text-muted/20">
            Aucune carte bancaire requise. Configurez votre commerce en Gourdes ou Dollars.
          </p>
          <ul className="space-y-4 text-left">
            {["Configuration en 5 minutes", "Importation assistée de vos produits", "Support dédié localisé en Haïti"].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-base font-semibold">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
