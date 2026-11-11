import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  KeyRound, 
  Mail, 
  User, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertTriangle,
  Lock,
  CheckCircle2,
  Building2
} from "lucide-react";

export function AccountSecuritySettings() {
  const { user, profile } = useAuth();

  // Personal profile state
  const [fullName, setFullName] = useState(profile?.full_name || (user?.user_metadata?.full_name as string) || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Email update state
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Password update state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Password strength check
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score: 1, label: "Faible", color: "bg-red-500 text-red-500" };
    if (score <= 3) return { score: 2, label: "Moyen", color: "bg-amber-500 text-amber-500" };
    return { score: 3, label: "Robuste", color: "bg-emerald-500 text-emerald-500" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // 1. UPDATE PROFILE NAME
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      toast.error("Le nom complet ne peut pas être vide.");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      // Update Supabase Auth user metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });
      if (authErr) throw authErr;

      // Update public.profiles
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);

      toast.success("Nom du profil mis à jour avec succès !");
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour le profil.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // 2. UPDATE LOGIN EMAIL
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    const trimmedNewEmail = newEmail.trim().toLowerCase();
    if (!trimmedNewEmail) {
      toast.error("Veuillez saisir une nouvelle adresse email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedNewEmail)) {
      toast.error("Veuillez saisir une adresse email valide.");
      return;
    }

    if (trimmedNewEmail === user.email.toLowerCase()) {
      toast.error("La nouvelle adresse email doit être différente de l'adresse actuelle.");
      return;
    }

    if (!emailCurrentPassword) {
      toast.error("Veuillez saisir votre mot de passe actuel pour autoriser ce changement.");
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // Verify current password first
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: emailCurrentPassword,
      });

      if (verifyErr) {
        throw new Error("Mot de passe actuel incorrect. Veuillez réessayer.");
      }

      // Request email change in Supabase Auth
      const { error: updateErr } = await supabase.auth.updateUser({
        email: trimmedNewEmail,
      });

      if (updateErr) throw updateErr;

      // Update public.profiles if column exists
      try {
        await supabase
          .from("profiles")
          .update({ email: trimmedNewEmail })
          .eq("id", user.id);
      } catch {
        // Ignored if column doesn't exist
      }

      toast.success(
        "Demande de changement d'email prise en compte ! Un lien de confirmation a été envoyé à vos adresses pour valider l'opération.",
        { duration: 6000 }
      );

      setNewEmail("");
      setEmailCurrentPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement d'adresse email.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // 3. UPDATE PASSWORD
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (!currentPassword) {
      toast.error("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Verify current password first
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyErr) {
        throw new Error("Le mot de passe actuel saisi est incorrect.");
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      toast.success("Votre mot de passe a été modifié avec succès ! Vos prochaines connexions utiliseront ce nouveau mot de passe.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement de mot de passe.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ACCOUNT SUMMARY BANNER */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">Sécurité du Compte Administrateur</h3>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                    Actif
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Gérez vos identifiants d'accès, votre adresse email de connexion et votre mot de passe.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Rôle : <span className="capitalize">{profile?.role_normalized || profile?.role || "Administrateur"}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-primary" />
                {user?.email || "Email non défini"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: MODIFIER LE MOT DE PASSE */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Changer le mot de passe</CardTitle>
                <CardDescription>
                  Mettez à jour le mot de passe d'accès à votre compte entreprise.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-pass" className="text-xs font-medium">Mot de passe actuel *</Label>
                <div className="relative">
                  <Input
                    id="current-pass"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="pr-10 border-border/60 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-pass" className="text-xs font-medium">Nouveau mot de passe *</Label>
                  {newPassword && (
                    <span className={`text-[11px] font-medium ${passwordStrength.color}`}>
                      Force : {passwordStrength.label}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="new-pass"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Au moins 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pr-10 border-border/60 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Progress bar */}
                {newPassword && (
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <div className={`h-1 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.color : "bg-muted"}`} />
                    <div className={`h-1 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.color : "bg-muted"}`} />
                    <div className={`h-1 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.color : "bg-muted"}`} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pass" className="text-xs font-medium">Confirmer le nouveau mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="confirm-pass"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Retapez le nouveau mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10 border-border/60 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" /> Les mots de passe ne correspondent pas
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="w-full bg-primary hover:bg-primary-dark text-primary-fg font-medium gap-2 shadow-sm"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mise à jour en cours...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Enregistrer le nouveau mot de passe
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* SECTION 2: MODIFIER L'EMAIL DE CONNEXION */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Changer l'email de connexion</CardTitle>
                <CardDescription>
                  Modifiez l'adresse utilisée pour vous connecter à la plateforme.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Adresse email actuelle</Label>
                <Input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted/50 cursor-not-allowed border-border/40 font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-email" className="text-xs font-medium">Nouvelle adresse email *</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="admin@nouvelle-entreprise.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="border-border/60 bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Un email de confirmation sera envoyé pour sécuriser le transfert.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-confirm-pass" className="text-xs font-medium">Mot de passe actuel pour confirmer *</Label>
                <div className="relative">
                  <Input
                    id="email-confirm-pass"
                    type={showEmailPassword ? "text" : "password"}
                    placeholder="Saisissez votre mot de passe pour valider"
                    value={emailCurrentPassword}
                    onChange={(e) => setEmailCurrentPassword(e.target.value)}
                    required
                    className="pr-10 border-border/60 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={isUpdatingEmail || !newEmail || !emailCurrentPassword}
                  className="w-full bg-primary hover:bg-primary-dark text-primary-fg font-medium gap-2 shadow-sm"
                >
                  {isUpdatingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mise à jour en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Mettre à jour l'adresse email
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3: NOM DU PROFIL */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Identité de l'administrateur</CardTitle>
              <CardDescription>
                Nom complet affiché sur l'en-tête, les factures et les rapports.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-xs font-medium">Nom complet de l'administrateur</Label>
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="border-border/60 bg-background"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isUpdatingProfile || !fullName.trim()}
              variant="outline"
              className="gap-2 border-border/60 hover:bg-muted/50"
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Mettre à jour le nom
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
