import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Clock, Euro, Pencil, Trash2, Scissors } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { glowupStore, Service } from "@/lib/store";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/useSupabaseQuery";
import { useCurrency } from "@/contexts/CurrencyContext";

const categories = ["Tous", "Coupe", "Coloration", "Coiffage", "Forfait", "Soins"];

export default function ServicesPage() {
  const { isAuthenticated } = useAuth();
  const { currency, format } = useCurrency();

  // --- DUAL MODE DATA ---
  const { data: servicesDb } = useSupabaseQuery<any>(['services'], 'services', '*', { enabled: isAuthenticated });
  const insertService = useSupabaseInsert<any>('services', ['services']);
  const updateServiceDb = useSupabaseUpdate<any>('services', ['services']);
  const deleteServiceDb = useSupabaseDelete('services', ['services']);

  const [localServices, setLocalServices] = useState<Service[]>(glowupStore.getServices());

  useEffect(() => {
    const handleUpdate = () => setLocalServices(glowupStore.getServices());
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const services = useMemo(() => {
    if (servicesDb && servicesDb.length > 0) {
      return servicesDb.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration || 60,
        price: s.price || 0,
        category: s.category || "Standard",
        popular: s.popular || false
      }));
    }
    return localServices;
  }, [servicesDb, localServices]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60); // minutes
  const [price, setPrice] = useState(45); // Euros
  const [category, setCategory] = useState("Coupe");
  const [popular, setPopular] = useState(false);

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !duration || !price) {
      toast.error("Veuillez renseigner les champs obligatoires.");
      return;
    }
    
    if (isAuthenticated) {
      insertService.mutate({ name, duration: Number(duration), price: Number(price), category }, {
        onSuccess: () => {
          toast.success(`La prestation "${name}" a été ajoutée.`);
          setIsAddOpen(false);
          resetForm();
        },
        onError: (err) => toast.error(err.message)
      });
    } else {
      glowupStore.addService({
        name, duration: Number(duration), price: Number(price), category, popular
      });
      toast.success(`La prestation "${name}" a été ajoutée (Local).`);
      setIsAddOpen(false);
      resetForm();
    }
  };

  const handleEditService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !name || !duration || !price) return;

    if (isAuthenticated && selectedService.id.includes('-')) {
      updateServiceDb.mutate({ id: selectedService.id, name, duration: Number(duration), price: Number(price), category }, {
        onSuccess: () => {
          toast.success(`La prestation "${name}" a été mise à jour.`);
          setIsEditOpen(false);
          resetForm();
        },
        onError: (err) => toast.error(err.message)
      });
    } else {
      glowupStore.updateService({ ...selectedService, name, duration: Number(duration), price: Number(price), category, popular });
      toast.success(`La prestation "${name}" a été mise à jour (Local).`);
      setIsEditOpen(false);
      resetForm();
    }
  };

  const handleDeleteService = () => {
    if (!selectedService) return;

    if (isAuthenticated && selectedService.id.includes('-')) {
      deleteServiceDb.mutate(selectedService.id, {
        onSuccess: () => {
          toast.success(`La prestation "${selectedService.name}" a été supprimée.`);
          setIsDeleteOpen(false);
          setSelectedService(null);
        },
        onError: (err) => toast.error(err.message)
      });
    } else {
      glowupStore.deleteService(selectedService.id);
      toast.success(`La prestation "${selectedService.name}" a été supprimée (Local).`);
      setIsDeleteOpen(false);
      setSelectedService(null);
    }
  };

  const resetForm = () => {
    setName("");
    setDuration(60);
    setPrice(45);
    setCategory("Coupe");
    setPopular(false);
    setSelectedService(null);
  };

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    setName(service.name);
    setDuration(service.duration);
    setPrice(service.price);
    setCategory(service.category);
    setPopular(service.popular);
    setIsEditOpen(true);
  };

  const openDeleteModal = (service: Service) => {
    setSelectedService(service);
    setIsDeleteOpen(true);
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Tous" || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return mins > 0 ? `${hrs}h${mins}` : `${hrs}h`;
    }
    return `${mins}min`;
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Services"
      subtitle="Gérez vos prestations et tarifs"
      userName="Marie Laurent"
    >
      <StaggerContainer className="space-y-6">
        {/* Header Actions */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une prestation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
            <Button variant="hero" onClick={() => { resetForm(); setIsAddOpen(true); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau service
            </Button>
          </div>
        </StaggerItem>

        {/* Category Filters */}
        <StaggerItem>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="rounded-lg text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
        </StaggerItem>

        {/* Services Table */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Service</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Catégorie</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Durée</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Prix</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{service.name}</span>
                          {service.popular && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                              Populaire
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{service.category}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(service.duration)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 font-semibold text-primary text-sm">
                          <span>{format(service.price)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(service)} className="h-8 w-8 hover:bg-muted">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteModal(service)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </StaggerItem>

        {filteredServices.length === 0 && (
          <StaggerItem>
            <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
              <Scissors className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Aucun service trouvé.</p>
            </div>
          </StaggerItem>
        )}

        {/* ADD SERVICE DIALOG */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nouveau service</DialogTitle>
              <DialogDescription>
                Créez une prestation pour votre catalogue avec son tarif et sa durée par défaut.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddService} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-svc-name">Nom de la prestation *</Label>
                <Input id="add-svc-name" placeholder="Ex: Coupe femme" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-svc-duration">Durée (minutes) *</Label>
                  <Input id="add-svc-duration" type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-svc-price">Prix ({currency.symbol}) *</Label>
                  <Input id="add-svc-price" type="number" min="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-svc-category">Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="add-svc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c !== "Tous").map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="font-semibold">Mettre en avant</Label>
                  <p className="text-xs text-muted-foreground">Marquer comme prestation populaire</p>
                </div>
                <Switch checked={popular} onCheckedChange={setPopular} />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero">Créer le service</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT SERVICE DIALOG */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Modifier la prestation</DialogTitle>
              <DialogDescription>
                Ajustez le tarif, la durée ou les paramètres d'affichage de ce service.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditService} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-svc-name">Nom de la prestation *</Label>
                <Input id="edit-svc-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-svc-duration">Durée (minutes) *</Label>
                  <Input id="edit-svc-duration" type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-svc-price">Prix ({currency?.symbol || "€"}) *</Label>
                  <Input id="edit-svc-price" type="number" min="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-svc-category">Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="edit-svc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c !== "Tous").map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="font-semibold">Mettre en avant</Label>
                  <p className="text-xs text-muted-foreground">Marquer comme prestation populaire</p>
                </div>
                <Switch checked={popular} onCheckedChange={setPopular} />
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
              <DialogTitle className="text-destructive font-display">Supprimer la prestation</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer la prestation <strong>{selectedService?.name}</strong> ? Elle ne pourra plus être sélectionnée pour de futurs rendez-vous.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Annuler</Button>
              <Button type="button" variant="destructive" onClick={handleDeleteService}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
