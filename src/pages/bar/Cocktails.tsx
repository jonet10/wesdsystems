import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { toast } from "sonner";
import { Beer, Search, Plus, Trash2, Edit } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Cocktail {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  volume_ml: number;
}

interface Ingredient {
  product_id: string;
  product_name?: string;
  quantity_ml: number;
}

export default function BarCocktails() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);

  const [cocktails, setCocktails] = useState<Cocktail[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modal Recipe
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [recipePrice, setRecipePrice] = useState(0);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState("");
  const [ingredientMl, setIngredientMl] = useState(0);

  const loadData = async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const [{ data: cData }, { data: pData }] = await Promise.all([
        supabase.from("bar_cocktails").select("*").eq("branch_id", branchId).order("name"),
        supabase.from("bar_products").select("id, name, volume_ml").eq("branch_id", branchId).order("name"),
      ]);
      
      setCocktails(cData || []);
      setProducts(pData || []);
    } catch (err: any) {
      toast.error("Erreur de chargement");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  const handleOpenRecipe = (cocktail?: Cocktail) => {
    if (cocktail) {
      setEditingId(cocktail.id);
      setRecipeName(cocktail.name);
      setRecipePrice(cocktail.price);
      // Fetch ingredients
      supabase.from("bar_cocktail_ingredients")
        .select("product_id, quantity_ml")
        .eq("cocktail_id", cocktail.id)
        .then(({ data }) => {
          if (data) {
            setIngredients(data.map(d => ({
              product_id: d.product_id,
              product_name: products.find(p => p.id === d.product_id)?.name,
              quantity_ml: d.quantity_ml
            })));
          }
        });
    } else {
      setEditingId(null);
      setRecipeName("");
      setRecipePrice(0);
      setIngredients([]);
    }
    setRecipeModalOpen(true);
  };

  const addIngredient = () => {
    if (!selectedProductId || ingredientMl <= 0) return toast.error("Sélectionnez un produit et une quantité valide");
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if (ingredients.find(i => i.product_id === selectedProductId)) {
      setIngredients(prev => prev.map(i => i.product_id === selectedProductId ? { ...i, quantity_ml: i.quantity_ml + ingredientMl } : i));
    } else {
      setIngredients(prev => [...prev, { product_id: selectedProductId, product_name: product.name, quantity_ml: ingredientMl }]);
    }
    setSelectedProductId("");
    setIngredientMl(0);
  };

  const removeIngredient = (id: string) => {
    setIngredients(prev => prev.filter(i => i.product_id !== id));
  };

  const saveRecipe = async () => {
    if (!recipeName || recipePrice <= 0 || ingredients.length === 0) {
      return toast.error("Nom, prix, et au moins 1 ingrédient requis");
    }
    if (!branchId) return;

    try {
      let cocktailId = editingId;

      if (cocktailId) {
        await supabase.from("bar_cocktails").update({
          name: recipeName,
          price: recipePrice,
        }).eq("id", cocktailId);
        
        await supabase.from("bar_cocktail_ingredients").delete().eq("cocktail_id", cocktailId);
      } else {
        const { data, error } = await supabase.from("bar_cocktails").insert({
          branch_id: branchId,
          name: recipeName,
          price: recipePrice,
        }).select("id").single();
        if (error) throw error;
        cocktailId = data.id;
      }

      if (cocktailId) {
        await supabase.from("bar_cocktail_ingredients").insert(
          ingredients.map(i => ({
            cocktail_id: cocktailId,
            product_id: i.product_id,
            quantity_ml: i.quantity_ml,
          }))
        );
      }

      toast.success("Recette enregistrée avec succès");
      setRecipeModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur de sauvegarde");
    }
  };

  const filteredCocktails = cocktails.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin" title="Cocktails & Recettes" subtitle="Gérer les recettes avec déduction automatique des ingrédients">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Beer className="h-5 w-5 text-primary" /> Liste des Cocktails
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un cocktail..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button className="gap-2" onClick={() => handleOpenRecipe()}>
                  <Plus className="h-4 w-4" /> Nouvelle Recette
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Chargement...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCocktails.map((c) => (
                    <Card key={c.id} className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-sm text-primary font-medium">{format(c.price)}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenRecipe(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredCocktails.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground">
                      Aucun cocktail trouvé.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={recipeModalOpen} onOpenChange={setRecipeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier Recette" : "Nouvelle Recette"}</DialogTitle>
            <DialogDescription>Définissez le prix de vente et les ingrédients exacts (en ml) qui seront déduits du stock.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du Cocktail</Label>
                <Input value={recipeName} onChange={e => setRecipeName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Prix de Vente</Label>
                <Input type="number" min="0" value={recipePrice} onChange={e => setRecipePrice(Number(e.target.value))} />
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <Label>Ajouter Ingrédient (Alcool, Jus, Sirop)</Label>
              <div className="flex gap-2 items-center">
                <select 
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Sélectionner un produit...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Vol: {p.volume_ml}ml)</option>
                  ))}
                </select>
                <div className="relative w-24">
                  <Input type="number" placeholder="Quantité" min="0" value={ingredientMl || ""} onChange={e => setIngredientMl(Number(e.target.value))} className="pr-7" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ml</span>
                </div>
                <Button size="icon" onClick={addIngredient}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 border rounded-md text-sm">
                    <span>{ing.product_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{ing.quantity_ml} ml</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeIngredient(ing.product_id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {ingredients.length === 0 && <p className="text-xs text-muted-foreground text-center">Aucun ingrédient</p>}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipeModalOpen(false)}>Annuler</Button>
            <Button onClick={saveRecipe}>Enregistrer la recette</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
