import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { Eye, EyeOff, Mail, Lock, ArrowRight, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/shared/LanguageSelector";
import { useAuth } from "@/hooks/useAuth";
import { glowupStore } from "@/lib/store";

import { Checkbox } from "@/components/ui/checkbox";

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("wesd_saved_email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("wesd_remember_me") === "true");
  const [loginMode, setLoginMode] = useState<"admin" | "staff" | "school">("admin");
  const [staffUsername, setStaffUsername] = useState(() => localStorage.getItem("wesd_saved_staff") || "");
  const [staffSecret, setStaffSecret] = useState("");
  const [schoolUsername, setSchoolUsername] = useState(() => localStorage.getItem("wesd_saved_school") || "");
  const [schoolPassword, setSchoolPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginStaff } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const localSuperAdminEmails = new Set(['admin@wesdsystems.store']);

  const normalizeRole = (role?: string | null): string | null => {
    if (!role) return null;
    if (role === 'super_admin') return 'super_admin';
    if (role === 'employee') return 'employee';
    if (role === 'partner' || role?.startsWith('partner')) return 'partner';
    if (['studio_admin', 'salon_admin', 'owner'].includes(role)) return 'studio_admin';
    if (['school_admin', 'school_accountant', 'school_cashier', 'school_teacher', 'school_parent'].includes(role)) return role;
    return null;
  };

  const moduleRoute = (businessType?: string | null): string => {
    const routes: Record<string, string> = {
      salon: "/salon",
      pharmacie: "/pharmacie",
      restaurant: "/bar",
      market: "/market",
      boutique: "/boutique",
      auto_parts: "/auto-parts",
      school_payments: "/school",
      school: "/school",
    };
    return (businessType && routes[businessType]) || "/salon";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const safetyTimer = setTimeout(() => setIsLoading(false), 12000);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (rememberMe) {
        localStorage.setItem("wesd_saved_email", email);
        localStorage.setItem("wesd_remember_me", "true");
      } else {
        localStorage.removeItem("wesd_saved_email");
        localStorage.setItem("wesd_remember_me", "false");
      }

      let targetRoute = "/salon";

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, role_normalized, business_type')
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
          const businessType = profile?.business_type || metadata.business_type || null;

          if (normalized === 'super_admin') {
            targetRoute = "/admin";
          } else if (normalized === 'partner') {
            targetRoute = "/partner";
          } else if (normalized === 'employee') {
            targetRoute = "/employee";
          } else {
            targetRoute = moduleRoute(businessType);
            if (businessType) glowupStore.setActiveBusiness(businessType as any);
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

  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const safetyTimer = setTimeout(() => setIsLoading(false), 12000);
    try {
      // Look up the internal email via username using secure RPC (bypasses RLS for login lookup)
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc('get_email_by_username', { p_username: schoolUsername.trim().toLowerCase() });

      if (rpcErr || !rpcData || rpcData.length === 0) {
        throw new Error('Identifiant introuvable. Vérifiez votre nom d\'utilisateur.');
      }

      const foundEmail = rpcData[0].email;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: foundEmail,
        password: schoolPassword,
      });
      if (error) throw error;

      if (rememberMe) {
        localStorage.setItem("wesd_saved_school", schoolUsername);
      } else {
        localStorage.removeItem("wesd_saved_school");
      }

      const role = data.user?.user_metadata?.role || '';
      let route = '/school';
      if (role === 'school_cashier') route = '/school/payments';
      else if (role === 'school_accountant') route = '/school/finance/student';
      else if (role === 'school_teacher') route = '/school';
      navigate(route);

      toast({ title: 'Connexion réussie', description: `Bienvenue, ${data.user?.user_metadata?.full_name || schoolUsername} !` });
    } catch (error: any) {
      toast({ title: 'Erreur de connexion', description: error.message || 'Identifiants incorrects.', variant: 'destructive' });
    } finally {
      clearTimeout(safetyTimer);
      setIsLoading(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const safetyTimer = setTimeout(() => setIsLoading(false), 12000);

    try {
      const res = await loginStaff(staffUsername, staffSecret);
      if (!res.success) {
        toast({
          title: "Erreur de connexion",
          description: res.error,
          variant: "destructive",
        });
        return;
      }

      if (rememberMe) {
        localStorage.setItem("wesd_saved_staff", staffUsername);
        localStorage.setItem("wesd_remember_me", "true");
      } else {
        localStorage.removeItem("wesd_saved_staff");
        localStorage.setItem("wesd_remember_me", "false");
      }

      console.log("[Login] staff login result:", res);
      if (res.staff_type === "auto_parts") glowupStore.setActiveBusiness("auto_parts");
      const route = res.staff_type === "auto_parts" ? "/auto-parts/pos" : "/employee";
      navigate(route);

      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur l'espace caisse !",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Identifiants incorrects.",
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

            <Tabs value={loginMode} onValueChange={(v: any) => setLoginMode(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="admin">{t("auth.login.tabs.admin")}</TabsTrigger>
                <TabsTrigger value="school">{t("auth.login.tabs.school")}</TabsTrigger>
                <TabsTrigger value="staff">{t("auth.login.tabs.staff")}</TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
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
                      <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline font-semibold">
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

                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c === true)} />
                    <Label htmlFor="remember" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Se souvenir de moi
                    </Label>
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
                    <Link to="/devenir-partenaire" className="text-primary font-bold hover:underline">
                      {t("auth.login.becomePartner")}
                    </Link>
                  </p>
                </div>
              </TabsContent>

              {/* ── School users tab ── */}
              <TabsContent value="school">
                <form onSubmit={handleSchoolSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="school-username">Identifiant (username)</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-username"
                        type="text"
                        placeholder="jean.dupont"
                        value={schoolUsername}
                        onChange={(e) => setSchoolUsername(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="school-password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="school-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={schoolPassword}
                        onChange={(e) => setSchoolPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        autoComplete="current-password"
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

                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember-school" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c === true)} />
                    <Label htmlFor="remember-school" className="text-sm font-medium leading-none">
                      Se souvenir de moi
                    </Label>
                  </div>

                  <Button type="submit" className="w-full shadow-md bg-emerald-600 hover:bg-emerald-700 text-white" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Connexion École
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* ── POS / Salon staff tab ── */}
              <TabsContent value="staff">
                <form onSubmit={handleStaffSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="staff-username">Nom d'utilisateur</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                         id="staff-username"
                         type="text"
                         placeholder="Votre identifiant"
                         value={staffUsername}
                         onChange={(e) => setStaffUsername(e.target.value)}
                         className="pl-10"
                         required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="staff-secret">Mot de passe / Code PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="staff-secret"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={staffSecret}
                        onChange={(e) => setStaffSecret(e.target.value)}
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

                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember-staff" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c === true)} />
                    <Label htmlFor="remember-staff" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Se souvenir de moi
                    </Label>
                  </div>

                  <Button type="submit" variant="default" className="w-full shadow-md bg-blue-600 hover:bg-blue-700" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        Accéder à la caisse
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

          </div>
        </FadeUp>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 opacity-12 bg-[linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute inset-0 gradient-primary opacity-85" />
        <div className="relative z-10 text-center max-w-lg px-6">
          <h2 className="text-4xl font-bold font-sans tracking-tight mb-6 text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]">
            Propulsez la croissance de votre commerce
          </h2>
          <p className="text-lg leading-relaxed text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.28)]">
            Wesd Systems centralise vos caisses, rendez-vous, facturations et inventaires pour simplifier la vie de vos collaborateurs.
          </p>
        </div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/12 rounded-full blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
