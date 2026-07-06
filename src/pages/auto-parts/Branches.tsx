import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAutoPartsBranch } from "@/modules/auto-parts/hooks/useAutoPartsBranch";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Building2, Check, Trash2, Loader2, X } from "lucide-react";

export default function AutoPartsBranchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const businessId = useAutoPartsBusinessId();
  const { branches, branchId, setActiveBranchId, isLoading } = useAutoPartsBranch(businessId);
  const [localBranches, setLocalBranches] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [saving, setSaving] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (branches.length > 0) setLocalBranches(branches);
  }, [branches]);

  const handleCreate = async () => {
    if (!businessId || !name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("business_branches")
        .insert({ business_id: businessId, name: name.trim(), phone, email, address, active: true, business_type: businessType || null })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(`Établissement "${name}" créé`);
      setShowForm(false);
      setName(""); setPhone(""); setEmail(""); setAddress(""); setBusinessType("");
      const { data: updated } = await supabase
        .from("business_branches")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");
      setLocalBranches(updated || []);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!branchToDelete || !password) return;
    setDeleting(true);
    try {
      // Vérifier le mot de passe
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Utilisateur non trouvé");

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        toast.error("Mot de passe incorrect");
        setDeleting(false);
        return;
      }

      // Supprimer la branche
      const { error: deleteError } = await supabase
        .from("business_branches")
        .delete()
        .eq("id", branchToDelete.id);

      if (deleteError) throw deleteError;

      toast.success("Établissement supprimé");
      setLocalBranches(localBranches.filter(b => b.id !== branchToDelete.id));
      setBranchToDelete(null);
      setPassword("");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Établissements" subtitle="Gestion de vos différentes entreprises / établissements">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {localBranches.length} établissement{localBranches.length > 1 ? "s" : ""}
            </p>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Nouvel établissement</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localBranches.map((b) => (
              <Card
                key={b.id}
                className={`cursor-pointer transition-colors ${b.id === branchId ? "ring-2 ring-primary" : ""}`}
                onClick={() => {
                  setActiveBranchId(b.id);
                  if (b.business_type && b.business_type !== "auto_parts") {
                    // Si on était dans auto-parts, et qu'on clique sur un salon, on bascule
                    import("@/lib/store").then(({ glowupStore }) => {
                      glowupStore.setActiveBusiness(b.business_type as any);
                    const routes: Record<string, string> = {
                      salon: "/salon",
                      pharmacie: "/pharmacie",
                      restaurant: "/bar",
                      bar: "/bar",
                      market: "/market",
                      boutique: "/boutique",
                      auto_parts: "/auto-parts",
                      school_payments: "/school",
                    };
                      navigate(routes[b.business_type as string] || "/salon");
                    });
                  }
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">{b.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.id === branchId && <Badge><Check className="h-3 w-3 mr-1" /> Active</Badge>}
                      {b.id !== branchId && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBranchToDelete(b);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {b.phone && <p>Tél: {b.phone}</p>}
                  {b.email && <p>{b.email}</p>}
                  {b.address && <p>{b.address}</p>}
                  {!b.phone && !b.email && !b.address && (
                    <p className="italic">Aucune information</p>
                  )}
                </CardContent>
              </Card>
            ))}
            {localBranches.length === 0 && !isLoading && (
              <p className="col-span-full text-center text-muted-foreground py-12">
                Aucun établissement. Créez-en un pour commencer.
              </p>
            )}
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel établissement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Établissement Pétion-Ville" />
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Type de module (Optionnel)</Label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Hériter de l'entreprise (Pièces Auto)</option>
                <option value="salon">Salon de Beauté</option>
                <option value="pharmacie">Pharmacie</option>
                <option value="restaurant">Restaurant/Bar</option>
                <option value="market">Supermarché</option>
                <option value="boutique">Boutique</option>
                <option value="school_payments">École</option>
              </select>
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Création..." : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!branchToDelete} onOpenChange={(open) => {
        if (!open) { setBranchToDelete(null); setPassword(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Supprimer l'établissement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer <strong>{branchToDelete?.name}</strong> ? Cette action est irréversible et supprimera toutes les données associées (ventes, inventaire, etc.).
            </p>
            <div>
              <Label>Mot de passe requis pour confirmer</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Votre mot de passe"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchToDelete(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !password}>
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Suppression...</>
              ) : "Confirmer la suppression"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
