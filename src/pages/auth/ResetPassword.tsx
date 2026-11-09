import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { LanguageSelector } from "@/components/shared/LanguageSelector";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if recovery token or active session exists
    const checkSession = async () => {
      // 1. Listen for Supabase recovery auth event
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setHasValidSession(true);
        }
      });

      // 2. Also check URL hash/params (type=recovery or access_token or code)
      const hash = window.location.hash;
      const search = window.location.search;
      const hasRecoveryToken = 
        hash.includes("type=recovery") || 
        hash.includes("access_token=") || 
        search.includes("code=");

      const { data: { session } } = await supabase.auth.getSession();

      if (hasRecoveryToken || session) {
        setHasValidSession(true);
      } else {
        // Give 1.5 seconds in case Supabase client is still parsing the hash
        const timer = setTimeout(() => {
          setHasValidSession((prev) => (prev === null ? false : prev));
        }, 1500);
        return () => clearTimeout(timer);
      }

      return () => {
        authListener.subscription.unsubscribe();
      };
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error("Veuillez saisir un mot de passe.");
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("Votre mot de passe a été réinitialisé avec succès !");
    } catch (error: any) {
      console.error("Error updating password:", error);
      const msg = error.message || "";
      if (msg.includes("same_password") || msg.includes("different")) {
        toast.error("Veuillez choisir un mot de passe différent de l'ancien.");
      } else if (msg.includes("expired") || msg.includes("invalid")) {
        toast.error("Le lien de récupération est invalide ou a expiré.");
        setHasValidSession(false);
      } else {
        toast.error(error.message || "Impossible de réinitialiser le mot de passe.");
      }
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
              <div className="mt-6 mb-2 flex items-center justify-center">
                <LanguageSelector compact />
              </div>
              <h1 className="text-2xl font-bold font-sans mt-4 mb-2 tracking-tight">
                Nouveau mot de passe
              </h1>
              <p className="text-muted-foreground text-sm">
                Définissez votre nouveau mot de passe pour sécuriser votre compte.
              </p>
            </div>

            {isSuccess ? (
              <div className="text-center space-y-6">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-5 rounded-xl flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="font-semibold text-base">Mot de passe réinitialisé !</p>
                  <p className="text-sm opacity-90">
                    Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter à votre compte.
                  </p>
                </div>
                <Button 
                  onClick={() => navigate("/auth/login")} 
                  className="w-full" 
                  size="lg"
                >
                  Aller à la connexion
                </Button>
              </div>
            ) : hasValidSession === false ? (
              <div className="text-center space-y-6">
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-5 rounded-xl flex flex-col items-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <p className="font-semibold text-base">Lien expiré ou invalide</p>
                  <p className="text-sm opacity-90">
                    Ce lien de réinitialisation n'est plus valable. Veuillez faire une nouvelle demande.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => navigate("/auth/forgot-password")} 
                    className="w-full"
                    size="lg"
                  >
                    Demander un nouveau lien
                  </Button>
                  <Link 
                    to="/auth/login" 
                    className="inline-flex items-center justify-center text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour à la connexion
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 caractères"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Retapez votre mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full shadow-md" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Enregistrer le mot de passe
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
            Nouveau départ sécurisé
          </h2>
          <p className="text-lg opacity-85 leading-relaxed text-muted/20">
            Choisissez un mot de passe robuste combinant lettres, chiffres et symboles pour garantir une protection maximale de votre espace de travail.
          </p>
        </div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
