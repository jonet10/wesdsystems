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
import {
  Search, Plus, Pencil, Trash2, Scissors, Copy, Filter,
  Footprints, Handshake, Palette, Scissors as ScissorsIcon,
  Droplets, Eye, Sparkles, Zap, MoreHorizontal,
  Layers, CheckCircle2, XCircle, UserCheck, UserX,
} from "lucide-react";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";

type ServiceCategory = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  allowed_roles?: string[] | null;
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
  requires_employee?: boolean | null;
  duration_minutes?: number | null;
};

type ServiceAddonOption = {
  name: string;
  extra_cost: number;
  enabled: boolean;
};

const FALLBACK_CATEGORIES = [
  "Coupe & Coiffure", "Barbier", "Soins Capillaires", "Coloration",
  "Sourcils", "Manucure", "Pédicure", "Onglerie",
  "Soins du Visage", "Maquillage", "Massage & Spa",
  "Extensions de Cheveux", "Extensions de Cils", "Épilation",
  "Services Express", "Autres Prestations",
];
const DEFAULT_SERVICE_DURATION = 30;
const DEFAULT_ADDON_OPTIONS = ["Fleur", "Charme", "Breloque"];

const createDefaultAddonOptions = (): ServiceAddonOption[] =>
  DEFAULT_ADDON_OPTIONS.map((name) => ({ name, extra_cost: 0, enabled: true }));

const REQUIRES_EMPLOYEE_CATEGORIES = new Set([
  "Coupe & Coiffure", "Barbier", "Soins Capillaires", "Coloration",
]);

const CATEGORY_ICON_MAP: Record<string, string> = {
  "Pédicure": "footprints",
  "Manucure": "handshake",
  "Onglerie": "palette",
  "Coupe & Coiffure": "scissors",
  "Barbier": "scissors",
  "Soins Capillaires": "droplets",
  "Coloration": "palette",
  "Extensions de Cheveux": "scissors",
  "Sourcils": "eye",
  "Soins du Visage": "sparkles",
  "Maquillage": "palette",
  "Massage & Spa": "sparkles",
  "Extensions de Cils": "eye",
  "Épilation": "sparkles",
  "Services Express": "zap",
  "Autres Prestations": "more-horizontal",
};

const ROLE_LABELS: Record<string, string> = {
  barber: "Barbier",
  stylist: "Coiffeur(se)",
  nail_technician: "Technicien(ne) ongles",
  esthetician: "Esthéticien(ne)",
  massage_therapist: "Massothérapeute",
  makeup_artist: "Maquilleur(se)",
};

function getCategoryIcon(name: string): string {
  return CATEGORY_ICON_MAP[name] || "layers";
}

const DEFAULT_SERVICE_CATEGORIES = [
  {
    code: "PÉDICURE",
    name: "Pédicure",
    description: "Prestations de pédicure et options associées",
    icon: "footprints",
    color: "emerald",
    sort_order: 1,
    allowed_roles: ["nail_technician"],
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
    name: "Manucure",
    description: "Prestations de manucure",
    icon: "handshake",
    color: "violet",
    sort_order: 2,
    allowed_roles: ["nail_technician"],
    metadata: { addon_options: [] },
  },
  {
    code: "ONGLE",
    name: "Onglerie",
    description: "Prestations d'onglerie et nail art",
    icon: "palette",
    color: "pink",
    sort_order: 3,
    allowed_roles: ["nail_technician"],
    metadata: { addon_options: [] },
  },
  {
    code: "COUPE",
    name: "Coupe & Coiffure",
    description: "Coupe et coiffure pour femmes",
    icon: "scissors",
    color: "orange",
    sort_order: 4,
    allowed_roles: ["stylist", "barber"],
    metadata: { addon_options: [] },
  },
  {
    code: "BARBIER",
    name: "Barbier",
    description: "Prestations de barbier pour hommes",
    icon: "scissors",
    color: "amber",
    sort_order: 5,
    allowed_roles: ["barber"],
    metadata: { addon_options: [] },
  },
  {
    code: "SOINS_CAPIL",
    name: "Soins Capillaires",
    description: "Soins et traitements capillaires",
    icon: "droplets",
    color: "teal",
    sort_order: 6,
    allowed_roles: ["stylist", "barber"],
    metadata: { addon_options: [] },
  },
  {
    code: "COLORATION",
    name: "Coloration",
    description: "Teinture et mèches",
    icon: "palette",
    color: "rose",
    sort_order: 7,
    allowed_roles: ["stylist"],
    metadata: { addon_options: [] },
  },
  {
    code: "EXT_CHEVEUX",
    name: "Extensions de Cheveux",
    description: "Pose et réparation de tissage, lace, perruques",
    icon: "scissors",
    color: "brown",
    sort_order: 8,
    allowed_roles: ["stylist", "barber"],
    metadata: { addon_options: [] },
  },
  {
    code: "SOURCILS",
    name: "Sourcils",
    description: "Soin et mise en forme des sourcils",
    icon: "eye",
    color: "slate",
    sort_order: 9,
    allowed_roles: ["esthetician", "makeup_artist"],
    metadata: { addon_options: [] },
  },
  {
    code: "SOINS_VISAGE",
    name: "Soins du Visage",
    description: "Soins esthétiques du visage",
    icon: "sparkles",
    color: "rose",
    sort_order: 10,
    allowed_roles: ["esthetician"],
    metadata: { addon_options: [] },
  },
  {
    code: "MAQUILLAGE",
    name: "Maquillage",
    description: "Maquillage et mise en beauté",
    icon: "palette",
    color: "pink",
    sort_order: 11,
    allowed_roles: ["makeup_artist", "esthetician"],
    metadata: { addon_options: [] },
  },
  {
    code: "MASSAGE",
    name: "Massage & Spa",
    description: "Massages et soins spa",
    icon: "sparkles",
    color: "purple",
    sort_order: 12,
    allowed_roles: ["massage_therapist"],
    metadata: { addon_options: [] },
  },
  {
    code: "EXT_CILS",
    name: "Extensions de Cils",
    description: "Pose et entretien d'extensions de cils",
    icon: "eye",
    color: "gray",
    sort_order: 13,
    allowed_roles: ["esthetician", "makeup_artist"],
    metadata: { addon_options: [] },
  },
  {
    code: "EPILATION",
    name: "Épilation",
    description: "Prestations d'épilation",
    icon: "sparkles",
    color: "slate",
    sort_order: 14,
    allowed_roles: ["esthetician"],
    metadata: { addon_options: [] },
  },
  {
    code: "EXPRESS",
    name: "Services Express",
    description: "Prestations rapides",
    icon: "zap",
    color: "yellow",
    sort_order: 15,
    allowed_roles: ["stylist", "barber", "nail_technician", "esthetician", "massage_therapist", "makeup_artist"],
    metadata: { addon_options: [] },
  },
  {
    code: "AUTRES",
    name: "Autres Prestations",
    description: "Toute autre prestation",
    icon: "more-horizontal",
    color: "neutral",
    sort_order: 16,
    allowed_roles: ["stylist", "barber", "nail_technician", "esthetician", "massage_therapist", "makeup_artist"],
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
  { category_code: "COUPE", name: "Mise en rouleau", duration_minutes: 30, price_htg: 800, sort_order: 1 },
  { category_code: "COUPE", name: "Brushing (Blow)", duration_minutes: 45, price_htg: 1000, sort_order: 2 },
  { category_code: "COUPE", name: "Coupe Tara + cheveux", duration_minutes: 60, price_htg: 1200, sort_order: 3 },
  { category_code: "COUPE", name: "Coupe de cheveux femme", duration_minutes: 45, price_htg: 900, sort_order: 4 },
  { category_code: "COUPE", name: "Tresse", duration_minutes: 90, price_htg: 1600, sort_order: 5 },
  { category_code: "COUPE", name: "Chignon", duration_minutes: 60, price_htg: 1200, sort_order: 6 },
  { category_code: "SOINS_CAPIL", name: "Lavage simple", duration_minutes: 20, price_htg: 600, sort_order: 1 },
  { category_code: "SOINS_CAPIL", name: "Lavage complet (Bain d'huile + Bain de crème)", duration_minutes: 60, price_htg: 1200, sort_order: 2 },
  { category_code: "SOINS_CAPIL", name: "Lavage + Blow", duration_minutes: 45, price_htg: 1400, sort_order: 3 },
  { category_code: "SOINS_CAPIL", name: "Brûlage", duration_minutes: 15, price_htg: 500, sort_order: 4 },
  { category_code: "SOINS_CAPIL", name: "Bain de crème", duration_minutes: 30, price_htg: 700, sort_order: 5 },
  { category_code: "SOINS_CAPIL", name: "Défrisage à chaud cheveux naturels", duration_minutes: 120, price_htg: 2000, sort_order: 6 },
  { category_code: "SOINS_CAPIL", name: "Application permanente cheveux naturels", duration_minutes: 120, price_htg: 2500, sort_order: 7 },
  { category_code: "SOINS_CAPIL", name: "Application permanente + Blow", duration_minutes: 150, price_htg: 2800, sort_order: 8 },
  { category_code: "SOINS_CAPIL", name: "Application permanente", duration_minutes: 120, price_htg: 2200, sort_order: 9 },
  { category_code: "SOINS_CAPIL", name: "Lavage perruque", duration_minutes: 45, price_htg: 800, sort_order: 10 },
  { category_code: "SOINS_CAPIL", name: "Réparation perruque", duration_minutes: 60, price_htg: 1000, sort_order: 11 },
  { category_code: "COLORATION", name: "Application teinture", duration_minutes: 90, price_htg: 1800, sort_order: 1 },
  { category_code: "COLORATION", name: "Mèches", duration_minutes: 90, price_htg: 2000, sort_order: 2 },
  { category_code: "EXT_CHEVEUX", name: "Application lace", duration_minutes: 60, price_htg: 1500, sort_order: 1 },
  { category_code: "EXT_CHEVEUX", name: "Tissage", duration_minutes: 120, price_htg: 3000, sort_order: 2 },
  { category_code: "MAQUILLAGE", name: "Make-up simple", duration_minutes: 45, price_htg: 1500, sort_order: 1 },
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
  const [serviceRoles, setServiceRoles] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [requiresEmployeeFilter, setRequiresEmployeeFilter] = useState<"all" | "required" | "optional">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<SalonService | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [categoryName, setCategoryName] = useState("Pédicure");
  const [active, setActive] = useState(true);
  const [requiresEmployee, setRequiresEmployee] = useState(true);
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
      const existing = existingByName.get(seed.name);
      if (existing) {
        await supabase
          .from("salon_service_categories")
          .update({ allowed_roles: seed.allowed_roles })
          .eq("id", existing.id);
        continue;
      }
      const { error } = await supabase.from("salon_service_categories").insert({
        branch_id: branchIdToUse,
        name: seed.name,
        description: seed.description,
        icon: seed.icon,
        color: seed.color,
        sort_order: seed.sort_order,
        is_active: true,
        allowed_roles: seed.allowed_roles,
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

      const requiresEmployee = REQUIRES_EMPLOYEE_CATEGORIES.has(category.name);

      const metadata =
        seed.category_code === "PÉDICURE"
          ? {
              addon_options: [
                { name: "Fleur", extra_cost: 150, enabled: true },
                { name: "Charme", extra_cost: 200, enabled: true },
                { name: "Breloque", extra_cost: 100, enabled: true },
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
              ? "Prestation de manucure"
              : null,
        duration_minutes: DEFAULT_SERVICE_DURATION,
        price_htg: seed.price_htg,
        price_currency: "HTG",
        commission_percentage: 0,
        requires_employee: requiresEmployee,
        requires_product_list: "[]",
        is_active: true,
        sort_order: seed.sort_order,
        metadata,
      });

      if (error) throw error;
    }

    const { data: freshServices } = await supabase
      .from("salon_services")
      .select("id, name, category_id")
      .eq("branch_id", branchIdToUse);

    if (freshServices) {
      for (const service of freshServices) {
        const cat = refreshedCategories.find((c) => c.id === service.category_id);
        if (!cat) continue;
        const catSeed = DEFAULT_SERVICE_CATEGORIES.find((s) => s.name === cat.name);
        if (!catSeed || !catSeed.allowed_roles?.length) continue;

        const existingReqs = await supabase
          .from("service_role_requirements")
          .select("role")
          .eq("service_id", service.id);

        const existingRoles = new Set((existingReqs.data || []).map((r) => r.role));

        for (const role of catSeed.allowed_roles) {
          if (existingRoles.has(role)) continue;
          await supabase.from("service_role_requirements").insert({
            service_id: service.id,
            role,
          });
        }
      }
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

  const isAddonCategory = (categoryNameValue: string) => ["Pédicure"].includes(categoryNameValue);

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
          .select("id, name, description, icon, color, allowed_roles")
          .eq("branch_id", branchIdToUse)
          .order("sort_order"),
        supabase
          .from("salon_services")
          .select("id, name, description, price_htg, category_id, is_active, sort_order, metadata, requires_employee, duration_minutes")
          .eq("branch_id", branchIdToUse)
          .order("sort_order"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const fetchedCategories = (categoriesRes.data || []) as ServiceCategory[];
      const fetchedServices = (servicesRes.data || []) as SalonService[];
      setServices(fetchedServices);

      if (!fetchedCategories.length || !fetchedServices.length) {
        setCategories([]);
        setServices([]);
      } else {
        setCategories(fetchedCategories);
      }

      const { data: roleRows } = await supabase
        .from("service_role_requirements")
        .select("service_id, role");
      const roleMap = new Map<string, string[]>();
      (roleRows || []).forEach((row: any) => {
        const existing = roleMap.get(row.service_id) || [];
        existing.push(row.role);
        roleMap.set(row.service_id, existing);
      });
      setServiceRoles(roleMap);
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
    setRequiresEmployee(true);
    setAddonOptions(createDefaultAddonOptions());
  };

  const categoryList = useMemo(() => {
    const list = categories.length ? categories : FALLBACK_CATEGORIES.map((name) => ({ id: name, name }));
    return ["Tous", ...list.map((cat) => cat.name)];
  }, [categories]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const service of services) {
      const cat = categories.find((c) => c.id === service.category_id || c.name === service.category_id);
      const catName = cat?.name || "Sans catégorie";
      counts.set(catName, (counts.get(catName) || 0) + 1);
      total++;
    }
    return { counts, total };
  }, [services, categories]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch = [service.name, service.description || ""].join(" ").toLowerCase().includes(searchQuery.toLowerCase());
      const category = categories.find((cat) => cat.id === service.category_id || cat.name === service.category_id);
      const matchesCategory = selectedCategory === "Tous" || category?.name === selectedCategory;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.is_active) ||
        (statusFilter === "inactive" && !service.is_active);
      const matchesEmployee =
        requiresEmployeeFilter === "all" ||
        (requiresEmployeeFilter === "required" && service.requires_employee === true) ||
        (requiresEmployeeFilter === "optional" && (service.requires_employee === false || service.requires_employee == null));
      return matchesSearch && matchesCategory && matchesStatus && matchesEmployee;
    });
  }, [services, searchQuery, selectedCategory, statusFilter, requiresEmployeeFilter, categories]);

  const openEdit = (service: SalonService) => {
    setSelectedService(service);
    setName(service.name);
    setDescription(service.description || "");
    setPrice(Number(service.price_htg || 0));
    const category = categories.find((cat) => cat.id === service.category_id);
    setCategoryName(category?.name || "Pédicure");
    setActive(service.is_active);
    setRequiresEmployee(service.requires_employee !== false);
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
      requires_employee: requiresEmployee,
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

  const duplicateService = async (service: SalonService) => {
    if (!activeBranchId) return;
    try {
      const category = categories.find((cat) => cat.id === service.category_id);
      const { error } = await supabase.from("salon_services").insert({
        branch_id: activeBranchId,
        category_id: service.category_id,
        name: `${service.name} (copie)`,
        description: service.description,
        duration_minutes: service.duration_minutes || DEFAULT_SERVICE_DURATION,
        price_htg: Number(service.price_htg || 0),
        is_active: true,
        requires_employee: service.requires_employee !== false,
        requires_product_list: "[]",
        commission_percentage: 0,
        metadata: service.metadata || {},
      });
      if (error) throw error;
      toast.success("Service dupliqué avec succès");
      await loadData(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible de dupliquer le service");
    }
  };

  const deleteService = async () => {
    if (!selectedService) return;
    try {
      const { error } = await supabase.from("salon_services").update({ is_active: false }).eq("id", selectedService.id);
      if (error) throw error;
      toast.success("Service désactivé");
      setIsDeleteOpen(false);
      resetForm();
      await loadData(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible de désactiver le service");
    }
  };

  const getRolesForService = (service: SalonService): string[] => {
    const fromDb = serviceRoles.get(service.id);
    if (fromDb && fromDb.length > 0) return fromDb;
    const cat = categories.find((c) => c.id === service.category_id);
    return cat?.allowed_roles || [];
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
      <SubscriptionGuard>
        <StaggerContainer className="space-y-6">
        {/* ─── Totals & Category Counters ─── */}
        <StaggerItem>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold font-display leading-tight">{categoryCounts.total}</p>
                <p className="text-xs text-muted-foreground truncate">Total services</p>
              </div>
            </div>
            {categories.slice(0, 8).map((cat) => {
              const count = categoryCounts.counts.get(cat.name) || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name === selectedCategory ? "Tous" : cat.name)}
                  className={`bg-card border rounded-xl p-4 flex items-center gap-3 text-left transition-all ${
                    selectedCategory === cat.name
                      ? "border-primary/50 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground shrink-0">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold font-display leading-tight">{count}</p>
                    <p className="text-xs text-muted-foreground truncate">{cat.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </StaggerItem>

        {/* ─── Search & Filters ─── */}
        <StaggerItem>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filtres
                </Button>
                <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
                  <Plus className="h-4 w-4" /> Nouveau service
                </Button>
              </div>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Statut</Label>
                  <div className="flex gap-1">
                    {(["all", "active", "inactive"] as const).map((val) => (
                      <Button
                        key={val}
                        variant={statusFilter === val ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setStatusFilter(val)}
                      >
                        {val === "all" ? "Tous" : val === "active" ? "Actifs" : "Inactifs"}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Employé requis</Label>
                  <div className="flex gap-1">
                    {(["all", "required", "optional"] as const).map((val) => (
                      <Button
                        key={val}
                        variant={requiresEmployeeFilter === val ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setRequiresEmployeeFilter(val)}
                      >
                        {val === "all" ? "Tous" : val === "required" ? "Obligatoire" : "Optionnel"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* ─── Category Nav ─── */}
        <StaggerItem>
          <div className="flex flex-wrap gap-2">
            {categoryList.map((cat) => {
              const iconName = cat === "Tous" ? "layers" : getCategoryIcon(cat);
              return (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="rounded-lg gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {cat}
                </Button>
              );
            })}
          </div>
        </StaggerItem>

        {/* ─── Services Table ─── */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Service</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Catégorie</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Prix</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Professionnel(le)s</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Employé</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Options</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Statut</th>
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const category = categories.find((cat) => cat.id === service.category_id || cat.name === service.category_id);
                    const serviceAddonOptions = isAddonCategory(category?.name || "") ? resolveAddonOptions(service) : [];
                    const roles = getRolesForService(service);
                    return (
                      <tr key={service.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm block truncate max-w-[200px]" title={service.name}>
                              {service.name}
                            </span>
                            {service.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]" title={service.description}>
                                {service.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {category?.name ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 whitespace-nowrap">
                              <Layers className="h-3 w-3" />
                              {category.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-sm whitespace-nowrap">
                            {Number(service.price_htg || 0).toLocaleString()} <span className="text-muted-foreground font-normal">HTG</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {roles.length > 0 ? (
                              roles.map((role) => (
                                <span
                                  key={role}
                                  className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap"
                                >
                                  {ROLE_LABELS[role] || role}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {service.requires_employee !== false ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <UserCheck className="h-3.5 w-3.5" />
                              Obligatoire
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <UserX className="h-3.5 w-3.5" />
                              Optionnel
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {serviceAddonOptions.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {serviceAddonOptions.map((option) => (
                                <button
                                  key={option.name}
                                  type="button"
                                  onClick={() => openOptionConfig(service)}
                                  className="inline-flex px-2 py-0.5 rounded text-[10px] border border-border bg-muted/30 text-muted-foreground hover:bg-muted transition-colors cursor-pointer whitespace-nowrap"
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
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 text-xs font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
                              <XCircle className="h-3.5 w-3.5" />
                              Inactif
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => duplicateService(service)} className="h-8 w-8" title="Dupliquer">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(service)} className="h-8 w-8" title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedService(service); setIsDeleteOpen(true); }} className="h-8 w-8" title="Désactiver">
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
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
              <div className="p-12 text-center">
                <Scissors className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Aucun service trouvé.</p>
                <p className="text-xs text-muted-foreground mt-1">Essayez de modifier vos filtres ou créez un nouveau service.</p>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* ─── Add Dialog ─── */}
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
                <div className="space-y-2">
                  <Label>Employé requis</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={requiresEmployee ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRequiresEmployee(true)}
                      className="flex-1"
                    >
                      <UserCheck className="h-4 w-4 mr-1.5" />
                      Obligatoire
                    </Button>
                    <Button
                      type="button"
                      variant={!requiresEmployee ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRequiresEmployee(false)}
                      className="flex-1"
                    >
                      <UserX className="h-4 w-4 mr-1.5" />
                      Optionnel
                    </Button>
                  </div>
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

        {/* ─── Edit Dialog ─── */}
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
                <div className="space-y-2">
                  <Label>Employé requis</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={requiresEmployee ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRequiresEmployee(true)}
                      className="flex-1"
                    >
                      <UserCheck className="h-4 w-4 mr-1.5" />
                      Obligatoire
                    </Button>
                    <Button
                      type="button"
                      variant={!requiresEmployee ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRequiresEmployee(false)}
                      className="flex-1"
                    >
                      <UserX className="h-4 w-4 mr-1.5" />
                      Optionnel
                    </Button>
                  </div>
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

        {/* ─── Delete Dialog ─── */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Désactiver le service</DialogTitle>
              <DialogDescription>
                {selectedService?.name} sera désactivé afin de ne pas perdre l'historique.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={deleteService}>Désactiver</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Options Config Dialog ─── */}
        <Dialog open={isOptionConfigOpen} onOpenChange={setIsOptionConfigOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Configurer les options</DialogTitle>
              <DialogDescription>
                {optionConfigService?.name} — ajustez le coût additionnel de chaque option.
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
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
