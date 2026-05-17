import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { FadeUp } from "@/components/animations/AnimatedContainers";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate login - will be replaced with actual auth
    setTimeout(() => {
      setIsLoading(false);
      
      // Demo navigation based on email patterns
      if (email.includes("admin@wesdsystems") || email.includes("admin@glowup")) {
        navigate("/admin");
      } else if (email.includes("salon") || email.includes("pharmacie") || email.includes("resto") || email.includes("market") || email.includes("boutique")) {
        navigate("/salon");
      } else {
        navigate("/employee");
      }
      
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur Wesd Systems !",
      });
    }, 1500);
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
                Bon retour !
              </h1>
              <p className="text-muted-foreground text-sm">
                Connectez-vous à votre portail d'entreprise
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Mot de passe</Label>
                  <Link to="#" className="text-sm text-primary hover:underline font-semibold">
                    Mot de passe oublié ?
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
                    Se connecter
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                Pas encore de compte ?{" "}
                <Link to="/auth/register" className="text-primary font-bold hover:underline">
                  Créer un compte
                </Link>
              </p>
            </div>

            {/* Demo credentials hint */}
            <div className="mt-8 p-4 bg-muted/60 rounded-xl border border-border/40">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                <strong>Démo :</strong> Utilisez <code className="bg-background px-1.5 py-0.5 rounded font-bold">admin@wesdsystems.com</code> pour l'admin, et n'importe quel email contenant <code className="bg-background px-1.5 py-0.5 rounded font-bold">salon</code> ou <code className="bg-background px-1.5 py-0.5 rounded font-bold">pharmacie</code> pour un dashboard POS.
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
