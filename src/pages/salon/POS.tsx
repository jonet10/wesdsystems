import { useEffect, useMemo, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Download, Search,
  Package, Scissors, CreditCard, Banknote, Wallet, User,
  Beer, Gift, Percent, Tag, Barcode
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ReceiptTemplate } from "@/components/ui/ReceiptTemplate";
import { PromotionBadge } from "@/components/modules/salon/PromotionBadge";

interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  category?: string;
  type: "product" | "service" | "beverage";
  stock?: number;
  image_url?: string;
  barcode?: string;
}

interface CartItem {
  key: string;
  type: "product" | "service" | "beverage";
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  category?: string;
  promotion_applied?: boolean;
  promotion_name?: string;
  discount?: number;
}

interface Promotion {
  id: string;
  name: string;
  description?: string;
  promotion_type: "percentage" | "fixed_amount" | "bundle" | "combo";
  discount_value?: number;
  discount_percentage?: number;
  items_config: { services?: string[]; products?: string[]; beverages?: string[] };
  minimum_quantity?: number;
}

export default function POSPage() {
  const { currencyCode, format } = useCurrency();
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [beverages, setBeverages] = useState<CatalogItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "services" | "beverages">("products");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [{ data: p }, { data: s }, { data: b }, { data: promos }] = await Promise.all([
        supabase.from("salon_products").select("id, name, unit_price, category, quantity_in_stock, barcode").eq("is_active", true).order("name"),
        supabase.from("salon_services").select("id, name, price_htg, category_id, duration_minutes").eq("is_active", true).order("name"),
        supabase.from("salon_beverages").select("id, name, unit_price, brand, total_units_available, barcode").eq("is_active", true).order("name"),
        supabase.from("salon_promotions").select("*").eq("is_active", true).lte("valid_from", new Date().toISOString().split("T")[0]).gte("valid_until", new Date().toISOString().split("T")[0]),
      ]);
      setProducts((p || []).map(x => ({ ...x, unit_price: Number(x.unit_price || 0), stock: x.quantity_in_stock, type: "product" as const })));
      setServices((s || []).map(x => ({ ...x, unit_price: Number(x.price_htg || 0), type: "service" as const })));
      setBeverages((b || []).map(x => ({ ...x, unit_price: Number(x.unit_price || 0), stock: x.total_units_available, type: "beverage" as const })));
      setPromotions((promos || []) as Promotion[]);
    } catch (err) {
      console.error("Erreur chargement POS:", err);
      toast.error("Impossible de charger le catalogue");
    }
  };

  useEffect(() => { loadData(); }, []);

  const detectPromotions = (cartItems: CartItem[]): CartItem[] => {
    return cartItems.map(item => {
      const applicablePromo = promotions.find(p => {
        if (p.promotion_type === "percentage" || p.promotion_type === "fixed_amount") {
          if (item.type === "product" && p.items_config?.products?.includes(item.item_id)) return true;
          if (item.type === "service" && p.items_config?.services?.includes(item.item_id)) return true;
          if (item.type === "beverage" && p.items_config?.beverages?.includes(item.item_id)) return true;
        }
        if (p.promotion_type === "bundle" && p.minimum_quantity && item.quantity >= p.minimum_quantity) {
          return true;
        }
        if (p.promotion_type === "combo") {
          const sameTypeItems = cartItems.filter(ci => ci.type === item.type);
          if (p.minimum_quantity && sameTypeItems.length >= p.minimum_quantity) return true;
        }
        return false;
      });

      if (applicablePromo) {
        let discount = 0;
        if (applicablePromo.promotion_type === "percentage" && applicablePromo.discount_percentage) {
          discount = item.unit_price * item.quantity * (applicablePromo.discount_percentage / 100);
        } else if (applicablePromo.promotion_type === "fixed_amount" && applicablePromo.discount_value) {
          discount = applicablePromo.discount_value;
        } else if (applicablePromo.promotion_type === "bundle" && applicablePromo.discount_value) {
          discount = applicablePromo.discount_value;
        }
        return { ...item, promotion_applied: true, promotion_name: applicablePromo.name, discount };
      }
      return { ...item, promotion_applied: false, discount: 0 };
    });
  };

  const addToCart = (item: CatalogItem, type: "product" | "service" | "beverage") => {
    setCart(prev => {
      const key = `${type}-${item.id}`;
      const idx = prev.findIndex(i => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return detectPromotions(next);
      }
      const newCart = [...prev, {
        key, type, item_id: item.id, name: item.name,
        quantity: 1, unit_price: item.unit_price, category: item.category,
        promotion_applied: false, discount: 0,
      }];
      return detectPromotions(newCart);
    });
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(prev => {
      const next = prev.map(item => {
        if (item.key !== key) return item;
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }).filter(Boolean) as CartItem[];
      return detectPromotions(next);
    });
  };

  const removeFromCart = (key: string) => {
    setCart(prev => detectPromotions(prev.filter(i => i.key !== key)));
  };

  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0), [cart]);
  const totalDiscount = useMemo(() => {
    const promoDiscount = cart.reduce((sum, i) => sum + (i.discount || 0), 0);
    const manualDiscount = subtotal * (discountPercent / 100);
    return promoDiscount + manualDiscount;
  }, [cart, subtotal, discountPercent]);
  const total = Math.max(0, subtotal - totalDiscount);

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");

    try {
      const { data: sale, error: saleError } = await supabase
        .from("salon_sales")
        .insert([{
          customer_name: customerName || null,
          payment_method: paymentMethod,
          total_amount: total,
          discount_amount: totalDiscount,
          discount_percentage: discountPercent,
          tax_amount: 0,
        }])
        .select("id, sale_number, created_at")
        .single();

      if (saleError || !sale?.id) throw new Error(saleError?.message || "Vente impossible");

      const items = cart.map(i => ({
        sale_id: sale.id,
        ...(i.type === "product" ? { product_id: i.item_id } : {}),
        ...(i.type === "service" ? { service_id: i.item_id } : {}),
        ...(i.type === "beverage" ? { beverage_id: i.item_id } : {}),
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price - (i.discount || 0),
      }));

      const { error: itemErr } = await supabase.from("salon_sale_items").insert(items);
      if (itemErr) throw new Error(itemErr.message);

      toast.success("Vente enregistrée avec succès !");

      // Update beverage stock
      for (const item of cart) {
        if (item.type === "beverage") {
          await supabase.rpc("sell_beverage_units", {
            p_beverage_id: item.item_id,
            p_units_sold: item.quantity,
          }).catch(() => {});
        }
      }

      setLastSale({ ...sale, items: cart, customer: customerName, payment: paymentMethod });
      setShowReceipt(true);
      setCart([]);
      setCustomerName("");
      setDiscountPercent(0);
      await loadData();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const printReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#ffffff", width: 300, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 297] });
      const imgWidth = 76;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;
      pdf.addImage(imgData, "PNG", 2, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 2, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }
      const fileName = `recu-${lastSale?.sale_number || Date.now()}.pdf`;
      pdf.save(fileName);
      toast.success("Reçu PDF téléchargé !");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Erreur PDF, utilisation impression navigateur...");
      window.print();
    }
  };

  const currentItems = activeTab === "products" ? products : activeTab === "services" ? services : beverages;
  const filteredItems = currentItems.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.barcode || "").includes(searchTerm)
  );

  const hasActivePromotions = promotions.length > 0;

  return (
    <DashboardLayout role="salon_admin" title="POS / Caisse" subtitle="Encaissement rapide avec promotions automatiques">
      <StaggerContainer className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
        <StaggerItem className="flex-1 flex flex-col min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant={activeTab === "products" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("products")} className="gap-1">
                    <Package className="h-4 w-4" /> Produits
                  </Button>
                  <Button variant={activeTab === "services" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("services")} className="gap-1">
                    <Scissors className="h-4 w-4" /> Prestations
                  </Button>
                  <Button variant={activeTab === "beverages" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("beverages")} className="gap-1">
                    <Beer className="h-4 w-4" /> Boissons
                  </Button>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher ou scan code-barres..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
                  <Barcode className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {hasActivePromotions && (
                <div className="flex flex-wrap gap-1.5">
                  {promotions.map(p => (
                    <PromotionBadge key={p.id} type={p.promotion_type} value={p.discount_percentage || p.discount_value} />
                  ))}
                  <span className="text-xs text-muted-foreground self-center ml-1">
                    Promotions actives — appliquées automatiquement
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredItems.map((item: any) => (
                    <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-soft active:scale-[0.98]"
                      onClick={() => addToCart(item, activeTab === "products" ? "product" : activeTab === "services" ? "service" : "beverage")}>
                      <CardContent className="p-3">
                        <div className={cn(
                          "w-full h-14 rounded-lg flex items-center justify-center mb-2",
                          activeTab === "products" ? "bg-primary/10 text-primary" :
                          activeTab === "services" ? "bg-info/10 text-info" :
                          "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
                        )}>
                          {activeTab === "products" ? <Package className="h-6 w-6" /> :
                           activeTab === "services" ? <Scissors className="h-6 w-6" /> :
                           <Beer className="h-6 w-6" />}
                        </div>
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.stock !== undefined ? `Stock: ${item.stock}` : item.duration_minutes ? `${item.duration_minutes}min` : ""}
                        </p>
                        <p className="text-primary font-semibold mt-1 text-sm">{format(item.unit_price)}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-8 text-sm">
                      Aucun élément trouvé
                    </p>
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
                <ShoppingCart className="h-4 w-4" /> Panier ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 pr-2 -mr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Ajoutez des articles pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.key} className={cn(
                        "flex items-center gap-2 p-2 rounded-lg",
                        item.promotion_applied ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" : "bg-muted/40"
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs text-muted-foreground">{format(item.unit_price)} × {item.quantity}</p>
                            {item.promotion_applied && (
                              <Badge variant="secondary" className="text-[10px] px-1 h-4">
                                <Tag className="h-2.5 w-2.5 mr-0.5" />
                                Promo
                              </Badge>
                            )}
                          </div>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{format(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Réduction</span>
                    <span>-{format(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">{format(total)}</span>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Client</Label>
                  <div className="flex gap-2">
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nom" className="flex-1" />
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Tél" className="w-28" />
                  </div>
                </div>

                <div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowDiscount(!showDiscount)}>
                    <Percent className="h-3 w-3" /> Réduction
                  </Button>
                  {showDiscount && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input type="number" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} min={0} max={100} className="w-20" />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Paiement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "cash", label: "Espèces", icon: Banknote },
                      { id: "moncash", label: "MonCash", icon: Wallet },
                      { id: "natcash", label: "NatCash", icon: Wallet },
                      { id: "card", label: "Carte", icon: CreditCard },
                    ].map(method => {
                      const Icon = method.icon;
                      return (
                        <Button key={method.id} variant={paymentMethod === method.id ? "default" : "outline"}
                          className={cn("justify-start gap-2 h-10", paymentMethod === method.id && "bg-primary")}
                          onClick={() => setPaymentMethod(method.id)}>
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
                  Encaisser • {format(total)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Reçu de vente #{lastSale?.sale_number || ""}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={printReceipt} className="gap-1">
                  <Printer className="h-4 w-4" /> Imprimer
                </Button>
                <Button variant="outline" size="sm" onClick={printReceipt} className="gap-1">
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="hidden print:block">
            <ReceiptTemplate sale={lastSale} items={lastSale?.items || []}
              salon={{ name: "Mon Salon", address: "123 Rue Principale", phone: "+509 1234 5678" }}
              currencyCode={currencyCode} format={format} />
          </div>

          <div ref={receiptRef} className="bg-white p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border">
            <ReceiptTemplate sale={lastSale} items={lastSale?.items || []}
              salon={{ name: "Mon Salon", address: "123 Rue Principale", phone: "+509 1234 5678" }}
              currencyCode={currencyCode} format={format} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>Fermer</Button>
            <Button onClick={() => { printReceipt(); setShowReceipt(false); }}>Télécharger le PDF</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
