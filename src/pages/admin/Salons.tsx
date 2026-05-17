import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Building2, Pencil, Trash2, CheckCircle, AlertTriangle, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { glowupStore, Salon } from "@/lib/store";
import { toast } from "sonner";

export default function SalonsPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [plan, setPlan] = useState<"Basic" | "Pro" | "Premium">("Pro");
  const [status, setStatus] = useState<"active" | "expiring" | "expired">("active");

  const loadSalons = () => {
    setSalons(glowupStore.getSalons());
  };

  useEffect(() => {
    loadSalons();
    
    // Register store update listener
    const handleUpdate = () => {
      loadSalons();
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const handleAddSalon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !owner) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    glowupStore.addSalon({
      name,
      owner,
      plan,
      status,
      date: new Date().toISOString().split("T")[0]
    });
    toast.success(`Le salon "${name}" a été créé avec succès !`);
    setIsAddOpen(false);
    resetForm();
  };

  const handleEditSalon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalon || !name || !owner) return;
    
    glowupStore.updateSalon({
      ...selectedSalon,
      name,
      owner,
      plan,
      status
    });
    toast.success(`Le salon "${name}" a été modifié avec succès !`);
    setIsEditOpen(false);
    resetForm();
  };

  const handleDeleteSalon = () => {
    if (!selectedSalon) return;
    glowupStore.deleteSalon(selectedSalon.id);
    toast.success(`Le salon "${selectedSalon.name}" a été supprimé.`);
    setIsDeleteOpen(false);
    setSelectedSalon(null);
  };

  const resetForm = () => {
    setName("");
    setOwner("");
    setPlan("Pro");
    setStatus("active");
    setSelectedSalon(null);
  };

  const openEditModal = (salon: Salon) => {
    setSelectedSalon(salon);
    setName(salon.name);
    setOwner(salon.owner);
    setPlan(salon.plan);
    setStatus(salon.status);
    setIsEditOpen(true);
  };

  const openDeleteModal = (salon: Salon) => {
    setSelectedSalon(salon);
    setIsDeleteOpen(true);
  };

  const filteredSalons = salons.filter(salon => {
    const matchesSearch = salon.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          salon.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || salon.status === statusFilter;
    const matchesPlan = planFilter === "all" || salon.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <DashboardLayout
      role="super_admin"
      title="Gestion des Salons"
      subtitle="Supervisez les établissements abonnés à GlowUp"
      userName="Admin GlowUp"
    >
      <StaggerContainer className="space-y-6">
        {/* Actions Bar */}
        <StaggerItem>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1 max-w-2xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par salon ou gérant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="expiring">Expire bientôt</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les plans</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="hero" onClick={() => { resetForm(); setIsAddOpen(true); }} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau salon
            </Button>
          </div>
        </StaggerItem>

        {/* Salons List Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSalons.map((salon) => (
              <div key={salon.id} className="bg-card rounded-xl border border-border p-6 hover:shadow-soft transition-all relative overflow-hidden flex flex-col justify-between h-[230px]">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                        {salon.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1">{salon.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <User className="h-3.5 w-3.5" />
                          <span>{salon.owner}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      salon.plan === "Premium" ? "bg-warning/20 text-warning" :
                      salon.plan === "Pro" ? "bg-primary/20 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {salon.plan}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Créé le :</span>
                      <span className="font-medium text-foreground">{salon.date.split("-").reverse().join("/")}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Statut d'abonnement :</span>
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        salon.status === "active" ? "text-success" :
                        salon.status === "expiring" ? "text-warning" :
                        "text-destructive"
                      }`}>
                        {salon.status === "active" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span className="capitalize text-xs">{salon.status === "expiring" ? "Expire bientôt" : salon.status === "expired" ? "Expiré" : "Actif"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(salon)} className="h-8">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openDeleteModal(salon)} className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </StaggerItem>

        {filteredSalons.length === 0 && (
          <StaggerItem>
            <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Aucun salon ne correspond à vos critères de recherche.</p>
            </div>
          </StaggerItem>
        )}

        {/* ADD SALON DIALOG */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Ajouter un nouveau salon</DialogTitle>
              <DialogDescription>
                Créez une fiche d'établissement abonné à la plateforme GlowUp.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSalon} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Nom du Salon *</Label>
                <Input id="add-name" placeholder="Ex: Barber Paris" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-owner">Nom du Propriétaire / Gérant *</Label>
                <Input id="add-owner" placeholder="Ex: Jean Dupont" value={owner} onChange={(e) => setOwner(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-plan">Formule d'Abonnement</Label>
                  <Select value={plan} onValueChange={(val: any) => setPlan(val)}>
                    <SelectTrigger id="add-plan">
                      <SelectValue placeholder="Choisir un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic (29€/m)</SelectItem>
                      <SelectItem value="Pro">Pro (59€/m)</SelectItem>
                      <SelectItem value="Premium">Premium (99€/m)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-status">Statut de Facturation</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger id="add-status">
                      <SelectValue placeholder="Choisir un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="expiring">Expire bientôt</SelectItem>
                      <SelectItem value="expired">Expiré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero">Créer le salon</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT SALON DIALOG */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Modifier le salon</DialogTitle>
              <DialogDescription>
                Mettez à jour les informations et le statut d'abonnement de cet établissement.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSalon} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom du Salon *</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-owner">Nom du Propriétaire / Gérant *</Label>
                <Input id="edit-owner" value={owner} onChange={(e) => setOwner(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-plan">Formule d'Abonnement</Label>
                  <Select value={plan} onValueChange={(val: any) => setPlan(val)}>
                    <SelectTrigger id="edit-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic (29€/m)</SelectItem>
                      <SelectItem value="Pro">Pro (59€/m)</SelectItem>
                      <SelectItem value="Premium">Premium (99€/m)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Statut de Facturation</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="expiring">Expire bientôt</SelectItem>
                      <SelectItem value="expired">Expiré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero">Enregistrer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION DIALOG */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Supprimer le salon</DialogTitle>
              <DialogDescription>
                Êtes-vous absolument sûr de vouloir supprimer le salon <strong>{selectedSalon?.name}</strong> ? Cette action est irréversible et révoquera immédiatement tout accès à la plateforme pour cet établissement.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Annuler</Button>
              <Button type="button" variant="destructive" onClick={handleDeleteSalon}>Supprimer définitivement</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
