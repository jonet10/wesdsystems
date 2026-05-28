import { useEffect, useMemo, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { 
  ShoppingCart, Plus, Minus, Trash2, Printer, Download, Search, 
  Package, Scissors, CreditCard, Banknote, Wallet, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ReceiptTemplate } from "@/components/ui/ReceiptTemplate";

// Types
interface ProductRow {
  id: string;
  name: string;
  selling_price: number;
  quantity: number;
  image_url?: string;
  category?: string;
}

interface ServiceRow {
  id: string;
  name: string;
  price: number;
  duration?: number;
  category?: string;
}

type CartItem = {
  key: string;
  item_type: "product" | "service";
  product_id?: string;
  service_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  category?: string;
};

export default function POSPage() {
  const { currencyCode, format } = useCurrency();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "services">("products");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("products").select("id, name, selling_price, quantity, image_url, category").eq("is_active", true).order("name"),
        supabase.from("services").select("id, name, price, duration, category").order("name"),
      ]);
      setProducts((p || []) as ProductRow[]);
      setServices(((s || []).map((x: any) => ({ ...x, price: Number(x.price || 0) })) as ServiceRow[]));
    } catch (err) {
      console.error("Erreur chargement POS:", err);
      toast.error("Impossible de charger le catalogue");
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredProducts = useMemo(() => 
    products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [products, searchTerm]
  );

  const filteredServices = useMemo(() => 
    services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [services, searchTerm]
  );

  const addToCart = (item: ProductRow | ServiceRow, type: "product" | "service") => {
    setCart((prev) => {
      const key = `${type}-${type === "product" ? (item as ProductRow).id : (item as ServiceRow).id}`;
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        key,
        item_type: type,
        ...(type === "product" ? { product_id: (item as ProductRow).id } : { service_id: (item as ServiceRow).id }),
        item_name: item.name,
        quantity: 1,
        unit_price: type === "product" ? Number((item as ProductRow).selling_price || 0) : Number((item as ServiceRow).price || 0),
        category: item.category,
      }];
    });
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.key !== key) return item;
      const newQty = Math.max(0, item.quantity + delta);
      return newQty === 0 ? null : { ...item, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (key: string) => {
    setCart(prev => prev.filter(i => i.key !== key));
  };

  const subtotal = useMemo(() => 
    cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0), 
    [cart]
  );

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");
    
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert([{
          customer_name: customerName || null,
          payment_method: paymentMethod,
          subtotal,
          total_amount: subtotal,
          currency_code: currencyCode,
          employee_id: supabase.auth.user()?.id,
        }])
        .select("id, sale_number, created_at")
        .single();
      
      if (saleError || !sale?.id) throw new Error(saleError?.message || "Vente impossible");

      const items = cart.map((i) => ({
        sale_id: sale.id,
        item_type: i.item_type,
        product_id: i.product_id || null,
        service_id: i.service_id || null,
        item_name: i.item_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));

      const { error: itemErr } = await supabase.from("sale_items").insert(items);
      if (itemErr) throw new Error(itemErr.message);

      // Update inventory for products
      for (const item of cart) {
        if (item.item_type === "product" && item.product_id) {
          await supabase.rpc("decrement_inventory", {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
            p_sale_id: sale.id,
          }).catch(() => {}); // Ignore si RPC non créé
        }
      }

      setLastSale({ ...sale, items: cart, customer: customerName, payment: paymentMethod });
      setShowReceipt(true);
      toast.success("Vente enregistrée avec succès !");
      
      // Reset
      setCart([]);
      setCustomerName("");
      await loadData();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const printReceipt = async () => {
    if (!receiptRef.current) return;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        width: 300,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 297],
      });

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
      toast.error("Erreur PDF, utilisation de l'impression navigateur...");
      window.print();
    }
  };

  const PaymentIcon = {
    cash: Banknote,
    moncash: Wallet,
    natcash: Wallet,
    card: CreditCard,
  }[paymentMethod as keyof typeof PaymentIcon] || Banknote;

  const currentItems = activeTab === "products" ? filteredProducts : filteredServices;

  return (
    <DashboardLayout role="salon_admin" title="POS / Caisse" subtitle="Encaissement rapide avec impression de reçu">
      <StaggerContainer className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
        
        {/* Left: Products/Services Catalog */}
        <StaggerItem className="flex-1 flex flex-col min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={activeTab === "products" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("products")}
                    className="gap-1"
                  >
                    <Package className="h-4 w-4" /> Produits
                  </Button>
                  <Button
                    variant={activeTab === "services" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("services")}
                    className="gap-1"
                  >
                    <Scissors className="h-4 w-4" /> Prestations
                  </Button>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Rechercher...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {currentItems.map((item: any) => (
                    <Card 
                      key={item.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => addToCart(item, activeTab === "products" ? "product" : "service")}
                    >
                      <CardContent className="p-3">
                        {item.image_url && activeTab === "products" && (
                          <img src={item.image_url} alt={item.name} className="w-full h-20 object-cover rounded mb-2" />
                        )}
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activeTab === "products" 
                            ? `Stock: ${item.quantity ?? 0}` 
                            : `Durée: ${item.duration ?? 30}min`
                          }
                        </p>
                        <p className="text-primary font-semibold mt-1">
                          {format(activeTab === "products" ? item.selling_price : item.price)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {currentItems.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-8 text-sm">
                      Aucun {activeTab === "products" ? "produit" : "service"} trouvé
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Right: Cart & Checkout */}
        <StaggerItem className="w-full lg:w-96 flex flex-col">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" /> Panier ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              
              {/* Cart Items */}
              <ScrollArea className="flex-1 pr-2 -mr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Ajoutez des articles pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateQuantity(item.key, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateQuantity(item.key, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.key)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Totals */}
              <Separator className="my-3" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{format(subtotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">{format(subtotal)}</span>
                </div>
              </div>

              {/* Customer & Payment */}
              <div className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="customer" className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Client (optionnel)
                  </Label>
                  <Input
                    id="customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nom du client"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Mode de paiement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "cash", label: "Espèces", icon: Banknote },
                      { id: "moncash", label: "MonCash", icon: Wallet },
                      { id: "natcash", label: "NatCash", icon: Wallet },
                      { id: "card", label: "Carte", icon: CreditCard },
                    ].map((method) => {
                      const Icon = method.icon;
                      return (
                        <Button
                          key={method.id}
                          variant={paymentMethod === method.id ? "default" : "outline"}
                          className={cn("justify-start gap-2 h-10", paymentMethod === method.id && "bg-primary")}
                          onClick={() => setPaymentMethod(method.id)}
                        >
                          <Icon className="h-4 w-4" />
                          {method.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0}>
                  Annuler
                </Button>
                <Button onClick={checkout} disabled={cart.length === 0} className="bg-primary">
                  Encaisser • {format(subtotal)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Receipt Modal for PDF Generation */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Reçu de vente</span>
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
          
          {/* Hidden receipt template for PDF generation */}
          <div className="hidden print:block">
            <ReceiptTemplate 
              sale={lastSale} 
              items={lastSale?.items || []}
              salon={{ name: "Mon Salon", address: "123 Rue Principale", phone: "+509 1234 5678" }}
              currencyCode={currencyCode}
              format={format}
            />
          </div>
          
          {/* Preview for screen */}
          <div ref={receiptRef} className="bg-white p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border">
            <ReceiptTemplate 
              sale={lastSale} 
              items={lastSale?.items || []}
              salon={{ name: "Mon Salon", address: "123 Rue Principale", phone: "+509 1234 5678" }}
              currencyCode={currencyCode}
              format={format}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>Fermer</Button>
            <Button onClick={() => { printReceipt(); setShowReceipt(false); }}>
              Télécharger le PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}