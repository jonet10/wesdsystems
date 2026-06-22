import { useState, useEffect, useRef } from "react";
import { Search, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { inventoryService } from "@/modules/school/services/inventoryService";
import { posService } from "@/modules/school/services/posService";
import type { SchoolProduct } from "@/modules/school/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { setBusinessId } from "@/modules/school/services/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CartItem extends SchoolProduct {
  cartQuantity: number;
}

export default function POS() {
  const [products, setProducts] = useState<SchoolProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [customerName, setCustomerName] = useState("");
  
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const { user, profile } = useAuth();
  const { format } = useCurrency();
  const { toast } = useToast();

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
      setProducts(data.filter(p => p.active && p.stock_quantity > 0));
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de charger les produits", variant: "destructive" });
    }
  };

  const addToCart = (product: SchoolProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.stock_quantity) {
          toast({ title: "Stock insuffisant", variant: "destructive" });
          return prev;
        }
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cartQuantity: item.cartQuantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.cartQuantity + delta;
          if (newQty <= 0) return item;
          if (newQty > item.stock_quantity) {
             toast({ title: "Stock insuffisant", variant: "destructive" });
             return item;
          }
          return { ...item, cartQuantity: newQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
  const total = subtotal; // add tax/discount if needed

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const saleItems = cart.map(item => ({
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.price
      }));

      const sale = await posService.processSale({
        customer_name: customerName,
        items: saleItems,
        subtotal,
        discount: 0,
        tax: 0,
        total,
        payment_method: paymentMethod,
        created_by: user?.id
      });

      // Prepare receipt data
      const { data: businessInfo } = await supabase.from('school_settings').select('*').eq('business_id', businessId).single();
      const { data: baseBiz } = await supabase.from('businesses').select('currency, name').eq('id', businessId).single();
      
      const currencyCode = baseBiz?.currency === "USD" ? "$" : "G";
      const newReceiptData: ReceiptData = {
        business: {
          name: businessInfo?.name || baseBiz?.name || "Mon École",
          logo_url: businessInfo?.logo_url || "",
          address: businessInfo?.address || "",
          phone: businessInfo?.phone || "",
          email: businessInfo?.email || "",
          receipt_footer_message: "Merci de votre paiement.",
          receipt_policy_message: "Veuillez conserver ce reçu précieusement."
        },
        transaction: {
          invoiceNumber: sale.receipt_number,
          invoiceLabel: "Reçu Vente",
          date: sale.created_at,
          cashierName: user?.user_metadata?.name || "Admin",
          clientName: customerName || "Client Comptoir",
        },
        items: cart.map(item => ({
          name: item.name,
          quantity: item.cartQuantity,
          price: item.price,
          total: item.cartQuantity * item.price
        })),
        totals: {
          subtotal,
          total
        },
        payment: {
          method: paymentMethod.toLowerCase() === "cash" ? "ESPÈCES" :
                  paymentMethod.toLowerCase() === "virement" ? "VIREMENT" : paymentMethod.toUpperCase(),
          amountReceived: total,
          balanceRemaining: 0
        },
        currencyCode
      };

      setReceiptData(newReceiptData);
      setShowReceipt(true);

      // Reset cart & reload
      setCart([]);
      setCustomerName("");
      loadProducts();
      toast({ title: "Succès", description: "Vente enregistrée avec succès !" });

    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible d'enregistrer la vente", variant: "destructive" });
    }
  };

  const handlePrintReceipt = () => {
    if (receiptData) {
      printUnifiedReceipt(receiptData, format);
    }
  };

  return (
    <DashboardLayout role="salon_admin">
    <div className="flex h-[calc(100vh-6rem)] gap-4 max-w-7xl mx-auto">
      {/* Left side - Products */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
          <Input 
            placeholder="Rechercher un produit..." 
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="p-4 cursor-pointer hover:border-primary transition-colors flex flex-col justify-between"
                onClick={() => addToCart(product)}
              >
                <div>
                  <h3 className="font-medium line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{product.category}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold text-primary">{format(product.price)}</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full">Stock: {product.stock_quantity}</span>
                </div>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-10">
                Aucun produit trouvé en stock.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Cart */}
      <Card className="w-96 flex flex-col shadow-lg border-l">
        <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="font-bold text-lg">Caisse Fournitures</h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              Le panier est vide
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/20 rounded-lg border">
                <div className="flex justify-between items-start">
                  <span className="font-medium flex-1">{item.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{format(item.price)}</span>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="font-medium w-4 text-center">{item.cartQuantity}</span>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-muted/30 space-y-4">
          <div className="space-y-2">
            <Input 
              placeholder="Nom du client (Optionnel)" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button 
                variant={paymentMethod === "Cash" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPaymentMethod("Cash")}
              >
                Cash
              </Button>
              <Button 
                variant={paymentMethod === "Virement" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPaymentMethod("Virement")}
              >
                Virement
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total:</span>
              <span className="font-bold text-lg">{format(total)}</span>
            </div>
            
            <Button 
            className="w-full h-12 text-lg font-bold" 
            onClick={handleCheckout}
            disabled={cart.length === 0}
          >
            ENCAISSER {format(total)}
          </Button>
        </div>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reçu de vente</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center max-h-[60vh] overflow-y-auto bg-muted/20 p-4 rounded-lg">
            {receiptData && <ReceiptTemplate data={receiptData} formatAmount={format} />}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>
              Fermer
            </Button>
            <Button onClick={handlePrintReceipt}>
              Imprimer le reçu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
