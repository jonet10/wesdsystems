import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useActiveBranchId } from "@/lib/branch";
import { toast } from "sonner";
import { Search, Plus, Clock, Pencil, Trash2, Scissors } from "lucide-react";

type ServiceCategory = {
  id: string;
  name: string;
  description?: string | null;
};

type SalonService = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price_htg: number;
  category_id?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  metadata?: Record<string, any> | null;
};

const FALLBACK_CATEGORIES = ["Pédicure", "Manicure", "Coiffure / Beauté"];

export default function ServicesPage() {
  const { profile } = useAuth();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [] } = useBusinessBranches();
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<SalonService | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [categoryName, setCategoryName] = useState("Pédicure");
  const [active, setActive] = useState(true);
  const [addonOptions, setAddonOptions] = useState("Fleur,Charme,Breloque");

  const loadData = async (branchIdToUse: string | null) => {
    try {
      setLoading(true);
      if (!branchIdToUse) {
        setCategories([]);
        setServices([]);
        return;
      }

      const [categoriesRes, servicesRes] = await Promise.all([
        supabase
          .from("salon_service_categories")
          .select("id, name, description")
          .eq("branch_id", branchIdToUse)
          .order("sort_order"),
        supabase
          .from("salon_services")
          .select("id, name, description, duration_minutes, price_htg, category_id, is_active, sort_order, metadata")
          .eq("branch_id", branchIdToUse)
          .order("sort_order"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const fetchedCategories = (categoriesRes.data || []) as ServiceCategory[];
      setCategories(fetchedCategories.length ? fetchedCategories : FALLBACK_CATEGORIES.map((name) => ({ id: name, name })));
      setServices((servicesRes.data || []) as SalonService[]);
    } catch (err: any) {
      toast.error(err.message || "Erreur chargement services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(activeBranchId);
  }, [activeBranchId]);

  const resetForm = () => {
    setSelectedService(null);
    setName("");
    setDescription("");
    setDuration(60);
    setPrice(0);
    setCategoryName("Pédicure");
    setActive(true);
    setAddonOptions("Fleur,Charme,Breloque");
  };

  const categoryList = useMemo(() => {
    const list = categories.length ? categories : FALLBACK_CATEGORIES.map((name) => ({ id: name, name }));
    return ["Tous", ...list.map((cat) => cat.name)];
  }, [categories]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch = [service.name, service.description || ""].join(" ").toLowerCase().includes(searchQuery.toLowerCase());
      const category = categories.find((cat) => cat.id === service.category_id || cat.name === service.category_id);
      const matchesCategory = selectedCategory === "Tous" || category?.name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, searchQuery, selectedCategory, categories]);

  const openEdit = (service: SalonService) => {
    setSelectedService(service);
    setName(service.name);
    setDescription(service.description || "");
    setDuration(service.duration_minutes);
    setPrice(Number(service.price_htg || 0));
    const category = categories.find((cat) => cat.id === service.category_id);
    setCategoryName(category?.name || "Pédicure");
    setActive(service.is_active);
    const options = service.metadata?.addon_options;
    setAddonOptions(Array.isArray(options) ? options.map((o: any) => o.name).join(",") : "Fleur,Charme,Breloque");
    setIsEditOpen(true);
  };

  const saveService = async () => {
    if (!activeBranchId) return toast.error("Sélectionnez une branche");
    if (!name.trim()) return toast.error("Nom requis");

    const category = categories.find((cat) => cat.name === categoryName) || categories[0];
    if (!category) return toast.error("Catégorie introuvable");

    const payload = {
      branch_id: activeBranchId,
      category_id: category.id,
      name: name.trim(),
      description: description.trim() || null,
      duration_minutes: Number(duration || 0),
      price_htg: Number(price || 0),
      is_active: active,
      metadata: {
        addon_options: addonOptions
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => ({ name: item, extra_price: 0 })),
      },
    };

    try {
      const query = selectedService
        ? supabase.from("salon_services").update(payload).eq("id", selectedService.id)
        : supabase.from("salon_services").insert([payload]);
      const { error } = await query;
      if (error) throw error;
      toast.success(selectedService ? "Service mis à jour" : "Service ajouté");
      setIsAddOpen(false);
      setIsEditOpen(false);
      resetForm();
      await loadData(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible d'enregistrer le service");
    }
  };

  const deleteService = async () => {
    if (!selectedService) return;
    try {
      const { error } = await supabase.from("salon_services").update({ is_active: false }).eq("id", selectedService.id);
      if (error) throw error;
      toast.success("Service supprimé");
      setIsDeleteOpen(false);
      resetForm();
      await loadData(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer le service");
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Services" subtitle="Chargement..." userName="Admin Studio">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Services" subtitle="Prestations indépendantes des produits" userName="Admin Studio">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher une prestation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full" />
            </div>
            <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau service
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-wrap gap-2">
            {categoryList.map((cat) => (
              <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)}>
                {cat}
              </Button>
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Service</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Catégorie</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Durée</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Prix</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Statut</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const category = categories.find((cat) => cat.id === service.category_id || cat.name === service.category_id);
                    return (
                      <tr key={service.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-sm">{service.name}</span>
                            {service.metadata?.addon_options?.length ? (
                              <Badge variant="outline" className="text-[10px]">Options</Badge>
                            ) : null}
                          </div>
                          {service.description && <p className="text-xs text-muted-foreground mt-1">{service.description}</p>}
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">{category?.name || "—"}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Clock className="h-4 w-4" />
                            <span>{service.duration_minutes} min</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 font-semibold text-primary text-sm">
                            <span>{Number(service.price_htg || 0).toFixed(2)} HTG</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={service.is_active ? "default" : "secondary"}>{service.is_active ? "Actif" : "Inactif"}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(service)} className="h-8 w-8 hover:bg-muted">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedService(service); setIsDeleteOpen(true); }} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredServices.length === 0 && (
              <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
                <Scissors className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Aucun service trouvé.</p>
              </div>
            )}
          </div>
        </StaggerItem>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Nouveau service</DialogTitle>
              <DialogDescription>Créez une prestation indépendante du module Produits.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={categoryName} onValueChange={setCategoryName}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Durée (minutes)</Label>
                  <Input type="number" min="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Prix (HTG)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Options supplémentaires</Label>
                  <Input value={addonOptions} onChange={(e) => setAddonOptions(e.target.value)} placeholder="Fleur, Charme, Breloque" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">Actif</Label>
                  <p className="text-xs text-muted-foreground">Le service sera disponible pour la caisse et les rendez-vous</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
              <Button onClick={saveService}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Modifier le service</DialogTitle>
              <DialogDescription>Ajustez les paramètres métier de la prestation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={categoryName} onValueChange={setCategoryName}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Durée (minutes)</Label>
                  <Input type="number" min="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Prix (HTG)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Options supplémentaires</Label>
                  <Input value={addonOptions} onChange={(e) => setAddonOptions(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">Actif</Label>
                  <p className="text-xs text-muted-foreground">Affiche ou masque la prestation</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
              <Button onClick={saveService}>Mettre à jour</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Supprimer le service</DialogTitle>
              <DialogDescription>
                {selectedService?.name} sera simplement désactivé afin de ne pas perdre l'historique.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={deleteService}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
