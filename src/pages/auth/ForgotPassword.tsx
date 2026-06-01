import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/shared/LanguageSelector";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const safetyTimer = setTimeout(() => setIsLoading(false), 12000);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Email envoyé",
        description: "Veuillez vérifier votre boîte de réception pour réinitialiser votre mot de passe.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email de réinitialisation.",
        variant: "destructive",
      });
    } finally {
      clearTimeout(safetyTimer);
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
              <div className="mt-6 mb-2 flex items-center justify-center">
                <LanguageSelector compact />
              </div>
              <h1 className="text-2xl font-bold font-sans mt-4 mb-2 tracking-tight">
                Mot de passe oublié
              </h1>
              <p className="text-muted-foreground text-sm">
                Saisissez votre adresse email pour recevoir un lien de réinitialisation.
              </p>
            </div>

            {isSuccess ? (
              <div className="text-center space-y-6">
                <div className="bg-primary/10 text-primary p-4 rounded-lg">
                  <p className="font-medium">Email envoyé avec succès !</p>
                  <p className="text-sm mt-2 opacity-90">
                    Si un compte correspond à cette adresse, vous recevrez un email contenant les instructions pour réinitialiser votre mot de passe.
                  </p>
                </div>
                <Link to="/auth/login" className="inline-flex items-center text-primary hover:underline font-medium">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.login.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                       id="email"
                       type="email"
                       placeholder="votre@entreprise.com"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="pl-10"
                       required
                    />
                  </div>
                </div>

                <Button type="submit" variant="hero" className="w-full shadow-md" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      Envoyer le lien
                      <Send className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                
                <div className="mt-6 text-center text-sm">
                  <Link to="/auth/login" className="inline-flex items-center text-muted-foreground hover:text-foreground hover:underline font-medium">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            )}
          </div>
        </FadeUp>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden bg-foreground">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <div className="relative z-10 text-center text-primary-foreground max-w-lg">
          <h2 className="text-4xl font-bold font-sans tracking-tight mb-6 text-white">
            Sécurité garantie
          </h2>
          <p className="text-lg opacity-85 leading-relaxed text-muted/20">
            Protégez l'accès à vos données avec un mot de passe sécurisé. Nous vous aidons à le récupérer en toute simplicité.
          </p>
        </div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
