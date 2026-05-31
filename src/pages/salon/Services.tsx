import { useEffect, useMemo, useRef, useState } from "react";
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
import { Search, Plus, Pencil, Trash2, Scissors } from "lucide-react";

type ServiceCategory = {
  id: string;
  name: string;
  description?: string | null;
};

type SalonService = {
  id: string;
  name: string;
  description?: string | null;
  price_htg: number;
  category_id?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  metadata?: Record<string, any> | null;
};

type ServiceAddonOption = {
  name: string;
  extra_cost: number;
  enabled: boolean;
};

const FALLBACK_CATEGORIES = ["Pédicure", "Manicure", "Coiffure / Beauté"];
const DEFAULT_SERVICE_DURATION = 30;
const DEFAULT_ADDON_OPTIONS = ["Fleur", "Charme", "Breloque"];

const createDefaultAddonOptions = (): ServiceAddonOption[] =>
  DEFAULT_ADDON_OPTIONS.map((name) => ({ name, extra_cost: 0, enabled: true }));

const DEFAULT_SERVICE_CATEGORIES = [
  {
    code: "PÉDICURE",
    name: "Pédicure",
    description: "Prestations de pédicure et options associées",
    icon: "footprints",
    color: "emerald",
    sort_order: 1,
    metadata: {
      addon_options: [
        { name: "Fleur", extra_price: 0 },
        { name: "Charme", extra_price: 0 },
        { name: "Breloque", extra_price: 0 },
      ],
    },
  },
  {
    code: "MANICURE",
    name: "Manicure",
    description: "Prestations de manicure",
    icon: "handshake",
    color: "violet",
    sort_order: 2,
    metadata: { addon_options: [] },
  },
  {
    code: "COIFFURE / BEAUTÉ",
    name: "Coiffure / Beauté",
    description: "Prestations de coiffure et beauté",
    icon: "scissors",
    color: "orange",
    sort_order: 3,
    metadata: { addon_options: [] },
  },
];

const DEFAULT_SERVICE_SEEDS = [
  { category_code: "PÉDICURE", name: "Simple", duration_minutes: 30, price_htg: 500, sort_order: 1 },
  { category_code: "PÉDICURE", name: "Vernis ordinaire", duration_minutes: 45, price_htg: 700, sort_order: 2 },
  { category_code: "PÉDICURE", name: "Vernis Gel", duration_minutes: 60, price_htg: 900, sort_order: 3 },
  { category_code: "PÉDICURE", name: "Pose pouce (SLM)", duration_minutes: 20, price_htg: 1200, sort_order: 4 },
  { category_code: "PÉDICURE", name: "Full pose Vernis Gel", duration_minutes: 75, price_htg: 1500, sort_order: 5 },
  { category_code: "PÉDICURE", name: "Acrylique toes", duration_minutes: 90, price_htg: 1800, sort_order: 6 },
  { category_code: "MANICURE", name: "Simple", duration_minutes: 30, price_htg: 400, sort_order: 1 },
  { category_code: "MANICURE", name: "Vernis Gel", duration_minutes: 45, price_htg: 800, sort_order: 2 },
  { category_code: "MANICURE", name: "Baby Boomers", duration_minutes: 60, price_htg: 1000, sort_order: 3 },
  { category_code: "MANICURE", name: "Pose ongle Almond", duration_minutes: 75, price_htg: 1400, sort_order: 4 },
  { category_code: "MANICURE", name: "Pose ongle carré", duration_minutes: 75, price_htg: 1400, sort_order: 5 },
  { category_code: "MANICURE", name: "Acrylique simple", duration_minutes: 60, price_htg: 1600, sort_order: 6 },
  { category_code: "MANICURE", name: "Avec design", duration_minutes: 75, price_htg: 1800, sort_order: 7 },
  { category_code: "MANICURE", name: "Pose Vernis Gel", duration_minutes: 45, price_htg: 950, sort_order: 8 },
  { category_code: "MANICURE", name: "Pose Vernis Ordinaire", duration_minutes: 35, price_htg: 600, sort_order: 9 },
  { category_code: "MANICURE", name: "Deep Powder", duration_minutes: 75, price_htg: 1700, sort_order: 10 },
  { category_code: "MANICURE", name: "Soak Off A", duration_minutes: 30, price_htg: 500, sort_order: 11 },
  { category_code: "MANICURE", name: "Soak Off Pose", duration_minutes: 40, price_htg: 700, sort_order: 12 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Lavage simple", duration_minutes: 20, price_htg: 600, sort_order: 1 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Mise en rouleau", duration_minutes: 30, price_htg: 800, sort_order: 2 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Lavage complet (Bain d'huile + Bain de crème)", duration_minutes: 60, price_htg: 1200, sort_order: 3 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Lavage + Blow", duration_minutes: 45, price_htg: 1400, sort_order: 4 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Brûlage", duration_minutes: 15, price_htg: 500, sort_order: 5 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Bain de crème", duration_minutes: 30, price_htg: 700, sort_order: 6 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Brushing (Blow)", duration_minutes: 45, price_htg: 1000, sort_order: 7 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Défrisage à chaud cheveux naturels", duration_minutes: 120, price_htg: 2000, sort_order: 8 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Application permanente cheveux naturels", duration_minutes: 120, price_htg: 2500, sort_order: 9 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Application permanente + Blow", duration_minutes: 150, price_htg: 2800, sort_order: 10 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Application permanente", duration_minutes: 120, price_htg: 2200, sort_order: 11 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Application teinture", duration_minutes: 90, price_htg: 1800, sort_order: 12 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Application lace", duration_minutes: 60, price_htg: 1500, sort_order: 13 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Coupe Tara + cheveux", duration_minutes: 60, price_htg: 1200, sort_order: 14 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Lavage perruque", duration_minutes: 45, price_htg: 800, sort_order: 15 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Coupe de cheveux femme", duration_minutes: 45, price_htg: 900, sort_order: 16 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Tresse", duration_minutes: 90, price_htg: 1600, sort_order: 17 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Réparation perruque", duration_minutes: 60, price_htg: 1000, sort_order: 18 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Make-up simple", duration_minutes: 45, price_htg: 1500, sort_order: 19 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Tissage", duration_minutes: 120, price_htg: 3000, sort_order: 20 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Mèches", duration_minutes: 90, price_htg: 2000, sort_order: 21 },
  { category_code: "COIFFURE / BEAUTÉ", name: "Chignon", duration_minutes: 60, price_htg: 1200, sort_order: 22 },
];

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
  const [price, setPrice] = useState(0);
  const [categoryName, setCategoryName] = useState("Pédicure");
  const [active, setActive] = useState(true);
  const [addonOptions, setAddonOptions] = useState<ServiceAddonOption[]>(createDefaultAddonOptions());
  const [optionConfigService, setOptionConfigService] = useState<SalonService | null>(null);
  const [isOptionConfigOpen, setIsOptionConfigOpen] = useState(false);
  const bootstrappedBranchRef = useRef<string | null>(null);

  const ensureDefaultServices = async (branchIdToUse: string) => {
    if (bootstrappedBranchRef.current === branchIdToUse) return;
    bootstrappedBranchRef.current = branchIdToUse;

    const { data: existingCategories } = await supabase
      .from("salon_service_categories")
      .select("id, name, metadata")
      .eq("branch_id", branchIdToUse);

    const existingByName = new Map((existingCategories || []).map((category) => [category.name, category]));

    for (const seed of DEFAULT_SERVICE_CATEGORIES) {
      if (existingByName.has(seed.name)) continue;
      const { error } = await supabase.from("salon_service_categories").insert({
        branch_id: branchIdToUse,
        name: seed.name,
        description: seed.description,
        icon: seed.icon,
        color: seed.color,
        sort_order: seed.sort_order,
        is_active: true,
        metadata: seed.metadata,
      });
      if (error) throw error;
    }

    const { data: categoriesAfterInsert } = await supabase
      .from("salon_service_categories")
      .select("id, name, metadata")
      .eq("branch_id", branchIdToUse);

    const refreshedCategories = categoriesAfterInsert || [];
    const categoryByCode = new Map(
      DEFAULT_SERVICE_CATEGORIES.map((seed) => [
        seed.code,
        refreshedCategories.find((category) => category.name === seed.name),
      ]),
    );

    const { data: existingServices } = await supabase
      .from("salon_services")
      .select("id, name, category_id")
      .eq("branch_id", branchIdToUse);

    const serviceKeySet = new Set((existingServices || []).map((service) => `${service.category_id}:${service.name}`));

    for (const seed of DEFAULT_SERVICE_SEEDS) {
      const category = categoryByCode.get(seed.category_code);
      if (!category) continue;
      const serviceKey = `${category.id}:${seed.name}`;
      if (serviceKeySet.has(serviceKey)) continue;

      const metadata =
        seed.category_code === "PÉDICURE"
          ? {
              addon_options: [
                { name: "Fleur", extra_price: 0 },
                { name: "Charme", extra_price: 0 },
                { name: "Breloque", extra_price: 0 },
              ],
            }
          : {};

      const { error } = await supabase.from("salon_services").insert({
        branch_id: branchIdToUse,
        category_id: category.id,
        name: seed.name,
        description:
          seed.category_code === "PÉDICURE" && seed.name === "Simple"
            ? "Prestation de pédicure"
            : seed.category_code === "MANICURE" && seed.name === "Simple"
              ? "Prestation de manicure"
              : seed.category_code === "COIFFURE / BEAUTÉ" && seed.name === "Lavage simple"
                ? "Prestation de coiffure / beauté"
                : null,
        duration_minutes: DEFAULT_SERVICE_DURATION,
        price_htg: seed.price_htg,
        price_currency: "HTG",
        commission_percentage: 0,
        requires_employee: true,
        requires_product_list: "[]",
        is_active: true,
        sort_order: seed.sort_order,
        metadata,
      });

      if (error) throw error;
    }
  };

  const resolveAddonOptions = (service: SalonService | null) => {
    const rawOptions = service?.metadata?.addon_options;
    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      return DEFAULT_ADDON_OPTIONS.map((name) => {
        const existing = rawOptions.find((option: any) => option.name === name);
        return {
          name,
          extra_cost: Number(existing?.extra_cost ?? existing?.extra_price ?? 0),
          enabled: existing ? existing.enabled !== false : true,
        } satisfies ServiceAddonOption;
      });
    }
    return createDefaultAddonOptions();
  };

  const isAddonCategory = (categoryNameValue: string) => ["Pédicure", "Manicure"].includes(categoryNameValue);

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
          .select("id, name, description, price_htg, category_id, is_active, sort_order, metadata")
          .eq("branch_id", branchIdToUse)
          .order("sort_order"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const fetchedCategories = (categoriesRes.data || []) as ServiceCategory[];
      setServices((servicesRes.data || []) as SalonService[]);

      if (!fetchedCategories.length || !(servicesRes.data || []).length) {
        await ensureDefaultServices(branchIdToUse);
        const [categoriesAfterSeed, servicesAfterSeed] = await Promise.all([
          supabase
            .from("salon_service_categories")
            .select("id, name, description")
            .eq("branch_id", branchIdToUse)
            .order("sort_order"),
          supabase
            .from("salon_services")
            .select("id, name, description, price_htg, category_id, is_active, sort_order, metadata")
            .eq("branch_id", branchIdToUse)
            .order("sort_order"),
        ]);

        if (categoriesAfterSeed.error) throw categoriesAfterSeed.error;
        if (servicesAfterSeed.error) throw servicesAfterSeed.error;

        setCategories((categoriesAfterSeed.data || []) as ServiceCategory[]);
        setServices((servicesAfterSeed.data || []) as SalonService[]);
        return;
      }

      setCategories(fetchedCategories.length ? fetchedCategories : FALLBACK_CATEGORIES.map((name) => ({ id: name, name })));
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
    setPrice(0);
    setCategoryName("Pédicure");
    setActive(true);
    setAddonOptions(createDefaultAddonOptions());
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
    setPrice(Number(service.price_htg || 0));
    const category = categories.find((cat) => cat.id === service.category_id);
    setCategoryName(category?.name || "Pédicure");
    setActive(service.is_active);
    setAddonOptions(resolveAddonOptions(service));
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
      duration_minutes: DEFAULT_SERVICE_DURATION,
      price_htg: Number(price || 0),
      is_active: active,
      metadata: {
        addon_options: isAddonCategory(categoryName)
          ? addonOptions
              .filter((option) => option.enabled)
              .map((option) => ({ name: option.name, extra_cost: Number(option.extra_cost || 0) }))
          : [],
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

  const openOptionConfig = (service: SalonService) => {
    setOptionConfigService(service);
    setAddonOptions(resolveAddonOptions(service));
    setIsOptionConfigOpen(true);
  };

  const saveOptionConfig = async () => {
    if (!optionConfigService || !activeBranchId) return;

    try {
      const nextMetadata = {
        ...(optionConfigService.metadata || {}),
        addon_options: addonOptions
          .filter((option) => option.enabled)
          .map((option) => ({ name: option.name, extra_cost: Number(option.extra_cost || 0) })),
      };

      const { error } = await supabase
        .from("salon_services")
        .update({ metadata: nextMetadata })
        .eq("id", optionConfigService.id);

      if (error) throw error;
      toast.success("Options appliquées");
      setIsOptionConfigOpen(false);
      setOptionConfigService(null);
      await loadData(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible de configurer les options");
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {["Pédicure", "Manicure", "Coiffure / Beauté"].map((catName) => {
              const catId = categories.find((c) => c.name === catName)?.id;
              const count = services.filter((s) => s.category_id === catId || (s.category_id === catName && !catId)).length;
              return (
                <div key={catName} className="bg-muted/40 p-4 rounded-xl border border-border/50">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{catName}</p>
                  <p className="text-3xl font-semibold">{count}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-xl w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher une prestation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full bg-background" />
            </div>
            <Button variant="outline" onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau service
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-wrap gap-2">
            {categoryList.map((cat) => (
              <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="rounded-lg">
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
                  <tr className="border-b border-border bg-background">
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Service</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Catégorie</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Prix de base</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Options</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Statut</th>
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const category = categories.find((cat) => cat.id === service.category_id || cat.name === service.category_id);
                    const serviceAddonOptions = isAddonCategory(category?.name || "") ? resolveAddonOptions(service) : [];
                    return (
                      <tr key={service.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <span className="font-semibold text-sm">{service.name}</span>
                          {service.description && <p className="text-xs text-muted-foreground mt-1">{service.description}</p>}
                        </td>
                        <td className="p-4">
                          {category?.name ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {category.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col font-semibold text-sm">
                            <span>{Number(service.price_htg || 0)}</span>
                            <span>HTG</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {serviceAddonOptions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                              {serviceAddonOptions.map((option) => (
                                <button
                                  key={option.name}
                                  type="button"
                                  onClick={() => openOptionConfig(service)}
                                  className="inline-flex px-2.5 py-1 rounded-full text-[11px] border border-border bg-muted/30 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                                >
                                  {option.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          {service.is_active ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 text-xs font-semibold">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Actif
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                              Inactif
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => openEdit(service)} className="h-9 w-9">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => { setSelectedService(service); setIsDeleteOpen(true); }} className="h-9 w-9">
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
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
                  <Select
                    value={categoryName}
                    onValueChange={(value) => {
                      setCategoryName(value);
                      setAddonOptions(isAddonCategory(value) ? createDefaultAddonOptions() : []);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prix (HTG)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </div>
                {isAddonCategory(categoryName) && (
                  <div className="md:col-span-2 space-y-3 rounded-xl border border-border p-4">
                    <Label>Options supplémentaires</Label>
                    <div className="space-y-3">
                      {addonOptions.map((option, index) => (
                        <div key={option.name} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-lg border border-border p-3">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={option.enabled}
                              onChange={(e) => {
                                setAddonOptions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, enabled: e.target.checked } : row));
                              }}
                            />
                            {option.name}
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={option.extra_cost}
                              onChange={(e) => {
                                const value = Number(e.target.value || 0);
                                setAddonOptions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, extra_cost: value } : row));
                              }}
                              className="w-32"
                            />
                            <span className="text-xs text-muted-foreground">HTG</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  <Select
                    value={categoryName}
                    onValueChange={(value) => {
                      setCategoryName(value);
                      setAddonOptions(isAddonCategory(value) ? createDefaultAddonOptions() : []);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prix (HTG)</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </div>
                {isAddonCategory(categoryName) && (
                  <div className="md:col-span-2 space-y-3 rounded-xl border border-border p-4">
                    <Label>Options supplémentaires</Label>
                    <div className="space-y-3">
                      {addonOptions.map((option, index) => (
                        <div key={option.name} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-lg border border-border p-3">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={option.enabled}
                              onChange={(e) => {
                                setAddonOptions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, enabled: e.target.checked } : row));
                              }}
                            />
                            {option.name}
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={option.extra_cost}
                              onChange={(e) => {
                                const value = Number(e.target.value || 0);
                                setAddonOptions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, extra_cost: value } : row));
                              }}
                              className="w-32"
                            />
                            <span className="text-xs text-muted-foreground">HTG</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

        <Dialog open={isOptionConfigOpen} onOpenChange={setIsOptionConfigOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Configurer les options</DialogTitle>
              <DialogDescription>
                {optionConfigService?.name} - ajustez le coût additionnel de chaque option.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {addonOptions.map((option, index) => (
                <div key={option.name} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-lg border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={option.enabled}
                      onChange={(e) => {
                        setAddonOptions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, enabled: e.target.checked } : row));
                      }}
                    />
                    {option.name}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={option.extra_cost}
                      onChange={(e) => {
                        const value = Number(e.target.value || 0);
                        setAddonOptions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, extra_cost: value } : row));
                      }}
                      className="w-32"
                    />
                    <span className="text-xs text-muted-foreground">HTG</span>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOptionConfigOpen(false)}>Annuler</Button>
              <Button onClick={saveOptionConfig}>Appliquer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
