import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Phone, Mail, Calendar, MoreHorizontal, User, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { glowupStore, Client } from "@/lib/store";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useActiveBranchId } from "@/lib/branch";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { PrintHeader } from "@/components/shared/PrintHeader";
import { Printer, AlertCircle } from "lucide-react";

export default function ClientsPage() {
  const { isAuthenticated, profile } = useAuth();

  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [], isFetching: branchesFetching } = useBusinessBranches();
  
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((b) => b.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);

  const [clientsDb, setClientsDb] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const loadClients = async () => {
    try {
      setClientsLoading(true);
      if (!activeBranchId) {
        setClientsDb([]);
        return;
      }

      const { data, error } = await supabase
        .from("salon_customers")
        .select("*")
        .eq("is_active", true)
        .eq("branch_id", activeBranchId)
        .order("first_name");
      if (error) throw error;
      setClientsDb(data || []);
    } catch (err: any) {
      console.warn("Erreur chargement clients:", err.message);
    } finally {
      setClientsLoading(false);
    }
  };

  // Ne charger qu'une seule fois quand l'utilisateur est authentifié
  useEffect(() => {
    if (isAuthenticated) {
      void loadClients();
    } else {
      setClientsLoading(false);
    }
  }, [activeBranchId, isAuthenticated]);

  const { currency, format } = useCurrency();
  const [localClients, setLocalClients] = useState<Client[]>(glowupStore.getClients());

  useEffect(() => {
    const handleUpdate = () => setLocalClients(glowupStore.getClients());
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const normalizeClientRow = (client: any): Client => ({
    id: client.id,
    name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
    email: client.email || "",
    phone: client.phone || "",
    lastVisit: client.last_visit ? new Date(client.last_visit).toLocaleDateString() : "Jamais",
    visits: client.visit_count || 0,
    totalSpent: client.total_spent ? format(client.total_spent) : format(0),
  });

  const clients = useMemo(() => {
    if (isAuthenticated) {
      return clientsDb.map(normalizeClientRow);
    }
    return localClients.map(c => {
      const rawString = String(c.totalSpent).replace(/[^\d.-]/g, '');
      const amt = parseFloat(rawString);
      return { ...c, totalSpent: format(isNaN(amt) ? 0 : amt) };
    });
  }, [clientsDb, localClients, format, isAuthenticated]);

  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error("Veuillez renseigner le nom et le téléphone.");
      return;
    }
    
    if (isAuthenticated) {
      if (!activeBranchId) return toast.error("Aucune branche sélectionnée");
      
      const parts = name.trim().split(" ");
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");
      
      try {
        const { error } = await supabase.from("salon_customers").insert([{
          branch_id: activeBranchId,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone
        }]);
        if (error) throw error;
        toast.success(`Le client "${name}" a été ajouté.`);
        setIsAddOpen(false);
        resetForm();
        void loadClients();
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      glowupStore.addClient({ name, email, phone });
      toast.success(`Le client "${name}" a été ajouté (Local).`);
      setIsAddOpen(false);
      resetForm();
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !name || !phone) return;

    if (isAuthenticated && selectedClient.id.includes('-')) {
      const parts = name.trim().split(" ");
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");
      
      try {
        const { error } = await supabase.from("salon_customers").update({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone
        }).eq("id", selectedClient.id).eq("branch_id", activeBranchId);
        
        if (error) throw error;
        toast.success(`Le profil de "${name}" a été mis à jour.`);
        setIsEditOpen(false);
        resetForm();
        void loadClients();
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      glowupStore.updateClient({ ...selectedClient, name, email, phone });
      toast.success(`Le profil de "${name}" a été mis à jour (Local).`);
      setIsEditOpen(false);
      resetForm();
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    if (isAuthenticated && selectedClient.id.includes('-')) {
      try {
        const { error } = await supabase.from("salon_customers").update({ is_active: false }).eq("id", selectedClient.id).eq("branch_id", activeBranchId);
        if (error) throw error;
        toast.success(`Le client "${selectedClient.name}" a été supprimé.`);
        setIsDeleteOpen(false);
        setSelectedClient(null);
        void loadClients();
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      glowupStore.deleteClient(selectedClient.id);
      toast.success(`Le client "${selectedClient.name}" a été supprimé (Local).`);
      setIsDeleteOpen(false);
      setSelectedClient(null);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSelectedClient(null);
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setName(client.name);
    setEmail(client.email);
    setPhone(client.phone);
    setIsEditOpen(true);
  };

  const openDeleteModal = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteOpen(true);
  };

  const filteredClients = clients.filter((client: Client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone.includes(searchQuery)
  );

  if ((isAuthenticated && branchesFetching) || (isAuthenticated && !activeBranchId)) {
    return (
      <DashboardLayout
        role="salon_admin"
        title="Clients"
        subtitle="Initialisation du salon..."
        userName="Marie Laurent"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card/95 p-8 text-center shadow-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">La base clients se prépare</h2>
            <p className="text-muted-foreground">
              Nous finalisons la branche principale de ce nouveau salon. Les clients pourront être ajoutés dès que l’initialisation est terminée.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="salon_admin"
      title="Clients"
      subtitle="Gérez votre base clients"
      userName="Marie Laurent"
    >
      <div className="print-header-container">
        <PrintHeader />
      </div>
      <StaggerContainer className="space-y-6">
        {/* Actions Bar */}
        <StaggerItem>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between no-print">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client (nom, tel, email)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button variant="outline" onClick={() => window.print()} className="w-full md:w-auto">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
              <Button variant="hero" onClick={() => { resetForm(); setIsAddOpen(true); }} className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau client
              </Button>
            </div>
          </div>
        </StaggerItem>

        {/* Clients Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <div key={client.id} className="bg-card rounded-xl border border-border p-6 hover:shadow-soft transition-all flex flex-col justify-between h-[260px]">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                        {client.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base line-clamp-1">{client.name}</h3>
                        <p className="text-sm text-muted-foreground">{client.visits} {client.visits > 1 ? "visites" : "visite"}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-lg border border-border">
                        <DropdownMenuItem onClick={() => openEditModal(client)} className="flex items-center gap-2 cursor-pointer">
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Modifier</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/salon/appointments")} className="flex items-center gap-2 cursor-pointer">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Prendre RDV</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteModal(client)} className="flex items-center gap-2 text-destructive hover:text-destructive cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Supprimer</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{client.email || "Non renseigné"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>Dernière visite: {client.lastVisit}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                  <span className="text-sm text-muted-foreground">Total dépensé</span>
                  <span className="font-semibold text-primary">{client.totalSpent}</span>
                </div>
              </div>
            ))}
          </div>
        </StaggerItem>

        {filteredClients.length === 0 && (
          <StaggerItem>
            <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
              <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Aucun client trouvé.</p>
            </div>
          </StaggerItem>
        )}

        {/* ADD CLIENT DIALOG */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nouveau client</DialogTitle>
              <DialogDescription>
                Créez une fiche client pour pouvoir lui attribuer des rendez-vous et suivre ses statistiques.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddClient} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-cli-name">Nom complet *</Label>
                <Input id="add-cli-name" placeholder="Ex: Jean Martin" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-cli-email">Adresse Email</Label>
                <Input id="add-cli-email" type="email" placeholder="Ex: jean.martin@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-cli-phone">Numéro de Téléphone *</Label>
                <Input id="add-cli-phone" placeholder="Ex: 06 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero">Créer la fiche</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT CLIENT DIALOG */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Modifier le client</DialogTitle>
              <DialogDescription>
                Mettez à jour les coordonnées de ce client.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditClient} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cli-name">Nom complet *</Label>
                <Input id="edit-cli-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cli-email">Adresse Email</Label>
                <Input id="edit-cli-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cli-phone">Numéro de Téléphone *</Label>
                <Input id="edit-cli-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero">Mettre à jour</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRM DIALOG */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Supprimer la fiche client</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer la fiche de <strong>{selectedClient?.name}</strong> ? Cette action supprimera également son historique d'achats du fichier clients.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Annuler</Button>
              <Button type="button" variant="destructive" onClick={handleDeleteClient}>Supprimer définitivement</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
