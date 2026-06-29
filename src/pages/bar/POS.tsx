import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { printReceipt as printReceiptPdf } from "@/lib/print-utils";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Download, Search,
  Package, Beer, CreditCard, Banknote, Utensils
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveBranchId } from "@/lib/branch";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";

interface CatalogItem {
  id: string;
  name: string;
  price_per_unit?: number;
  price_per_case?: number;
  price?: number; // for cocktails
  type: "product" | "cocktail";
  stock_units?: number;
  stock_cases?: number;
  units_per_case?: number;
}

interface CartItem {
  key: string;
  type: "product" | "cocktail";
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  sale_type: "UNITE" | "CAISSE" | "COCKTAIL";
}

export default function BarPOS() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { currencyCode, format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [cocktails, setCocktails] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [paymentMethod, setPaymentMethod] = useState<"ESPECES" | "CARTE" | "TRANSFERT" | "CREDIT">("ESPECES");
  const [activeTab, setActiveTab] = useState<"products" | "cocktails">("products");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Modal for product options (Unit or Case)
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(null);

  const loadData = async () => {
    try {
      if (!branchId) return;
      
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from("bar_products").select("*").eq("is_active", true).eq("branch_id", branchId),
        supabase.from("bar_cocktails").select("*").eq("is_active", true).eq("branch_id", branchId),
      ]);
      
      setProducts((p || []).map(x => ({ ...x, type: "product" as const })));
      setCocktails((c || []).map(x => ({ ...x, type: "cocktail" as const })));
    } catch (err) {
      console.error("Error loading Bar POS data:", err);
    }
  };

  useEffect(() => {
    void loadData();
  }, [branchId]);

  const handleItemClick = (item: CatalogItem) => {
    if (item.type === "product") {
      setSelectedProduct(item);
      setOptionsModalOpen(true);
    } else {
      addToCart(item, "COCKTAIL", item.price || 0);
    }
  };

  const addToCart = (item: CatalogItem, sale_type: "UNITE" | "CAISSE" | "COCKTAIL", price: number) => {
    const key = `${item.id}-${sale_type}`;
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        key,
        type: item.type,
        item_id: item.id,
        name: item.name + (sale_type === "CAISSE" ? " (Caisse)" : sale_type === "UNITE" ? " (Unité)" : ""),
        quantity: 1,
        unit_price: price,
        sale_type
      }];
    });
    setOptionsModalOpen(false);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.key === key) {
        const newQ = i.quantity + delta;
        return newQ > 0 ? { ...i, quantity: newQ } : i;
      }
      return i;
    }));
  };

  const removeFromCart = (key: string) => {
    setCart(prev => prev.filter(i => i.key !== key));
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    return { subtotal, total: subtotal };
  }, [cart]);

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");
    if (!branchId) return toast.error("Branche non sélectionnée");

    try {
      // 1. Create Sale
      const { data: sale, error: saleError } = await supabase
        .from("bar_sales")
        .insert([{
          branch_id: branchId,
          sale_type: "BAR",
          payment_method: paymentMethod,
          subtotal: totals.subtotal,
          total: totals.total,
        }])
        .select("id, created_at")
        .single();

      if (saleError || !sale?.id) throw new Error(saleError?.message || "Erreur de création de vente");

      // 2. Create Sale Items
      const items = cart.map(i => ({
        sale_id: sale.id,
        ...(i.type === "product" ? { product_id: i.item_id } : { cocktail_id: i.item_id }),
        item_type: i.sale_type,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.quantity * i.unit_price,
      }));

      const { error: itemErr } = await supabase.from("bar_sale_items").insert(items);
      if (itemErr) throw new Error(itemErr.message);

      // 3. Update Inventory & Record Movements via RPC or manual logic (simple logic here)
      for (const item of cart) {
        if (item.type === "product") {
          const product = products.find((p) => p.id === item.item_id);
          if (!product) continue;

          let newCases = product.stock_cases || 0;
          let newUnits = product.stock_units || 0;
          
          if (item.sale_type === "CAISSE") {
            newCases = Math.max(0, newCases - item.quantity);
          } else if (item.sale_type === "UNITE") {
            newUnits = newUnits - item.quantity;
            // Handle breakdown from cases to units
            // Note: the prompt requested automatic deduction.
            const unitsPerCase = product.units_per_case || 24;
            while (newUnits < 0 && newCases > 0) {
              newCases -= 1;
              newUnits += unitsPerCase;
            }
            if (newUnits < 0) newUnits = 0; // Prevent negative stock if out of cases
          }

          await supabase.from("bar_products")
            .update({ stock_cases: newCases, stock_units: newUnits })
            .eq("id", item.item_id);
            
          await supabase.from("bar_stock_movements").insert({
            branch_id: branchId,
            product_id: item.item_id,
            movement_type: "VENTE",
            quantity_cases: item.sale_type === "CAISSE" ? item.quantity : 0,
            quantity_units: item.sale_type === "UNITE" ? item.quantity : 0,
            reference_id: sale.id,
            notes: "Vente POS Bar"
          });
        }
      }

      toast.success("Vente enregistrée avec succès !");
      setLastSale({ ...sale, items: cart, payment: paymentMethod, sale_number: sale.id.split('-')[0].toUpperCase() });
      setShowReceipt(true);
      setCart([]);
      await loadData();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const currentItems = activeTab === "products" ? products : cocktails;
  const filteredItems = currentItems.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin" title="Bar POS" subtitle="Point de vente pour Bar & Restaurant">
      <StaggerContainer className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
        <StaggerItem className="flex-1 flex flex-col min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant={activeTab === "products" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("products")} className="gap-1">
                    <Package className="h-4 w-4" /> Boissons
                  </Button>
                  <Button variant={activeTab === "cocktails" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("cocktails")} className="gap-1">
                    <Beer className="h-4 w-4" /> Cocktails
                  </Button>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t("common.search")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredItems.map((item: any) => (
                    <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-soft active:scale-[0.98]"
                      onClick={() => handleItemClick(item)}>
                      <CardContent className="p-3">
                        <div className={cn(
                          "w-full h-14 rounded-lg flex items-center justify-center mb-2",
                          activeTab === "products" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                        )}>
                          {activeTab === "products" ? <Package className="h-6 w-6" /> : <Beer className="h-6 w-6" />}
                        </div>
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {item.type === "product" ? (
                          <div className="flex justify-between mt-1 items-end">
                            <p className="text-xs text-muted-foreground">
                              {item.stock_cases} cs | {item.stock_units} un
                            </p>
                            <p className="text-primary font-semibold text-sm">{format(item.price_per_unit || 0)}</p>
                          </div>
                        ) : (
                          <p className="text-primary font-semibold mt-1 text-sm">{format(item.price || 0)}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-8 text-sm">Aucun élément trouvé</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem className="w-full lg:w-96 flex flex-col">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" /> Commande ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 pr-2 -mr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Utensils className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Ajoutez des boissons pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{format(item.unit_price)} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.key, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.key, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.key)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator className="my-3" />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>{t("common.total")}</span>
                  <span className="text-primary">{format(totals.total)}</span>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label>Mode de Paiement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "ESPECES", label: "Espèces", icon: Banknote },
                      { id: "CARTE", label: "Carte", icon: CreditCard },
                      { id: "TRANSFERT", label: "Transfert", icon: Banknote },
                      { id: "CREDIT", label: "Crédit", icon: Banknote },
                    ].map(method => {
                      const Icon = method.icon;
                      return (
                        <Button key={method.id} variant={paymentMethod === method.id ? "default" : "outline"}
                          className={cn("justify-start gap-2 h-10", paymentMethod === method.id && "bg-primary")}
                          onClick={() => setPaymentMethod(method.id as any)}>
                          <Icon className="h-4 w-4" />
                          {method.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0}>
                  Annuler
                </Button>
                <Button onClick={checkout} disabled={cart.length === 0} className="bg-primary h-11 text-base font-semibold">
                  Encaisser • {format(totals.total)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Modal Caisse / Unité */}
      <Dialog open={optionsModalOpen} onOpenChange={setOptionsModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Type de vente pour {selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Souhaitez-vous vendre ce produit à l'unité ou par caisse ?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 border-primary/20 hover:border-primary"
              onClick={() => {
                if (selectedProduct) addToCart(selectedProduct, "UNITE", selectedProduct.price_per_unit || 0);
              }}
            >
              <Package className="h-6 w-6" />
              <span>À l'unité</span>
              <span className="text-primary font-bold">{format(selectedProduct?.price_per_unit || 0)}</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 border-primary/20 hover:border-primary"
              onClick={() => {
                if (selectedProduct) addToCart(selectedProduct, "CAISSE", selectedProduct.price_per_case || 0);
              }}
            >
              <Package className="h-8 w-8" />
              <span>Par Caisse</span>
              <span className="text-primary font-bold">{format(selectedProduct?.price_per_case || 0)}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Reçu #{lastSale?.sale_number || ""}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => {
                  if (!lastSale || !receiptRef.current) return;
                  const data: ReceiptData = {
                    business: {
                      name: "BAR / RESTAURANT",
                    },
                    transaction: {
                      invoiceNumber: lastSale.sale_number || lastSale.id,
                      date: lastSale.created_at || new Date().toISOString(),
                      cashierName: user?.user_metadata?.name || "Caisse",
                      cashRegister: "CAISSE BAR",
                    },
                    items: lastSale.items?.map((i: any) => ({
                      name: i.name || i.item_name,
                      quantity: i.quantity,
                      price: i.unit_price,
                      total: i.quantity * i.unit_price
                    })) || [],
                    totals: {
                      subtotal: lastSale.total || 0,
                      total: lastSale.total || 0,
                    },
                    payment: {
                      method: lastSale.payment || "ESPÈCES",
                      amountReceived: lastSale.total || 0,
                    },
                    currencyCode: currencyCode,
                  };
                  printUnifiedReceipt(data, format);
                }} className="gap-1">
                  <Printer className="h-4 w-4" /> Imprimer
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="bg-gray-100 p-2 rounded flex justify-center max-h-[60vh] overflow-y-auto">
            <ReceiptTemplate
              ref={receiptRef}
              formatAmount={format}
              data={{
                business: {
                  name: "BAR / RESTAURANT",
                },
                transaction: {
                  invoiceNumber: lastSale?.sale_number || lastSale?.id,
                  date: lastSale?.created_at || new Date().toISOString(),
                  cashierName: user?.user_metadata?.name || "Caisse",
                  cashRegister: "CAISSE BAR",
                },
                items: lastSale?.items?.map((i: any) => ({
                  name: i.name || i.item_name,
                  quantity: i.quantity,
                  price: i.unit_price,
                  total: i.quantity * i.unit_price
                })) || [],
                totals: {
                  subtotal: lastSale?.total || 0,
                  total: lastSale?.total || 0,
                },
                payment: {
                  method: lastSale?.payment || "ESPÈCES",
                  amountReceived: lastSale?.total || 0,
                },
                currencyCode: currencyCode,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
