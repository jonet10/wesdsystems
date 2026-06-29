import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Package, ArrowDownUp, Filter, Trash2 } from "lucide-react";
import { inventoryService } from "@/modules/school/services/inventoryService";
import type { SchoolProduct, SchoolStockMovement } from "@/modules/school/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { setBusinessId } from "@/modules/school/services/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Inventory() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<SchoolProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SchoolProduct | null>(null);
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockMovement, setStockMovement] = useState({
    movement_type: "ENTREE",
    quantity: 0,
    notes: ""
  });

  const { user, profile } = useAuth();
  const { format } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  useEffect(() => {
    if (businessId) {
      setBusinessId(businessId);
      loadProducts();
    }
  }, [businessId]);

  const loadProducts = async () => {
    if (!businessId) return;
    try {
      const data = await inventoryService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de charger l'inventaire", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category: formData.get("category") as string,
      sku: formData.get("sku") as string,
      cost_price: Number(formData.get("cost_price")),
      price: Number(formData.get("price")),
      stock_quantity: Number(formData.get("stock_quantity") || 0),
      min_stock_alert: Number(formData.get("min_stock_alert")),
    };

    try {
      if (selectedProduct) {
        await inventoryService.updateProduct(selectedProduct.id, data);
        toast({ title: "Succès", description: "Produit mis à jour" });
      } else {
        await inventoryService.addProduct(data);
        toast({ title: "Succès", description: "Produit ajouté" });
      }
      setIsProductModalOpen(false);
      loadProducts();
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Erreur lors de l'enregistrement", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (product: SchoolProduct) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.name}" ?`)) return;
    try {
      await inventoryService.deleteProduct(product.id);
      toast({ title: "Succès", description: "Produit supprimé avec succès" });
      loadProducts();
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de supprimer le produit", variant: "destructive" });
    }
  };

  const handleSaveStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await inventoryService.addStockMovement({
        product_id: selectedProduct.id,
        movement_type: stockMovement.movement_type as any,
        quantity: Number(stockMovement.quantity),
        notes: stockMovement.notes
      });
      toast({ title: "Succès", description: "Stock mis à jour" });
      setIsStockModalOpen(false);
      loadProducts();
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Erreur de mise à jour du stock", variant: "destructive" });
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventaire</h1>
          <p className="text-muted-foreground">Gestion des fournitures et articles scolaires</p>
        </div>
        <Button onClick={() => { setSelectedProduct(null); setIsProductModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-white shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Ajouter Produit
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
          <Input 
            placeholder="Rechercher par nom ou SKU..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm mt-4">
        <CardContent className="p-0">
          <div className="border rounded-md">
            <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>{t("common.category")}</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Prix de vente</TableHead>
              <TableHead>Stock Actuel</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">{t("common.loading")}</TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun produit trouvé</TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category || "-"}</TableCell>
                  <TableCell>{p.sku || "-"}</TableCell>
                  <TableCell>{format(p.price)}</TableCell>
                  <TableCell>
                    <Badge variant={p.stock_quantity <= p.min_stock_alert ? "destructive" : "secondary"}>
                      {p.stock_quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setSelectedProduct(p); setIsProductModalOpen(true); }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { 
                        setSelectedProduct(p); 
                        setStockMovement({ movement_type: "ENTREE", quantity: 0, notes: "" });
                        setIsStockModalOpen(true); 
                      }}
                    >
                      <ArrowDownUp className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteProduct(p)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
      </Card>

      {/* Modal Produit */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProduct ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Nom du produit *</label>
                <Input name="name" defaultValue={selectedProduct?.name} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.category")}</label>
                <Input name="category" defaultValue={selectedProduct?.category || ""} placeholder="Uniforme, Livres..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU (Code)</label>
                <Input name="sku" defaultValue={selectedProduct?.sku || ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Coût d'achat</label>
                <Input name="cost_price" type="number" step="0.01" defaultValue={selectedProduct?.cost_price || 0} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prix de vente *</label>
                <Input name="price" type="number" step="0.01" defaultValue={selectedProduct?.price || 0} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantité en stock</label>
                <Input name="stock_quantity" type="number" defaultValue={selectedProduct?.stock_quantity || 0} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alerte Stock Bas</label>
                <Input name="min_stock_alert" type="number" defaultValue={selectedProduct?.min_stock_alert || 5} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit">{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Mouvement de Stock */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le stock : {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveStock} className="space-y-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-4">Stock actuel: <span className="font-bold text-black">{selectedProduct?.stock_quantity}</span></p>
                <label className="text-sm font-medium">Type d'opération</label>
                <Select 
                  value={stockMovement.movement_type} 
                  onValueChange={(val) => setStockMovement({...stockMovement, movement_type: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTREE">Entrée (Ajout)</SelectItem>
                    <SelectItem value="SORTIE">Sortie (Perte/Défectueux)</SelectItem>
                    <SelectItem value="AJUSTEMENT">Ajustement (Nouveau Total Absolu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantité</label>
                <Input 
                  type="number" 
                  min="0"
                  required
                  value={stockMovement.quantity || ""}
                  onChange={(e) => setStockMovement({...stockMovement, quantity: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optionnel)</label>
                <Input 
                  value={stockMovement.notes}
                  onChange={(e) => setStockMovement({...stockMovement, notes: e.target.value})}
                  placeholder="Raison du mouvement..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStockModalOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit">{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
