import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { toast } from "sonner";
import {
  Package, Search, Plus, Pencil, Trash2,
  ArrowLeft, ArrowRight, Check, Star, ChevronRight,
  BookOpen, Pen,
} from "lucide-react";
import { type PackagingType, PACKAGING_TYPES, PACKAGING_LABELS } from "@/lib/packaging";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface ProductSubcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

interface CatalogItem {
  id: string;
  subcategory_id: string;
  name: string;
  default_brand: string | null;
  is_fast_moving: boolean;
}

interface Product {
  id: string;
  branch_id: string;
  catalog_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  packaging_type: PackagingType | null;
  package_quantity: number | null;
  is_active: boolean;
  created_at: string;
}

type ModalStep = 1 | 2 | 3;
type EntryMode = "catalog" | "manual";

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepDots({ step }: { step: ModalStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {([1, 2, 3] as ModalStep[]).map((s) => (
        <div
          key={s}
          className={`transition-all duration-300 rounded-full ${
            s === step
              ? "w-6 h-2 bg-primary"
              : s < step
              ? "w-2 h-2 bg-primary/60"
              : "w-2 h-2 bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [] } = useBusinessBranches();

  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((b) => b.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);

  // ── List state
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [loading, setLoading] = useState(true);

  // ── Catalog data
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ProductSubcategory[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // ── Modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [step, setStep] = useState<ModalStep>(1);
  const [entryMode, setEntryMode] = useState<EntryMode>("catalog");

  // Step 1 — catalog navigation
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<ProductSubcategory | null>(null);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Step 2 — product identity
  const [prodName, setProdName] = useState("");
  const [prodBrand, setProdBrand] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodCatalogId, setProdCatalogId] = useState<string | null>(null);

  // Step 3 — packaging
  const [packagingType, setPackagingType] = useState<PackagingType>("custom");

  // ── Load products
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("salon_products")
        .select("id, branch_id, catalog_id, name, brand, sku, category, packaging_type, package_quantity, is_active, created_at")
        .eq("is_active", true);
      if (activeBranchId) query = query.eq("branch_id", activeBranchId);
      const { data, error } = await query.order("name");
      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch {
      toast.error("Erreur chargement produits");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  // ── Load catalog data
  const loadCatalog = useCallback(async () => {
    try {
      const [catRes, subRes, itemRes] = await Promise.all([
        supabase.from("product_categories").select("*").order("sort_order"),
        supabase.from("product_subcategories").select("*").order("sort_order"),
        supabase.from("product_catalog").select("*").eq("is_active", true).order("name"),
      ]);
      if (catRes.data)  setCategories(catRes.data as ProductCategory[]);
      if (subRes.data)  setSubcategories(subRes.data as ProductSubcategory[]);
      if (itemRes.data) setCatalogItems(itemRes.data as CatalogItem[]);
    } catch {
      // catalog non-critique
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  // ── Filtered products
  const filtered = useMemo(() => {
    let result = products;
    if (search) result = result.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase())
    );
    if (categoryFilter !== "Tous") result = result.filter(p => p.category === categoryFilter);
    return result;
  }, [products, search, categoryFilter]);

  // ── Catalog derived lists
  const subcatsForCategory = useMemo(
    () => subcategories.filter(s => s.category_id === selectedCategory?.id),
    [subcategories, selectedCategory]
  );

  const itemsForSubcat = useMemo(() => {
    let items = catalogItems.filter(i => i.subcategory_id === selectedSubcategory?.id);
    if (catalogSearch) items = items.filter(i =>
      i.name.toLowerCase().includes(catalogSearch.toLowerCase())
    );
    return items;
  }, [catalogItems, selectedSubcategory, catalogSearch]);

  // ── Reset modal
  const resetModal = () => {
    setStep(1);
    setEntryMode("catalog");
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedCatalogItem(null);
    setCatalogSearch("");
    setProdName("");
    setProdBrand("");
    setProdSku("");
    setProdCatalogId(null);
    setPackagingType("custom");
    setEditing(null);
  };

  const openCreate = () => { resetModal(); setOpen(true); };

  const openEdit = (p: Product) => {
    resetModal();
    setEditing(p);
    setEntryMode("manual");
    setProdName(p.name);
    setProdBrand(p.brand || "");
    setProdSku(p.sku || "");
    setProdCatalogId(p.catalog_id);
    setPackagingType(p.packaging_type || "custom");
    setStep(2); // skip step 1 for editing
    setOpen(true);
  };

  // ── Step navigation
  const handleSelectCatalogItem = (item: CatalogItem) => {
    setSelectedCatalogItem(item);
    setProdName(item.name);
    setProdBrand(item.default_brand || "");
    setProdCatalogId(item.id);
    setStep(2);
  };

  const goManual = () => {
    setEntryMode("manual");
    setProdName("");
    setProdBrand("");
    setProdCatalogId(null);
    setStep(2);
  };

  const goBack = () => {
    if (step === 2 && !editing) { setStep(1); setSelectedCatalogItem(null); }
    if (step === 3) setStep(2);
  };

  const goToStep3 = () => {
    if (!prodName.trim()) return toast.error("Nom du produit requis");
    setStep(3);
  };

  // ── Save
  const saveProduct = async () => {
    if (!prodName.trim()) return toast.error("Nom du produit requis");

    const categoryName = selectedCategory?.name
      ?? categories.find(c => c.id === subcategories.find(s => s.id === selectedSubcategory?.id)?.category_id)?.name
      ?? null;

    const payload = {
      name: prodName.trim(),
      brand: prodBrand.trim() || null,
      sku: prodSku.trim() || null,
      catalog_id: prodCatalogId,
      category: categoryName,
      packaging_type: packagingType,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("salon_products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Produit modifié");
      } else {
        const { error } = await supabase.from("salon_products").insert([{
          ...payload,
          branch_id: activeBranchId,
          unit_price: 0,
          is_active: true,
        }]);
        if (error) throw error;
        toast.success("Produit ajouté — configurez le stock dans l'Inventaire");
      }
      setOpen(false);
      resetModal();
      void loadProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteProduct = async (p: Product) => {
    try {
      const { error } = await supabase.from("salon_products").update({ is_active: false }).eq("id", p.id);
      if (error) throw error;
      toast.success("Produit retiré");
      void loadProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Unique categories from products for filter
  const productCategoryOptions = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [products]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="salon_admin" title="Produits" subtitle="Gérez le catalogue commercial de vos produits">
      <SubscriptionGuard>
        <StaggerContainer className="space-y-6">
        {/* Toolbar */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("common.search")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-60"
                  id="product-search"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44" id="product-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Toutes catégories</SelectItem>
                  {productCategoryOptions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreate} id="btn-new-product">
              <Plus className="h-4 w-4 mr-2" /> Nouveau produit
            </Button>
          </div>
        </StaggerItem>

        {/* Table */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Produit</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">{t("common.category")}</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Marque</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Conditionnement</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">SKU</th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              {p.catalog_id && (
                                <p className="text-xs text-primary/60 flex items-center gap-1 mt-0.5">
                                  <BookOpen className="h-3 w-3" /> Catalogue
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {p.category ? (
                            <Badge variant="outline" className="text-xs">{p.category}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{p.brand || "—"}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {PACKAGING_LABELS[p.packaging_type || "custom"] || p.packaging_type || "—"}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground font-mono">{p.sku || "—"}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} id={`btn-edit-${p.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(p)} id={`btn-del-${p.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">Aucun produit trouvé</p>
                    <p className="text-sm mt-1">Ajoutez votre premier produit avec le bouton ci-dessus</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* ── Modal 3 étapes ───────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); resetModal(); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">
              {editing
                ? "Modifier le produit"
                : step === 1 ? "Nouveau produit" : step === 2 ? "Informations produit" : "Conditionnement"}
            </DialogTitle>
            <DialogDescription className="hidden">
              Formulaire de gestion de produit
            </DialogDescription>
          </DialogHeader>

          {/* Step dots */}
          <div className="px-6 pt-3">
            <StepDots step={step} />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 pb-2">

            {/* ── ÉTAPE 1 — Choix catalogue ou manuel ─────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Entry mode buttons */}
                {!selectedCategory && (
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <button
                      onClick={() => setEntryMode("catalog")}
                      id="btn-mode-catalog"
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        entryMode === "catalog"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <BookOpen className="h-5 w-5 mb-2 text-primary" />
                      <p className="font-semibold text-sm">Depuis le catalogue</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Choisir un produit générique</p>
                    </button>
                    <button
                      onClick={goManual}
                      id="btn-mode-manual"
                      className="rounded-xl border-2 border-border p-4 text-left hover:border-primary/40 transition-all"
                    >
                      <Pen className="h-5 w-5 mb-2 text-muted-foreground" />
                      <p className="font-semibold text-sm">Saisie manuelle</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Produit personnalisé</p>
                    </button>
                  </div>
                )}

                {entryMode === "catalog" && (
                  <>
                    {/* Breadcrumb */}
                    {(selectedCategory || selectedSubcategory) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <button
                          className="hover:text-foreground"
                          onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                        >
                          Catalogue
                        </button>
                        {selectedCategory && (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <button
                              className="hover:text-foreground"
                              onClick={() => setSelectedSubcategory(null)}
                            >
                              {selectedCategory.name}
                            </button>
                          </>
                        )}
                        {selectedSubcategory && (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-foreground">{selectedSubcategory.name}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Category list */}
                    {!selectedCategory && (
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map(cat => (
                          <button
                            key={cat.id}
                            id={`btn-cat-${cat.slug}`}
                            onClick={() => { setSelectedCategory(cat); setSelectedSubcategory(null); }}
                            className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/50 hover:bg-muted/30 transition-all text-left"
                          >
                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-base">
                              <Package className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-sm">{cat.name}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Subcategory list */}
                    {selectedCategory && !selectedSubcategory && (
                      <div className="space-y-1.5">
                        {subcatsForCategory.map(sub => (
                          <button
                            key={sub.id}
                            id={`btn-subcat-${sub.id}`}
                            onClick={() => setSelectedSubcategory(sub)}
                            className="w-full flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:border-primary/50 hover:bg-muted/30 transition-all text-left"
                          >
                            <span className="text-sm font-medium flex-1">{sub.name}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Catalog items list */}
                    {selectedSubcategory && (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Rechercher dans le catalogue..."
                            value={catalogSearch}
                            onChange={e => setCatalogSearch(e.target.value)}
                            className="pl-9"
                            id="catalog-item-search"
                          />
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {itemsForSubcat.map(item => (
                            <button
                              key={item.id}
                              id={`btn-catalog-item-${item.id}`}
                              onClick={() => handleSelectCatalogItem(item)}
                              className="w-full flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:border-primary/50 hover:bg-muted/30 transition-all text-left"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{item.name}</p>
                                {item.default_brand && (
                                  <p className="text-xs text-muted-foreground">{item.default_brand}</p>
                                )}
                              </div>
                              {item.is_fast_moving && (
                                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                          ))}
                          {itemsForSubcat.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">Aucun produit trouvé</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── ÉTAPE 2 — Identité du produit ───────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                {selectedCatalogItem && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Depuis le catalogue</p>
                      <p className="text-sm font-medium truncate">{selectedCatalogItem.name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{selectedCategory?.name}</Badge>
                  </div>
                )}

                <div>
                  <Label htmlFor="prod-name">Nom du produit *</Label>
                  <Input
                    id="prod-name"
                    value={prodName}
                    onChange={e => setProdName(e.target.value)}
                    placeholder="Ex: Shampoing hydratant professionnel"
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prod-brand">Marque</Label>
                    <Input
                      id="prod-brand"
                      value={prodBrand}
                      onChange={e => setProdBrand(e.target.value)}
                      placeholder="Ex: L'Oréal"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prod-sku">SKU / Référence</Label>
                    <Input
                      id="prod-sku"
                      value={prodSku}
                      onChange={e => setProdSku(e.target.value)}
                      placeholder="Code produit"
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
                  💡 Le prix d'achat, le prix de vente et la gestion du stock se configurent dans le module <strong>Inventaire</strong>.
                </p>
              </div>
            )}

            {/* ── ÉTAPE 3 — Conditionnement ───────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-muted/30 border border-border px-4 py-3">
                  <p className="font-semibold text-sm">{prodName}</p>
                  {prodBrand && <p className="text-xs text-muted-foreground mt-0.5">{prodBrand}</p>}
                </div>

                <div>
                  <Label htmlFor="prod-packaging">Type de conditionnement</Label>
                  <Select value={packagingType} onValueChange={v => setPackagingType(v as PackagingType)}>
                    <SelectTrigger id="prod-packaging" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGING_TYPES.map(t => (
                        <SelectItem key={t} value={t}>
                          {PACKAGING_LABELS[t] ?? t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Définit comment ce produit est acheté (caisse, flacon, boîte…).
                  </p>
                </div>

                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Après la création, rendez-vous dans <strong>Inventaire</strong> pour définir le prix d'achat, le prix de vente et la quantité initiale en stock.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/60 backdrop-blur shrink-0">
            <div>
              {(step > 1 || (step === 1 && (selectedCategory || selectedSubcategory))) && (
                <Button variant="ghost" onClick={goBack} id="btn-modal-back">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Retour
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); resetModal(); }} id="btn-modal-cancel">
                Annuler
              </Button>

              {step === 1 && entryMode === "catalog" && !selectedCatalogItem && (
                <Button disabled variant="default" className="opacity-40">
                  Continuer <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {step === 2 && (
                <Button onClick={goToStep3} id="btn-step2-next">
                  Continuer <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {step === 3 && (
                <Button onClick={saveProduct} id="btn-save-product">
                  <Check className="h-4 w-4 mr-1" />
                  {editing ? "Modifier" : "Ajouter"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
