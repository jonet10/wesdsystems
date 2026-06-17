import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldOff,
  Trash2,
  Workflow,
} from "lucide-react";

type ModuleStatus = "complete" | "building" | "suspended" | "coming_soon";

interface PlatformModuleRow {
  id: string;
  name: string;
  vertical: string;
  status: ModuleStatus;
  progress: number;
  description: string;
  owner: string;
  updatedAt: string;
}

const STORAGE_KEY = "wesd-platform-modules";

const DEFAULT_MODULES: PlatformModuleRow[] = [
  {
    id: "salon",
    name: "Salon",
    vertical: "beauty",
    status: "complete",
    progress: 100,
    description: "Rendez-vous, POS, services, clients, inventaire et rapports.",
    owner: "Produit salon",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pharmacy",
    name: "Pharmacie",
    vertical: "pharmacy",
    status: "building",
    progress: 72,
    description: "Ordonnances, stock médicaments, caisse et flux de vente.",
    owner: "Produit pharmacie",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bar-restaurant",
    name: "Bar & resto",
    vertical: "food",
    status: "complete",
    progress: 100,
    description: "POS, commandes, cuisine, bar, inventaire et reporting.",
    owner: "Produit bar/resto",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "market",
    name: "Market",
    vertical: "retail",
    status: "building",
    progress: 58,
    description: "Caisse, inventaire, catalogues et multi-branch support.",
    owner: "Produit retail",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "boutique",
    name: "Boutique",
    vertical: "retail",
    status: "building",
    progress: 41,
    description: "Stocks, articles, ventes et caisse légère.",
    owner: "Produit boutique",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "auto-parts",
    name: "Pièces Auto",
    vertical: "automotive",
    status: "complete",
    progress: 100,
    description: "Catalogue pièces, stock, caisse, fournisseurs et compatibilité véhicules.",
    owner: "Produit pièces auto",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "school-payments",
    name: "Paiements Scolaires",
    vertical: "education",
    status: "complete",
    progress: 100,
    description: "Gestion des élèves, professeurs, frais scolaires, paiements et rapports financiers.",
    owner: "Produit éducation",
    updatedAt: new Date().toISOString(),
  },
];

function statusMeta(status: ModuleStatus) {
  switch (status) {
    case "complete":
      return { label: "Complet", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" };
    case "building":
      return { label: "En construction", className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" };
    case "suspended":
      return { label: "Suspendu", className: "bg-rose-500/15 text-rose-300 border-rose-500/20" };
    case "coming_soon":
      return { label: "À venir", className: "bg-amber-500/15 text-amber-300 border-amber-500/20" };
  }
}

function loadModules(): PlatformModuleRow[] {
  if (typeof window === "undefined") return DEFAULT_MODULES;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_MODULES;
  try {
    const parsed = JSON.parse(raw) as PlatformModuleRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_MODULES;
    const savedMap = new Map(parsed.map((m) => [m.id, m]));
    const merged = DEFAULT_MODULES.map((def) => {
      const saved = savedMap.get(def.id);
      return saved ? { ...def, ...saved, id: def.id } : def;
    });
    return merged;
  } catch {
    return DEFAULT_MODULES;
  }
}

export default function ModulesPage() {
  const [modules, setModules] = useState<PlatformModuleRow[]>(DEFAULT_MODULES);
  const [hydrated, setHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingModule, setEditingModule] = useState<PlatformModuleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editVertical, setEditVertical] = useState("");
  const [editProgress, setEditProgress] = useState(100);
  const [editOwner, setEditOwner] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    setModules(loadModules());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
  }, [hydrated, modules]);

  const filteredModules = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return modules
      .filter((module) => {
        const matchesSearch =
          !search ||
          [module.name, module.vertical, module.status, module.owner, module.description]
            .join(" ")
            .toLowerCase()
            .includes(search);
        const matchesStatus = statusFilter === "all" || module.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [modules, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: modules.length,
      complete: modules.filter((module) => module.status === "complete").length,
      building: modules.filter((module) => module.status === "building").length,
      suspended: modules.filter((module) => module.status === "suspended").length,
      comingSoon: modules.filter((module) => module.status === "coming_soon").length,
    };
  }, [modules]);

  const openEditor = (module: PlatformModuleRow) => {
    setEditingModule(module);
    setEditName(module.name);
    setEditVertical(module.vertical);
    setEditProgress(module.progress);
    setEditOwner(module.owner);
    setEditDescription(module.description);
  };

  const saveModule = () => {
    if (!editingModule) return;

    const nextStatus: ModuleStatus = editProgress >= 100 ? "complete" : editProgress <= 0 ? "suspended" : "building";

    setModules((current) =>
      current.map((module) =>
        module.id === editingModule.id
          ? {
              ...module,
              name: editName.trim() || module.name,
              vertical: editVertical.trim() || module.vertical,
              progress: Math.max(0, Math.min(100, editProgress)),
              status: nextStatus,
              owner: editOwner.trim() || module.owner,
              description: editDescription.trim() || module.description,
              updatedAt: new Date().toISOString(),
            }
          : module
      )
    );
    toast.success("Module mis à jour.");
    setEditingModule(null);
  };

  const toggleSuspend = (module: PlatformModuleRow) => {
    setModules((current) =>
      current.map((item) =>
        item.id === module.id
          ? {
              ...item,
              status: item.status === "suspended" ? (item.progress >= 100 ? "complete" : "building") : "suspended",
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    toast.success(module.status === "suspended" ? "Module réactivé." : "Module suspendu.");
  };

  const deleteModule = (module: PlatformModuleRow) => {
    const confirmed = window.confirm(`Supprimer définitivement le module ${module.name} ?`);
    if (!confirmed) return;
    setModules((current) => current.filter((item) => item.id !== module.id));
    toast.success("Module supprimé.");
  };

  const resetDefaults = () => {
    setModules(DEFAULT_MODULES);
    toast.success("Modules réinitialisés.");
  };

  return (
    <DashboardLayout
      role="super_admin"
      title="Modules de la plateforme"
      subtitle="Gérez les modules actifs, ceux en cours de construction et les modules suspendus."
      userName="Admin Wesd"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total modules</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Complets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-400">{stats.complete}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">En construction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyan-300">{stats.building}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Suspendus</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-rose-300">{stats.suspended}</p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative w-full md:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    placeholder="Rechercher un module, un statut ou une équipe..."
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="complete">Complet</SelectItem>
                    <SelectItem value="building">En construction</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                    <SelectItem value="coming_soon">À venir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={resetDefaults}>
                  Réinitialiser
                </Button>
                <Button variant="outline" onClick={() => setModules((current) => [...current])}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Rafraîchir
                </Button>
              </div>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredModules.map((module) => {
              const meta = statusMeta(module.status);
              return (
                <div key={module.id} className="rounded-2xl border border-border bg-card/85 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{module.name}</h3>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{module.owner}</p>
                    </div>
                    {module.status === "suspended" ? (
                      <ShieldOff className="h-5 w-5 text-rose-300" />
                    ) : module.status === "complete" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Clock3 className="h-5 w-5 text-cyan-300" />
                    )}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{module.description}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Verticale</div>
                      <div className="mt-1 text-sm font-medium capitalize">{module.vertical}</div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Progression</div>
                      <div className="mt-1 text-sm font-medium">{module.progress}%</div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      style={{ width: `${module.progress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditor(module)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleSuspend(module)}>
                      {module.status === "suspended" ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Réactiver
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Suspendre
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteModule(module)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>

                  <div className="mt-4 text-xs text-muted-foreground">
                    Mise à jour le {new Date(module.updatedAt).toLocaleString("fr-FR")}
                  </div>
                </div>
              );
            })}
          </div>
        </StaggerItem>

        {filteredModules.length === 0 && (
          <StaggerItem>
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
              <Workflow className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Aucun module ne correspond à vos filtres.</p>
            </div>
          </StaggerItem>
        )}

        <Dialog open={!!editingModule} onOpenChange={(open) => !open && setEditingModule(null)}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Modifier le module</DialogTitle>
              <DialogDescription>
                Ajustez le nom, la verticale, la progression et l’état d’un module de plateforme.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="module-name">Nom</Label>
                <Input id="module-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-owner">Équipe</Label>
                <Input id="module-owner" value={editOwner} onChange={(e) => setEditOwner(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-vertical">Verticale</Label>
                <Input id="module-vertical" value={editVertical} onChange={(e) => setEditVertical(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-progress">Progression (%)</Label>
                <Input
                  id="module-progress"
                  type="number"
                  min="0"
                  max="100"
                  value={editProgress}
                  onChange={(e) => setEditProgress(Number(e.target.value || 0))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-description">Description</Label>
                <Textarea
                  id="module-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditingModule(null)}>
                Annuler
              </Button>
              <Button type="button" onClick={saveModule}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
