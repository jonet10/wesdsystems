import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SchoolEngine, SchoolType, schoolPluginRegistry } from "../engine";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, BookOpen, Wrench, AlertTriangle, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Outlet } from "react-router-dom";

interface SchoolContextType {
  schoolType: SchoolType;
  engine: SchoolEngine;
  isLoading: boolean;
  isConfigured: boolean;
  refetchConfig: () => Promise<void>;
}

export const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { profile, user, isAuthenticated } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [schoolType, setSchoolType] = useState<SchoolType>("CLASSIC");
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Setup Wizard states
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedType, setSelectedType] = useState<SchoolType | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);

  const fetchConfig = async () => {
    if (!isAuthenticated || !businessId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("school_configurations")
        .select("school_type")
        .eq("business_id", businessId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSchoolType(data.school_type as SchoolType);
        setIsConfigured(true);
      } else {
        setIsConfigured(false);
      }
    } catch (err) {
      console.error("Failed to load school configuration", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [businessId, isAuthenticated]);

  const handleDeploy = async () => {
    if (!businessId || !selectedType) return;
    setWizardStep(4);
    
    // Simulate deployment progress bar for WOW effect
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setDeployProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        saveConfiguration();
      }
    }, 200);
  };

  const saveConfiguration = async () => {
    try {
      const { error } = await supabase
        .from("school_configurations")
        .insert([{
          business_id: businessId,
          school_type: selectedType,
          configured_by: user?.id,
          is_locked: true
        }]);

      if (error) throw error;

      toast.success(`Établissement configuré en mode ${selectedType === "CLASSIC" ? "École Classique" : selectedType === "VOCATIONAL" ? "École Professionnelle" : "Université"} !`);
      setSchoolType(selectedType!);
      setIsConfigured(true);
    } catch (err: any) {
      toast.error("Erreur de sauvegarde", { description: err.message });
      setWizardStep(3);
    }
  };

  // Construct active engine instance based on the state
  const activePlugin = schoolPluginRegistry.get(schoolType);
  const engine = new SchoolEngine(activePlugin);

  // Render centered spinner if loading core configuration
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="text-center space-y-3">
          <RefreshCw className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Chargement du School Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <SchoolContext.Provider value={{ schoolType, engine, isLoading, isConfigured, refetchConfig: fetchConfig }}>
      {children}

      {/* Setup Wizard Overlay if not configured */}
      {isAuthenticated && businessId && !isConfigured && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border border-zinc-800 bg-zinc-950 text-white shadow-2xl rounded-2xl">
            <div className="p-6 md:p-8 space-y-6">
              
              {/* ── STEP 1: WELCOME ── */}
              {wizardStep === 1 && (
                <div className="text-center space-y-6 py-6 animate-in fade-in zoom-in duration-300">
                  <div className="h-16 w-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-glow">
                    <GraduationCap className="h-10 w-10" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                      Bienvenue sur Wesd Académie !
                    </h2>
                    <p className="text-sm text-zinc-400 max-w-md mx-auto">
                      Initialisez votre espace de gestion scolaire en quelques secondes. Commençons par configurer le type de votre établissement.
                    </p>
                  </div>
                  <Button size="lg" className="w-full sm:w-auto mt-4 px-8" onClick={() => setWizardStep(2)}>
                    Commencer la configuration <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* ── STEP 2: CHOOSE ESTABLISHMENT TYPE ── */}
              {wizardStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                  <div className="space-y-1 text-center">
                    <h3 className="text-xl font-bold">Quel type d'établissement gérez-vous ?</h3>
                    <p className="text-xs text-zinc-400">Ce choix adaptera dynamiquement toute la terminologie, les rapports et les formulaires.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Classic Option */}
                    <Card
                      className={`cursor-pointer transition-all duration-300 border-2 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-primary/50 text-white ${selectedType === "CLASSIC" ? "border-primary shadow-glow" : "border-zinc-800"}`}
                      onClick={() => setSelectedType("CLASSIC")}
                    >
                      <CardContent className="p-5 text-center space-y-3 flex flex-col items-center">
                        <div className="p-3 bg-zinc-800 rounded-xl text-primary"><BookOpen className="h-6 w-6" /></div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm">École Classique</h4>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">Maternelle, fondamental, secondaire. Bulletins, classes et devoirs.</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Vocational Option */}
                    <Card
                      className={`cursor-pointer transition-all duration-300 border-2 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-amber-500/50 text-white ${selectedType === "VOCATIONAL" ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-zinc-800"}`}
                      onClick={() => setSelectedType("VOCATIONAL")}
                    >
                      <CardContent className="p-5 text-center space-y-3 flex flex-col items-center">
                        <div className="p-3 bg-zinc-800 rounded-xl text-amber-500"><Wrench className="h-6 w-6" /></div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm">Centre Pro</h4>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">Formation technique et professionnelle. Modules, formateurs et cohortes.</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* University Option */}
                    <Card
                      className={`cursor-pointer transition-all duration-300 border-2 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-cyan-400/50 text-white ${selectedType === "UNIVERSITY" ? "border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]" : "border-zinc-800"}`}
                      onClick={() => setSelectedType("UNIVERSITY")}
                    >
                      <CardContent className="p-5 text-center space-y-3 flex flex-col items-center">
                        <div className="p-3 bg-zinc-800 rounded-xl text-cyan-400"><GraduationCap className="h-6 w-6" /></div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm">Université</h4>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">Enseignement supérieur. Facultés, départements, cours, semestres et ECTS.</p>
                        </div>
                      </CardContent>
                    </Card>

                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" className="text-zinc-400" onClick={() => setWizardStep(1)}>Retour</Button>
                    <Button disabled={!selectedType} onClick={() => setWizardStep(3)}>Suivant →</Button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: CONFIRMATION & LOCKS ── */}
              {wizardStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                  <div className="space-y-1 text-center">
                    <h3 className="text-xl font-bold">Confirmer la configuration</h3>
                    <p className="text-xs text-zinc-400">Veuillez vérifier les conditions avant de continuer.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-xs flex gap-3 items-start">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Avertissement important</p>
                      <p className="leading-relaxed">
                        Le type d'établissement sélectionné ({selectedType === "CLASSIC" ? "École classique" : selectedType === "VOCATIONAL" ? "École professionnelle" : "Université"}) sera verrouillé de façon définitive pour cette entreprise. Vous ne pourrez pas le modifier sans l'assistance d'un Super Administrateur de WesdSystems.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                      className="border-zinc-700"
                    />
                    <label htmlFor="terms" className="text-xs text-zinc-300 select-none cursor-pointer leading-none">
                      Je confirme que ce choix est correct et correspond à la structure de mon établissement.
                    </label>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button variant="ghost" className="text-zinc-400" onClick={() => setWizardStep(2)}>Retour</Button>
                    <Button disabled={!termsAccepted} onClick={handleDeploy}>Confirmer et Déployer ✓</Button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: DEPLOYMENT PROGRESS ── */}
              {wizardStep === 4 && (
                <div className="text-center space-y-6 py-6 animate-in fade-in zoom-in duration-300">
                  <div className="h-12 w-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary animate-pulse">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">Déploiement du moteur académique...</h3>
                    <p className="text-xs text-zinc-400">Wesd School Engine configure vos entités relationnelles.</p>
                  </div>
                  <div className="w-full max-w-xs mx-auto bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${deployProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">{deployProgress}% complété</p>
                </div>
              )}

            </div>
          </DialogContent>
        </Dialog>
      )}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error("useSchool must be used within a SchoolProvider");
  }
  return context;
}

export function SchoolProviderWrapper() {
  return (
    <SchoolProvider>
      <Outlet />
    </SchoolProvider>
  );
}
