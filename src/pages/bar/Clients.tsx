import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Hotel,
  Wine,
  Star,
  Calendar,
  DollarSign,
  Pencil,
  Trash2,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { supabase } from "@/lib/supabase";
import { barRestoService } from "@/modules/restaurant/services/barRestoService";
import { toast } from "sonner";

export interface BarClient {
  id: string;
  branch_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  client_type: "HOTEL_GUEST" | "BAR_REGULAR" | "VIP" | "PASSAGE";
  notes?: string;
  total_visits: number;
  total_spent: number;
  last_visit?: string;
  created_at: string;
}

const DEFAULT_CLIENTS: BarClient[] = [
  {
    id: "bc-1",
    branch_id: "default",
    name: "Jean-Baptiste Pierre",
    phone: "+509 37 12 34 56",
    email: "jb.pierre@gmail.com",
    address: "Pétion-Ville",
    client_type: "HOTEL_GUEST",
    notes: "Préfère chambre 102 ou 201 avec climatisation forte.",
    total_visits: 5,
    total_spent: 17500,
    last_visit: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  },
  {
    id: "bc-2",
    branch_id: "default",
    name: "Marie Lourde Alexis",
    phone: "+509 36 98 74 12",
    email: "ml.alexis@yahoo.fr",
    address: "Delmas 75",
    client_type: "VIP",
    notes: "Consommation habituelle : Prestige Glacée & Fritay Tassot.",
    total_visits: 12,
    total_spent: 28400,
    last_visit: new Date().toISOString(),
    created_at: new Date(Date.now() - 60 * 86400 * 1000).toISOString(),
  },
  {
    id: "bc-3",
    branch_id: "default",
    name: "Daphné Saint-Vil",
    phone: "+509 48 55 21 00",
    client_type: "HOTEL_GUEST",
    notes: "Séjours réguliers par moment (2h).",
    total_visits: 4,
    total_spent: 6000,
    last_visit: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 15 * 86400 * 1000).toISOString(),
  },
  {
    id: "bc-4",
    branch_id: "default",
    name: "Frantz Voltaire",
    phone: "+509 34 22 11 99",
    client_type: "BAR_REGULAR",
    notes: "Client régulier des vendredis soirs & weekends.",
    total_visits: 9,
    total_spent: 14200,
    last_visit: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 45 * 86400 * 1000).toISOString(),
  },
];

export default function BarClients() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  const storageKey = `wesd_bar_clients_${effectiveBranchId}`;

  const [clients, setClients] = useState<BarClient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<BarClient | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    client_type: "HOTEL_GUEST" as BarClient["client_type"],
    notes: "",
  });

  // Load clients
  const loadClients = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setClients(JSON.parse(stored));
      } else {
        // Seed default clients
        const initial = DEFAULT_CLIENTS.map((c) => ({ ...c, branch_id: effectiveBranchId }));
        localStorage.setItem(storageKey, JSON.stringify(initial));
        setClients(initial);
      }
    } catch {
      setClients(DEFAULT_CLIENTS);
    }
  };

  useEffect(() => {
    loadClients();
  }, [effectiveBranchId]);

  const saveClients = (list: BarClient[]) => {
    setClients(list);
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      console.warn("Erreur sauvegarde locale clients", e);
    }
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: "",
      phone: "+509 ",
      email: "",
      address: "",
      client_type: "HOTEL_GUEST",
      notes: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (client: BarClient) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || "",
      address: client.address || "",
      client_type: client.client_type,
      notes: client.notes || "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      return toast.error("Le nom du client est obligatoire");
    }

    if (editingClient) {
      const updated = clients.map((c) =>
        c.id === editingClient.id
          ? {
              ...c,
              name: formData.name.trim(),
              phone: formData.phone.trim(),
              email: formData.email.trim() || undefined,
              address: formData.address.trim() || undefined,
              client_type: formData.client_type,
              notes: formData.notes.trim() || undefined,
            }
          : c
      );
      saveClients(updated);
      toast.success(`Fiche de ${formData.name} mise à jour !`);
    } else {
      const newClient: BarClient = {
        id: `bc-${Date.now()}`,
        branch_id: effectiveBranchId,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        client_type: formData.client_type,
        notes: formData.notes.trim() || undefined,
        total_visits: 1,
        total_spent: 0,
        last_visit: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      saveClients([newClient, ...clients]);
      toast.success(`Nouveau client ${formData.name} ajouté !`);
    }
    setModalOpen(false);
  };

  const handleDelete = (client: BarClient) => {
    if (confirm(`Confirmez-vous la suppression du client "${client.name}" ?`)) {
      const filtered = clients.filter((c) => c.id !== client.id);
      saveClients(filtered);
      toast.success("Client retiré de la liste");
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchType = filterType === "ALL" || c.client_type === filterType;
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [clients, filterType, searchQuery]);

  const stats = useMemo(() => {
    const total = clients.length;
    const hotelGuests = clients.filter((c) => c.client_type === "HOTEL_GUEST").length;
    const barRegulars = clients.filter((c) => c.client_type === "BAR_REGULAR").length;
    const vip = clients.filter((c) => c.client_type === "VIP").length;
    const totalSpentSum = clients.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    return { total, hotelGuests, barRegulars, vip, totalSpentSum };
  }, [clients]);

  return (
    <DashboardLayout
      role="salon_admin"
      title="Clients & Séjours"
      subtitle="Répertoire des clients du bar-restaurant et des résidents d'hôtel (Bar, Resto & Hôtel)"
    >
      <StaggerContainer className="space-y-6">
        {/* KPI Summary */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/60 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">
                    Total Clients
                  </p>
                  <p className="text-2xl font-black text-foreground">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-primary/70" />
              </CardContent>
            </Card>

            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wide">
                    Résidents Hôtel
                  </p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {stats.hotelGuests}
                  </p>
                </div>
                <Hotel className="h-8 w-8 text-indigo-500/70" />
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide">
                    Habitués Bar & Resto
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {stats.barRegulars}
                  </p>
                </div>
                <Wine className="h-8 w-8 text-amber-500/70" />
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wide">
                    Clients VIP
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.vip}
                  </p>
                </div>
                <Star className="h-8 w-8 text-emerald-500/70" />
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        {/* Toolbar & Filters */}
        <StaggerItem>
          <Card className="border-border/60">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant={filterType === "ALL" ? "default" : "outline"}
                  onClick={() => setFilterType("ALL")}
                  className="font-bold text-xs"
                >
                  Tous ({stats.total})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "HOTEL_GUEST" ? "default" : "outline"}
                  onClick={() => setFilterType("HOTEL_GUEST")}
                  className="gap-1 font-bold text-xs text-indigo-600"
                >
                  <Hotel className="h-3.5 w-3.5" /> Résidents Hôtel ({stats.hotelGuests})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "BAR_REGULAR" ? "default" : "outline"}
                  onClick={() => setFilterType("BAR_REGULAR")}
                  className="gap-1 font-bold text-xs text-amber-600"
                >
                  <Wine className="h-3.5 w-3.5" /> Bar & Resto ({stats.barRegulars})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "VIP" ? "default" : "outline"}
                  onClick={() => setFilterType("VIP")}
                  className="gap-1 font-bold text-xs text-emerald-600"
                >
                  <Star className="h-3.5 w-3.5" /> VIP ({stats.vip})
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom, téléphone, note..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <Button size="sm" onClick={handleOpenAdd} className="gap-1 font-bold whitespace-nowrap">
                  <UserPlus className="h-4 w-4" /> Nouveau Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Client List */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => {
              const isHotel = client.client_type === "HOTEL_GUEST";
              const isVIP = client.client_type === "VIP";
              const isRegular = client.client_type === "BAR_REGULAR";

              return (
                <Card key={client.id} className="border-border/60 hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-sm uppercase">
                          {client.name.substring(0, 2)}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">{client.name}</CardTitle>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {client.phone}
                          </p>
                        </div>
                      </div>

                      {isHotel && (
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold gap-1">
                          <Hotel className="h-3 w-3" /> Hôtel
                        </Badge>
                      )}
                      {isVIP && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold gap-1">
                          <Star className="h-3 w-3" /> VIP
                        </Badge>
                      )}
                      {isRegular && (
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-[10px] font-bold gap-1">
                          <Wine className="h-3 w-3" /> Bar
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    {client.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" /> {client.address}
                      </p>
                    )}

                    {client.notes && (
                      <div className="p-2 rounded bg-muted/40 text-xs text-muted-foreground border border-border/50 italic">
                        "{client.notes}"
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                          Séjours / Visites
                        </span>
                        <span className="font-bold text-foreground">{client.total_visits} fois</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                          Total Dépensé
                        </span>
                        <span className="font-black text-primary">
                          {format(client.total_spent || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs gap-1 h-8"
                        onClick={() => handleOpenEdit(client)}
                      >
                        <Pencil className="h-3 w-3" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-destructive hover:bg-destructive/10 h-8 px-2"
                        onClick={() => handleDelete(client)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Aucun client trouvé pour cette recherche ou ce filtre.
            </div>
          )}
        </StaggerItem>
      </StaggerContainer>

      {/* Modal Add / Edit Client */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="h-5 w-5 text-primary" />
              {editingClient ? "Modifier la fiche client" : "Ajouter un Client / Résident"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fiche client pour le Bar, Restaurant et l'Hôtel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-xs font-bold">
                Nom & Prénom *
              </Label>
              <Input
                id="client-name"
                placeholder="Ex: Jean-Baptiste Pierre"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-phone" className="text-xs font-bold">
                  Téléphone / WhatsApp
                </Label>
                <Input
                  id="client-phone"
                  placeholder="+509 37 00 00 00"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-type" className="text-xs font-bold">
                  Catégorie
                </Label>
                <select
                  id="client-type"
                  value={formData.client_type}
                  onChange={(e) =>
                    setFormData({ ...formData, client_type: e.target.value as any })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="HOTEL_GUEST">Résident Hôtel</option>
                  <option value="BAR_REGULAR">Habitué Bar & Resto</option>
                  <option value="VIP">Client VIP</option>
                  <option value="PASSAGE">Client de Passage</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-email" className="text-xs font-bold">
                  Email (Optionnel)
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="client@mail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-address" className="text-xs font-bold">
                  Adresse / Ville
                </Label>
                <Input
                  id="client-address"
                  placeholder="Ex: Pétion-Ville, Delmas"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-notes" className="text-xs font-bold">
                Notes / Préférences
              </Label>
              <Input
                id="client-notes"
                placeholder="Ex: Boisson préférée, préférence de chambre..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} className="font-bold">
              {editingClient ? "Sauvegarder" : "Créer le client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
