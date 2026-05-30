import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/shared/LanguageSelector";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const localSuperAdminEmails = new Set(['admin@wesdsystems.store']);

  const normalizeRole = (role?: string | null): string | null => {
    if (!role) return null;
    if (role === 'super_admin') return 'super_admin';
    if (role === 'employee') return 'employee';
    if (role === 'partner' || role?.startsWith('partner')) return 'partner';
    // studio_admin, salon_admin, owner → all go to /salon
    if (['studio_admin', 'salon_admin', 'owner'].includes(role)) return 'studio_admin';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Safety timeout: unblock the button after 12s no matter what
    const safetyTimer = setTimeout(() => setIsLoading(false), 12000);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch user role from DB for secure routing
      let targetRoute = "/salon"; // Default fallback

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, role_normalized')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Login: profil non trouvé, utilisation du fallback de rôle', profileError);
          if (localSuperAdminEmails.has(data.user.email ?? email)) {
            targetRoute = "/admin";
          }
        } else {
          const metadata = data.user.user_metadata ?? {};
          const rawRole = profile?.role_normalized || profile?.role || metadata.role_normalized || metadata.role;
          const normalized = normalizeRole(rawRole);

          if (normalized === 'super_admin') {
            targetRoute = "/admin";
          } else if (normalized === 'partner') {
            targetRoute = "/partner";
          } else if (normalized === 'employee') {
            targetRoute = "/employee";
          } else {
            targetRoute = "/salon";
          }
        }
      }

      navigate(targetRoute);

      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur Wesd Systems !",
      });
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Identifiants incorrects.",
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
                {t("auth.login.title")}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("auth.login.subtitle")}
              </p>
            </div>

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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.login.password")}</Label>
                  <Link to="#" className="text-sm text-primary hover:underline font-semibold">
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
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

              <Button type="submit" variant="hero" className="w-full shadow-md" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {t("auth.login.signIn")}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                {t("auth.login.noAccount")}{" "}
                <Link to="/auth/register" className="text-primary font-bold hover:underline">
                  {t("auth.login.createAccount")}
                </Link>
              </p>
              <p className="mt-2 text-muted-foreground">
                {t("auth.login.partnerHint")}{" "}
                <Link to="/become-partner" className="text-primary font-bold hover:underline">
                  {t("auth.login.becomePartner")}
                </Link>
              </p>
            </div>

            {/* Demo credentials hint */}
            <div className="mt-8 p-4 bg-muted/60 rounded-xl border border-border/40">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                <strong>Admin :</strong> Utilisez le compte créé dans Supabase. Pour l'environnement local, le script <code className="bg-background px-1.5 py-0.5 rounded font-bold">create-admin.js</code> configure <code className="bg-background px-1.5 py-0.5 rounded font-bold">admin@wesdsystems.store</code>.
              </p>
            </div>
          </div>
        </FadeUp>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden bg-foreground">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <div className="relative z-10 text-center text-primary-foreground max-w-lg">
          <h2 className="text-4xl font-bold font-sans tracking-tight mb-6 text-white">
            Propulsez la croissance de votre commerce
          </h2>
          <p className="text-lg opacity-85 leading-relaxed text-muted/20">
            Wesd Systems centralise vos caisses, rendez-vous, facturations et inventaires pour simplifier la vie de vos collaborateurs.
          </p>
        </div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
