import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, EyeOff, CheckCircle2, Search, Package, Tags, Layers3 } from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

type BrandRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type BeverageRow = {
  id: string;
  category_id: string;
  brand_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  description: string | null;
  units_per_case: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
};

const categorySchema = z.object({
  name: z.string().min(2, "Nom requis"),
  slug: z.string().min(2, "Slug requis"),
  description: z.string().optional().nullable(),
  sort_order: z.coerce.number().min(0),
  active: z.boolean().default(true),
});

const brandSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

const beverageSchema = z.object({
  category_id: z.string().min(1, "Catégorie requise"),
  brand_id: z.string().optional().nullable(),
  name: z.string().min(2, "Nom requis"),
  brand: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  units_per_case: z.coerce.number().min(1),
  image_url: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().min(0),
});

type CategoryFormValues = z.infer<typeof categorySchema>;
type BrandFormValues = z.infer<typeof brandSchema>;
type BeverageFormValues = z.infer<typeof beverageSchema>;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function DataTable<T>({ rows, columns }: { rows: T[]; columns: ColumnDef<T, unknown>[] }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Aucun résultat
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminCatalogPage() {
  const { format } = useCurrency();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [beverages, setBeverages] = useState<BeverageRow[]>([]);
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [editingBeverage, setEditingBeverage] = useState<BeverageRow | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const [isBeverageOpen, setIsBeverageOpen] = useState(false);

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", slug: "", description: "", sort_order: 0, active: true },
  });
  const brandForm = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "", description: "", active: true },
  });
  const beverageForm = useForm<BeverageFormValues>({
    resolver: zodResolver(beverageSchema),
    defaultValues: {
      category_id: "",
      brand_id: "",
      name: "",
      brand: "",
      sku: "",
      description: "",
      units_per_case: 24,
      image_url: "",
      active: true,
      sort_order: 0,
    },
  });

  const loadData = async () => {
    const [
      { data: categoryRows },
      { data: brandRows },
      { data: beverageRows },
    ] = await Promise.all([
      supabase.from("master_beverage_categories").select("id, name, slug, description, sort_order, active").order("sort_order", { ascending: true }),
      supabase.from("master_beverage_brands").select("id, name, description, active").order("name", { ascending: true }),
      supabase.from("master_beverages").select("id, category_id, brand_id, name, brand, sku, description, units_per_case, image_url, active, sort_order").order("sort_order", { ascending: true }),
    ]);

    setCategories((categoryRows || []) as CategoryRow[]);
    setBrands((brandRows || []) as BrandRow[]);
    setBeverages((beverageRows || []) as BeverageRow[]);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
    description: category.slug,
  }));

  const brandOptions = brands.map((brand) => ({
    value: brand.id,
    label: brand.name,
    description: brand.description || undefined,
  }));

  const filteredBeverages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return beverages;
    return beverages.filter((item) => {
      const category = categories.find((cat) => cat.id === item.category_id);
      return [
        item.name,
        item.brand,
        item.sku,
        item.description,
        category?.name,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [beverages, categories, search]);

  const openCategory = (category?: CategoryRow) => {
    setEditingCategory(category || null);
    categoryForm.reset(category ? category : { name: "", slug: "", description: "", sort_order: 0, active: true });
    setIsCategoryOpen(true);
  };

  const openBrand = (brand?: BrandRow) => {
    setEditingBrand(brand || null);
    brandForm.reset(brand ? brand : { name: "", description: "", active: true });
    setIsBrandOpen(true);
  };

  const openBeverage = (beverage?: BeverageRow) => {
    setEditingBeverage(beverage || null);
    beverageForm.reset(beverage ? {
      category_id: beverage.category_id,
      brand_id: beverage.brand_id || "",
      name: beverage.name,
      brand: beverage.brand || "",
      sku: beverage.sku || "",
      description: beverage.description || "",
      units_per_case: beverage.units_per_case,
      image_url: beverage.image_url || "",
      active: beverage.active,
      sort_order: beverage.sort_order,
    } : {
      category_id: categories[0]?.id || "",
      brand_id: "",
      name: "",
      brand: "",
      sku: "",
      description: "",
      units_per_case: 24,
      image_url: "",
      active: true,
      sort_order: 0,
    });
    setIsBeverageOpen(true);
  };

  const saveCategory = categoryForm.handleSubmit(async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        slug: slugify(values.slug || values.name),
        description: values.description?.trim() || null,
        sort_order: values.sort_order,
        active: values.active,
      };
      if (editingCategory) {
        const { error } = await supabase.from("master_beverage_categories").update(payload).eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_beverage_categories").insert([payload]);
        if (error) throw error;
      }
      toast.success("Catégorie enregistrée.");
      setIsCategoryOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer la catégorie.");
    }
  });

  const saveBrand = brandForm.handleSubmit(async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        active: values.active,
      };
      if (editingBrand) {
        const { error } = await supabase.from("master_beverage_brands").update(payload).eq("id", editingBrand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_beverage_brands").insert([payload]);
        if (error) throw error;
      }
      toast.success("Marque enregistrée.");
      setIsBrandOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer la marque.");
    }
  });

  const saveBeverage = beverageForm.handleSubmit(async (values) => {
    try {
      const selectedCategory = categories.find((cat) => cat.id === values.category_id);
      const selectedBrand = brands.find((brand) => brand.id === values.brand_id);
      const payload = {
        category_id: values.category_id,
        brand_id: values.brand_id || null,
        name: values.name.trim(),
        brand: values.brand?.trim() || selectedBrand?.name || null,
        sku: values.sku?.trim() || null,
        description: values.description?.trim() || null,
        units_per_case: values.units_per_case,
        image_url: values.image_url?.trim() || null,
        active: values.active,
        sort_order: values.sort_order,
      };
      if (editingBeverage) {
        const { error } = await supabase.from("master_beverages").update(payload).eq("id", editingBeverage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_beverages").insert([payload]);
        if (error) throw error;
      }
      toast.success("Beverage enregistrée.");
      setIsBeverageOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer la boisson.");
    }
  });

  const deleteCategory = async (category: CategoryRow) => {
    const { error } = await supabase.from("master_beverage_categories").delete().eq("id", category.id);
    if (error) return toast.error(error.message);
    toast.success("Catégorie supprimée.");
    await loadData();
  };

  const deleteBrand = async (brand: BrandRow) => {
    const { error } = await supabase.from("master_beverage_brands").delete().eq("id", brand.id);
    if (error) return toast.error(error.message);
    toast.success("Marque supprimée.");
    await loadData();
  };

  const deleteBeverage = async (beverage: BeverageRow) => {
    const { error } = await supabase.from("master_beverages").delete().eq("id", beverage.id);
    if (error) return toast.error(error.message);
    toast.success("Beverage supprimée.");
    await loadData();
  };

  const toggleBeverage = async (beverage: BeverageRow) => {
    const { error } = await supabase.from("master_beverages").update({ active: !beverage.active }).eq("id", beverage.id);
    if (error) return toast.error(error.message);
    toast.success(beverage.active ? "Beverage désactivée." : "Beverage activée.");
    await loadData();
  };

  const categoryColumns: ColumnDef<CategoryRow>[] = [
    { header: "Nom", cell: ({ row }) => row.original.name },
    { header: "Slug", cell: ({ row }) => row.original.slug },
    { header: "Ordre", cell: ({ row }) => row.original.sort_order },
    { header: "Statut", cell: ({ row }) => <Badge variant={row.original.active ? "default" : "secondary"}>{row.original.active ? "Actif" : "Inactif"}</Badge> },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCategory(row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCategory(row.original)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const brandColumns: ColumnDef<BrandRow>[] = [
    { header: "Nom", cell: ({ row }) => row.original.name },
    { header: "Description", cell: ({ row }) => row.original.description || "—" },
    { header: "Statut", cell: ({ row }) => <Badge variant={row.original.active ? "default" : "secondary"}>{row.original.active ? "Actif" : "Inactif"}</Badge> },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBrand(row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBrand(row.original)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const beverageColumns: ColumnDef<BeverageRow>[] = [
    {
      header: "Beverage",
      cell: ({ row }) => {
        const category = categories.find((cat) => cat.id === row.original.category_id);
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.original.name}</span>
              <Badge variant={row.original.active ? "default" : "secondary"}>{row.original.active ? "Actif" : "Inactif"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{category?.name || "—"}</div>
          </div>
        );
      },
    },
    { header: "Marque", cell: ({ row }) => row.original.brand || "—" },
    { header: "SKU", cell: ({ row }) => row.original.sku || "—" },
    { header: "Unités/caisse", cell: ({ row }) => row.original.units_per_case },
    { header: "Image", cell: ({ row }) => row.original.image_url ? "Oui" : "—" },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBeverage(row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleBeverage(row.original)}>
            {row.original.active ? <EyeOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBeverage(row.original)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout role="super_admin" title="Catalogue global" subtitle="Catégories, marques et boissons pour tous les modules" userName="Admin Wesd Systems">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Catégories</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{categories.length}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Marques</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{brands.length}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Boissons</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{beverages.length}</p></CardContent></Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <Tabs defaultValue="beverages" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl">
              <TabsTrigger value="beverages" className="gap-2"><Package className="h-4 w-4" /> Boissons</TabsTrigger>
              <TabsTrigger value="categories" className="gap-2"><Layers3 className="h-4 w-4" /> Catégories</TabsTrigger>
              <TabsTrigger value="brands" className="gap-2"><Tags className="h-4 w-4" /> Marques</TabsTrigger>
            </TabsList>

            <TabsContent value="beverages" className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une boisson..." className="pl-9" />
                </div>
                <Button onClick={() => openBeverage()}>
                  <Plus className="mr-2 h-4 w-4" /> Nouvelle boisson
                </Button>
              </div>
              <DataTable rows={filteredBeverages} columns={beverageColumns} />
            </TabsContent>

            <TabsContent value="categories" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => openCategory()}>
                  <Plus className="mr-2 h-4 w-4" /> Nouvelle catégorie
                </Button>
              </div>
              <DataTable rows={categories} columns={categoryColumns} />
            </TabsContent>

            <TabsContent value="brands" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => openBrand()}>
                  <Plus className="mr-2 h-4 w-4" /> Nouvelle marque
                </Button>
              </div>
              <DataTable rows={brands} columns={brandColumns} />
            </TabsContent>
          </Tabs>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>{editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={saveCategory}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nom</Label><Input {...categoryForm.register("name")} onChange={(e) => { categoryForm.setValue("name", e.target.value); if (!editingCategory) categoryForm.setValue("slug", slugify(e.target.value)); }} /></div>
              <div className="space-y-2"><Label>Slug</Label><Input {...categoryForm.register("slug")} /></div>
              <div className="space-y-2"><Label>Ordre</Label><Input type="number" {...categoryForm.register("sort_order")} /></div>
              <div className="space-y-2">
                <Label>Actif</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Switch checked={categoryForm.watch("active")} onCheckedChange={(checked) => categoryForm.setValue("active", checked)} />
                  <span className="text-sm text-muted-foreground">Disponible dans le catalogue</span>
                </div>
              </div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={4} {...categoryForm.register("description")} /></div>
            <DialogFooter><Button variant="outline" type="button" onClick={() => setIsCategoryOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBrandOpen} onOpenChange={setIsBrandOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>{editingBrand ? "Modifier la marque" : "Nouvelle marque"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={saveBrand}>
            <div className="space-y-2"><Label>Nom</Label><Input {...brandForm.register("name")} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={4} {...brandForm.register("description")} /></div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch checked={brandForm.watch("active")} onCheckedChange={(checked) => brandForm.setValue("active", checked)} />
              <span className="text-sm text-muted-foreground">Marque active</span>
            </div>
            <DialogFooter><Button variant="outline" type="button" onClick={() => setIsBrandOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBeverageOpen} onOpenChange={setIsBeverageOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader><DialogTitle>{editingBeverage ? "Modifier la boisson" : "Nouvelle boisson"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={saveBeverage}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Catégorie *</Label>
                <SearchableSelect
                  value={beverageForm.watch("category_id")}
                  onValueChange={(value) => beverageForm.setValue("category_id", value)}
                  options={categoryOptions}
                  placeholder="Choisir une catégorie"
                  searchPlaceholder="Rechercher une catégorie"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Marque</Label>
                <SearchableSelect
                  value={beverageForm.watch("brand_id") || ""}
                  onValueChange={(value) => {
                    beverageForm.setValue("brand_id", value);
                    const brand = brands.find((item) => item.id === value);
                    if (brand) beverageForm.setValue("brand", brand.name);
                  }}
                  options={[{ value: "", label: "Sans marque" }, ...brandOptions]}
                  placeholder="Choisir une marque"
                  searchPlaceholder="Rechercher une marque"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Nom *</Label>
                <Input {...beverageForm.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input {...beverageForm.register("sku")} />
              </div>
              <div className="space-y-2">
                <Label>Unités par caisse</Label>
                <Input type="number" {...beverageForm.register("units_per_case")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Image URL</Label>
                <Input {...beverageForm.register("image_url")} placeholder="https://..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea rows={4} {...beverageForm.register("description")} />
              </div>
              <div className="space-y-2">
                <Label>Ordre</Label>
                <Input type="number" {...beverageForm.register("sort_order")} />
              </div>
              <div className="space-y-2">
                <Label>Actif</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Switch checked={beverageForm.watch("active")} onCheckedChange={(checked) => beverageForm.setValue("active", checked)} />
                  <span className="text-sm text-muted-foreground">Visible dans le catalogue</span>
                </div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" type="button" onClick={() => setIsBeverageOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
