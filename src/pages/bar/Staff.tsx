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
  UserCog,
  UserPlus,
  Search,
  Phone,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Wine,
  UtensilsCrossed,
  Hotel,
  DollarSign,
  Pencil,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveBranchId } from "@/lib/branch";
import { toast } from "sonner";

export type BarStaffRole =
  | "BARMAN"
  | "SERVEUR"
  | "HOTEL_RECEPTION"
  | "CHEF_CUISINIER"
  | "CAISSIER"
  | "GERANT";

export interface BarStaffMember {
  id: string;
  branch_id: string;
  name: string;
  role: BarStaffRole;
  phone: string;
  pin_code: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

const ROLE_INFO: Record<BarStaffRole, { label: string; icon: any; color: string }> = {
  BARMAN: { label: "Barman / Mixologue", icon: Wine, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  SERVEUR: { label: "Serveur / Serveuse", icon: UtensilsCrossed, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  HOTEL_RECEPTION: { label: "Réceptionniste Hôtel", icon: Hotel, color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30" },
  CHEF_CUISINIER: { label: "Chef Cuisinier", icon: UtensilsCrossed, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  CAISSIER: { label: "Caissier(ère) POS", icon: DollarSign, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  GERANT: { label: "Gérant / Manager", icon: ShieldCheck, color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30" },
};

const DEFAULT_STAFF: BarStaffMember[] = [
  {
    id: "bs-1",
    branch_id: "default",
    name: "Fabrice Michel",
    role: "BARMAN",
    phone: "+509 37 44 11 22",
    pin_code: "1234",
    is_active: true,
    notes: "Responsable du bar central & cocktails signature",
    created_at: new Date(Date.now() - 90 * 86400 * 1000).toISOString(),
  },
  {
    id: "bs-2",
    branch_id: "default",
    name: "Nathalie Dorsainvil",
    role: "HOTEL_RECEPTION",
    phone: "+509 38 12 45 78",
    pin_code: "2468",
    is_active: true,
    notes: "Accueil clients hôtel, check-in moments 2h & nuitées",
    created_at: new Date(Date.now() - 60 * 86400 * 1000).toISOString(),
  },
  {
    id: "bs-3",
    branch_id: "default",
    name: "Samuel Jean",
    role: "CHEF_CUISINIER",
    phone: "+509 46 88 99 10",
    pin_code: "1357",
    is_active: true,
    notes: "Chef de cuisine, spécialité Griot & Fritay Créole",
    created_at: new Date(Date.now() - 120 * 86400 * 1000).toISOString(),
  },
  {
    id: "bs-4",
    branch_id: "default",
    name: "Roseline Pierre",
    role: "CAISSIER",
    phone: "+509 31 55 44 33",
    pin_code: "4321",
    is_active: true,
    notes: "Caisse principale Bar & Restaurant",
    created_at: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  },
  {
    id: "bs-5",
    branch_id: "default",
    name: "Jean Jude Moïse",
    role: "SERVEUR",
    phone: "+509 34 87 65 12",
    pin_code: "5678",
    is_active: true,
    notes: "Service terrasse et salle restaurant",
    created_at: new Date(Date.now() - 40 * 86400 * 1000).toISOString(),
  },
];

export default function BarStaff() {
  const { profile } = useAuth();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  const storageKey = `wesd_bar_staff_${effectiveBranchId}`;

  const [staff, setStaff] = useState<BarStaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<BarStaffMember | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    role: "SERVEUR" as BarStaffRole,
    phone: "",
    pin_code: "",
    is_active: true,
    notes: "",
  });

  const loadStaff = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setStaff(JSON.parse(stored));
      } else {
        const initial = DEFAULT_STAFF.map((s) => ({ ...s, branch_id: effectiveBranchId }));
        localStorage.setItem(storageKey, JSON.stringify(initial));
        setStaff(initial);
      }
    } catch {
      setStaff(DEFAULT_STAFF);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [effectiveBranchId]);

  const saveStaff = (list: BarStaffMember[]) => {
    setStaff(list);
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      console.warn("Erreur sauvegarde locale personnel", e);
    }
  };

  const handleOpenAdd = () => {
    setEditingStaff(null);
    const randomPin = String(Math.floor(1000 + Math.random() * 9000));
    setFormData({
      name: "",
      role: "SERVEUR",
      phone: "+509 ",
      pin_code: randomPin,
      is_active: true,
      notes: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (member: BarStaffMember) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      role: member.role,
      phone: member.phone,
      pin_code: member.pin_code,
      is_active: member.is_active,
      notes: member.notes || "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      return toast.error("Le nom de l'employé est obligatoire");
    }
    if (!formData.pin_code.trim()) {
      return toast.error("Le code PIN est obligatoire");
    }

    if (editingStaff) {
      const updated = staff.map((s) =>
        s.id === editingStaff.id
          ? {
              ...s,
              name: formData.name.trim(),
              role: formData.role,
              phone: formData.phone.trim(),
              pin_code: formData.pin_code.trim(),
              is_active: formData.is_active,
              notes: formData.notes.trim() || undefined,
            }
          : s
      );
      saveStaff(updated);
      toast.success(`Employé ${formData.name} mis à jour !`);
    } else {
      const newMember: BarStaffMember = {
        id: `bs-${Date.now()}`,
        branch_id: effectiveBranchId,
        name: formData.name.trim(),
        role: formData.role,
        phone: formData.phone.trim(),
        pin_code: formData.pin_code.trim(),
        is_active: formData.is_active,
        notes: formData.notes.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      saveStaff([newMember, ...staff]);
      toast.success(`Nouveau membre ${formData.name} ajouté !`);
    }
    setModalOpen(false);
  };

  const handleToggleActive = (member: BarStaffMember) => {
    const updated = staff.map((s) =>
      s.id === member.id ? { ...s, is_active: !s.is_active } : s
    );
    saveStaff(updated);
    toast.info(`${member.name} est maintenant ${!member.is_active ? "Actif" : "Inactif"}`);
  };

  const handleDelete = (member: BarStaffMember) => {
    if (confirm(`Confirmez-vous la suppression de ${member.name} du personnel ?`)) {
      const filtered = staff.filter((s) => s.id !== member.id);
      saveStaff(filtered);
      toast.success("Membre retiré du personnel");
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchRole = roleFilter === "ALL" || s.role === roleFilter;
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery) ||
        (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchRole && matchSearch;
    });
  }, [staff, roleFilter, searchQuery]);

  return (
    <DashboardLayout
      role="salon_admin"
      title="Personnel"
      subtitle="Gestion des employés, barmans, serveurs, réceptionnistes hôtel et caissiers"
    >
      <StaggerContainer className="space-y-6">
        {/* KPI Cards */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/60 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">
                    Total Personnel
                  </p>
                  <p className="text-2xl font-black text-foreground">{staff.length}</p>
                </div>
                <UserCog className="h-8 w-8 text-primary/70" />
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wide">
                    Actifs
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {staff.filter((s) => s.is_active).length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide">
                    Service Bar & Salle
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {staff.filter((s) => s.role === "BARMAN" || s.role === "SERVEUR").length}
                  </p>
                </div>
                <Wine className="h-8 w-8 text-amber-500/70" />
              </CardContent>
            </Card>

            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wide">
                    Réception Hôtel
                  </p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {staff.filter((s) => s.role === "HOTEL_RECEPTION").length}
                  </p>
                </div>
                <Hotel className="h-8 w-8 text-indigo-500/70" />
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        {/* Action & Filter Toolbar */}
        <StaggerItem>
          <Card className="border-border/60">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant={roleFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setRoleFilter("ALL")}
                  className="font-bold text-xs"
                >
                  Tous ({staff.length})
                </Button>
                <Button
                  size="sm"
                  variant={roleFilter === "BARMAN" ? "default" : "outline"}
                  onClick={() => setRoleFilter("BARMAN")}
                  className="gap-1 font-bold text-xs text-amber-600"
                >
                  <Wine className="h-3.5 w-3.5" /> Barmans
                </Button>
                <Button
                  size="sm"
                  variant={roleFilter === "SERVEUR" ? "default" : "outline"}
                  onClick={() => setRoleFilter("SERVEUR")}
                  className="gap-1 font-bold text-xs text-blue-600"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Serveurs
                </Button>
                <Button
                  size="sm"
                  variant={roleFilter === "HOTEL_RECEPTION" ? "default" : "outline"}
                  onClick={() => setRoleFilter("HOTEL_RECEPTION")}
                  className="gap-1 font-bold text-xs text-indigo-600"
                >
                  <Hotel className="h-3.5 w-3.5" /> Hôtel
                </Button>
                <Button
                  size="sm"
                  variant={roleFilter === "CAISSIER" ? "default" : "outline"}
                  onClick={() => setRoleFilter("CAISSIER")}
                  className="gap-1 font-bold text-xs text-emerald-600"
                >
                  <DollarSign className="h-3.5 w-3.5" /> Caisse
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom, téléphone, poste..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <Button size="sm" onClick={handleOpenAdd} className="gap-1 font-bold whitespace-nowrap">
                  <UserPlus className="h-4 w-4" /> Nouvel Employé
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Staff Cards */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((member) => {
              const roleInfo = ROLE_INFO[member.role] || ROLE_INFO.SERVEUR;
              const RoleIcon = roleInfo.icon;

              return (
                <Card
                  key={member.id}
                  className={`border transition-all hover:shadow-md ${
                    !member.is_active ? "opacity-60 bg-muted/30" : "bg-card"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-base">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">{member.name}</CardTitle>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {member.phone}
                          </p>
                        </div>
                      </div>

                      <Badge className={`text-[10px] font-bold border ${roleInfo.color} gap-1`}>
                        <RoleIcon className="h-3 w-3" />
                        {roleInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    {member.notes && (
                      <p className="text-xs text-muted-foreground italic">"{member.notes}"</p>
                    )}

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground font-sans">Code PIN Caisse :</span>
                        <span className="font-black text-foreground tracking-wider bg-background px-2 py-0.5 rounded border">
                          {member.pin_code}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] cursor-pointer ${
                          member.is_active
                            ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                            : "text-muted-foreground"
                        }`}
                        onClick={() => handleToggleActive(member)}
                      >
                        {member.is_active ? "● Actif" : "○ Inactif"}
                      </Badge>
                    </div>

                    <div className="flex gap-2 pt-1 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs gap-1 h-8"
                        onClick={() => handleOpenEdit(member)}
                      >
                        <Pencil className="h-3 w-3" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-destructive hover:bg-destructive/10 h-8 px-2"
                        onClick={() => handleDelete(member)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredStaff.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Aucun employé trouvé avec ces critères.
            </div>
          )}
        </StaggerItem>
      </StaggerContainer>

      {/* Modal Add / Edit Staff */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <UserCog className="h-5 w-5 text-primary" />
              {editingStaff ? "Modifier l'employé" : "Ajouter un Employé"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Définissez le rôle et le code PIN de connexion caisse de l'employé.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name" className="text-xs font-bold">
                Nom Complet *
              </Label>
              <Input
                id="staff-name"
                placeholder="Ex: Fabrice Michel"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff-role" className="text-xs font-bold">
                  Poste / Rôle
                </Label>
                <select
                  id="staff-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as BarStaffRole })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="BARMAN">Barman / Mixologue</option>
                  <option value="SERVEUR">Serveur / Serveuse</option>
                  <option value="HOTEL_RECEPTION">Réceptionniste Hôtel</option>
                  <option value="CHEF_CUISINIER">Chef Cuisinier</option>
                  <option value="CAISSIER">Caissier(ère) POS</option>
                  <option value="GERANT">Gérant / Manager</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-phone" className="text-xs font-bold">
                  Téléphone
                </Label>
                <Input
                  id="staff-phone"
                  placeholder="+509 37 00 00 00"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="staff-pin" className="text-xs font-bold">
                    Code PIN Caisse (4-6 chiffres)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-[10px] text-primary"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        pin_code: String(Math.floor(1000 + Math.random() * 9000)),
                      })
                    }
                  >
                    Générer
                  </Button>
                </div>
                <Input
                  id="staff-pin"
                  placeholder="Ex: 1234"
                  value={formData.pin_code}
                  maxLength={6}
                  onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                  className="font-mono text-center tracking-widest font-black"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-status" className="text-xs font-bold">
                  Statut
                </Label>
                <select
                  id="staff-status"
                  value={formData.is_active ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.value === "ACTIVE" })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ACTIVE">Actif au service</option>
                  <option value="INACTIVE">Inactif / En congé</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-notes" className="text-xs font-bold">
                Notes ou zone attribuée
              </Label>
              <Input
                id="staff-notes"
                placeholder="Ex: Bar central, Terrasse VIP, Étage 1..."
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
              {editingStaff ? "Sauvegarder" : "Créer l'employé"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
