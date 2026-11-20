import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Search,
  Package, Beer, CreditCard, Banknote, Utensils, Hotel, Sparkles, RefreshCw, Smartphone,
  Clock, Bed
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveBranchId } from "@/lib/branch";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
import { barRestoService } from "@/modules/restaurant/services/barRestoService";
import type { BarProduct, BarCocktail, HotelRoom, CartItem, PaymentMethod } from "@/modules/restaurant/types";

export default function BarPOS() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { currencyCode, format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  const [products, setProducts] = useState<BarProduct[]>([]);
  const [cocktails, setCocktails] = useState<BarCocktail[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // Tabs: all, drinks, food, cocktails, rooms
  const [activeTab, setActiveTab] = useState<"all" | "drinks" | "food" | "cocktails" | "rooms">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Payment modal state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ESPECES");
  const [amountReceivedInput, setAmountReceivedInput] = useState("");

  // Receipt modal
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Modal for drink options (Unit or Case)
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BarProduct | null>(null);

  // Modal for room options (Moment or Night)
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        barRestoService.getProducts(effectiveBranchId),
        barRestoService.getCocktails(effectiveBranchId),
      ]);
      const r = barRestoService.getHotelRooms(effectiveBranchId);
      setProducts(p);
      setCocktails(c);
      setRooms(r);
    } catch (err) {
      console.error("Error loading Bar POS data:", err);
      toast.error("Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [effectiveBranchId]);

  const handleSeedCatalog = async () => {
    setIsSeeding(true);
    try {
      await barRestoService.seedHaitiCatalog(effectiveBranchId);
      await barRestoService.seedHaitiCocktails(effectiveBranchId);
      toast.success("Catalogue Haïti (Prestige, Barbancourt, Fritay...) chargé avec succès !");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'initialisation du catalogue");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleItemClick = (item: any, type: "product" | "cocktail" | "food" | "room") => {
    if (type === "product") {
      const prod = item as BarProduct;
      // If item is beer/soda with multiple units per case, ask unitaire vs caisse
      if (prod.units_per_case && prod.units_per_case > 1) {
        setSelectedProduct(prod);
        setOptionsModalOpen(true);
        return;
      }
      addToCart(prod.id, prod.name, prod.price_per_unit, "UNITE", "product");
    } else if (type === "food") {
      const prod = item as BarProduct;
      addToCart(prod.id, prod.name, prod.price_per_unit, "PLAT", "food");
    } else if (type === "cocktail") {
      const c = item as BarCocktail;
      addToCart(c.id, c.name, c.price, "COCKTAIL", "cocktail");
    } else if (type === "room") {
      const r = item as HotelRoom;
      setSelectedRoom(r);
      setRoomModalOpen(true);
    }
  };

  const addToCart = (
    itemId: string,
    name: string,
    price: number,
    saleType: CartItem["sale_type"],
    itemType: CartItem["type"]
  ) => {
    const key = `${itemId}-${saleType}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          key,
          type: itemType,
          item_id: itemId,
          name: name + (saleType === "CAISSE" ? " (Caisse)" : saleType === "UNITE" ? " (Bouteille)" : ""),
          quantity: 1,
          unit_price: price,
          sale_type: saleType,
        },
      ];
    });
    setOptionsModalOpen(false);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.key === key) {
            const newQ = i.quantity + delta;
            return newQ > 0 ? { ...i, quantity: newQ } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    return { subtotal, total: subtotal };
  }, [cart]);

  // Smart Haitian cash tender amounts: 500, 1000, 1500, 2000, etc. always >= total
  const quickCashAmounts = useMemo(() => {
    const total = Math.ceil(totals.total);
    if (total <= 0) return [500, 1000, 1500, 2000];

    const suggestions: number[] = [total];

    if (total < 500) {
      if (total < 100) suggestions.push(100);
      if (total < 250) suggestions.push(250);
      suggestions.push(500);
    }

    const step = total >= 10000 ? 5000 : total >= 2500 ? 1000 : 500;
    let candidate = Math.ceil(total / step) * step;
    if (candidate <= total) candidate += step;

    while (suggestions.length < 6) {
      if (!suggestions.includes(candidate) && candidate >= total) {
        suggestions.push(candidate);
      }
      candidate += step;
    }

    const exact = suggestions[0];
    const roundedAbove = Array.from(new Set(suggestions.slice(1)))
      .filter((v) => v >= total)
      .sort((a, b) => a - b);

    const result = [exact, ...roundedAbove].filter((v, i, self) => self.indexOf(v) === i);
    return result.slice(0, 5);
  }, [totals.total]);

  const receivedAmount = Number(amountReceivedInput) || 0;
  const changeToReturn = paymentMethod === "ESPECES" ? Math.max(0, receivedAmount - totals.total) : 0;
  const isPaymentValid = paymentMethod !== "ESPECES" || receivedAmount >= totals.total;

  const handleOpenPayment = () => {
    if (cart.length === 0) return toast.error("Panier vide");
    setAmountReceivedInput(totals.total.toFixed(2));
    setPaymentDialogOpen(true);
  };

  const completeCheckout = async () => {
    if (!isPaymentValid) {
      return toast.error("Le montant reçu est inférieur au total");
    }

    try {
      const sale = await barRestoService.processSale(
        effectiveBranchId,
        cart,
        paymentMethod,
        totals.subtotal,
        totals.total
      );

      toast.success("Vente enregistrée avec succès !");
      setLastSale({
        ...sale,
        items: cart,
        payment: paymentMethod,
        sale_number: sale.id.split("-")[0].toUpperCase(),
        amountReceived: paymentMethod === "ESPECES" ? receivedAmount : totals.total,
        change: changeToReturn,
      });

      setPaymentDialogOpen(false);
      setShowReceipt(true);
      setCart([]);
      await loadData();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement de la vente");
    }
  };

  // Filter items
  const drinksList = useMemo(() => products.filter((p) => p.item_type !== "food"), [products]);
  const foodList = useMemo(() => products.filter((p) => p.item_type === "food"), [products]);

  const displayItems = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let list: Array<{ item: any; type: "product" | "food" | "cocktail" | "room" }> = [];

    if (activeTab === "all" || activeTab === "drinks") {
      drinksList.forEach((d) => list.push({ item: d, type: "product" }));
    }
    if (activeTab === "all" || activeTab === "food") {
      foodList.forEach((f) => list.push({ item: f, type: "food" }));
    }
    if (activeTab === "all" || activeTab === "cocktails") {
      cocktails.forEach((c) => list.push({ item: c, type: "cocktail" }));
    }
    if (activeTab === "all" || activeTab === "rooms") {
      rooms.filter((r) => r.status === "AVAILABLE").forEach((r) => list.push({ item: r, type: "room" }));
    }

    if (!q) return list;

    return list.filter((entry) => {
      const name = entry.type === "room" ? `Chambre ${entry.item.room_number} ${entry.item.room_type}` : entry.item.name;
      return name.toLowerCase().includes(q);
    });
  }, [activeTab, drinksList, foodList, cocktails, rooms, searchTerm]);

  return (
    <DashboardLayout
      role="salon_admin"
      title="Caisse POS"
      subtitle="Point de vente pour Bar, Resto & Hôtel (Boissons, Fritay, Cocktails, Chambres)"
    >
      <StaggerContainer className="h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row gap-4">
        {/* Left Side: Catalog */}
        <StaggerItem className="flex-1 flex flex-col min-w-0">
          <Card className="h-full flex flex-col border-border/60 shadow-sm bg-card">
            <CardHeader className="p-3.5 pb-2 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant={activeTab === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("all")}
                    className="h-8 text-xs font-bold"
                  >
                    Tout
                  </Button>
                  <Button
                    variant={activeTab === "drinks" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("drinks")}
                    className="h-8 text-xs font-bold gap-1"
                  >
                    <Package className="h-3.5 w-3.5" /> Boissons ({drinksList.length})
                  </Button>
                  <Button
                    variant={activeTab === "food" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("food")}
                    className="h-8 text-xs font-bold gap-1"
                  >
                    <Utensils className="h-3.5 w-3.5" /> Fritay & Plats ({foodList.length})
                  </Button>
                  <Button
                    variant={activeTab === "cocktails" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("cocktails")}
                    className="h-8 text-xs font-bold gap-1"
                  >
                    <Beer className="h-3.5 w-3.5" /> Cocktails ({cocktails.length})
                  </Button>
                  <Button
                    variant={activeTab === "rooms" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("rooms")}
                    className="h-8 text-xs font-bold gap-1"
                  >
                    <Hotel className="h-3.5 w-3.5" /> Chambres ({rooms.filter((r) => r.status === "AVAILABLE").length})
                  </Button>
                </div>

                {/* Search & Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Prestige, Griot, Ti-Punch..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  {products.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 font-bold border-primary text-primary"
                      onClick={handleSeedCatalog}
                      disabled={isSeeding}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Charger Haïti
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-3 pt-1">
              {loading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Chargement du catalogue...
                </div>
              ) : displayItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Package className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Aucun produit trouvé</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                      Chargez instantanément la liste standard des produits de Bar, Resto & Hôtel en Haïti.
                    </p>
                  </div>
                  <Button onClick={handleSeedCatalog} disabled={isSeeding} className="gap-2 font-bold">
                    <Sparkles className="h-4 w-4" /> Initialiser les produits Haïti (Prestige, Barbancourt...)
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-full pr-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {displayItems.map(({ item, type }) => {
                      if (type === "product" || type === "food") {
                        const prod = item as BarProduct;
                        const isFood = type === "food";
                        const inStock = prod.stock_units > 0 || prod.stock_cases > 0;
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleItemClick(prod, type)}
                            className="flex flex-col text-left p-3 rounded-xl border border-border/70 hover:border-primary/60 hover:shadow-sm transition-all bg-card/60 hover:bg-card group"
                          >
                            <div className="flex justify-between items-start w-full">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold uppercase ${
                                  isFood
                                    ? "bg-amber-500/10 text-amber-600 border-amber-300"
                                    : "bg-blue-500/10 text-blue-600 border-blue-300"
                                }`}
                              >
                                {isFood ? "Resto" : prod.brand || "Bar"}
                              </Badge>
                              {!isFood && (
                                <span className={`text-[10px] font-medium ${inStock ? "text-muted-foreground" : "text-destructive"}`}>
                                  {prod.stock_cases > 0 ? `${prod.stock_cases} c.` : `${prod.stock_units} u.`}
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-sm text-foreground mt-2 line-clamp-2 group-hover:text-primary transition-colors">
                              {prod.name}
                            </p>

                            <div className="mt-auto pt-2 flex items-baseline justify-between w-full">
                              <span className="text-base font-black text-primary">
                                {format(prod.price_per_unit)}
                              </span>
                              {prod.units_per_case > 1 && prod.price_per_case > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  Caisse: {format(prod.price_per_case)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      }

                      if (type === "cocktail") {
                        const cocktail = item as BarCocktail;
                        return (
                          <button
                            key={cocktail.id}
                            type="button"
                            onClick={() => handleItemClick(cocktail, "cocktail")}
                            className="flex flex-col text-left p-3 rounded-xl border border-purple-200 dark:border-purple-900 hover:border-purple-500 hover:shadow-sm transition-all bg-purple-50/20 dark:bg-purple-950/20 group"
                          >
                            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-300 w-fit">
                              Cocktail
                            </Badge>
                            <p className="font-bold text-sm text-foreground mt-2 line-clamp-1 group-hover:text-purple-600">
                              {cocktail.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                              {cocktail.description}
                            </p>
                            <div className="mt-auto pt-2">
                              <span className="text-base font-black text-purple-600 dark:text-purple-400">
                                {format(cocktail.price)}
                              </span>
                            </div>
                          </button>
                        );
                      }

                      if (type === "room") {
                        const room = item as HotelRoom;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => handleItemClick(room, "room")}
                            className="flex flex-col text-left p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 hover:border-emerald-500 hover:shadow-sm transition-all bg-emerald-50/20 dark:bg-emerald-950/20 group"
                          >
                            <div className="flex justify-between items-start w-full">
                              <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
                                Chambre
                              </Badge>
                              <span className="text-xs font-black text-primary">N° {room.room_number}</span>
                            </div>
                            <p className="font-bold text-sm text-foreground mt-2 line-clamp-1">
                              {room.room_type}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {room.floor}
                            </p>
                            <div className="mt-auto pt-2 space-y-1 w-full border-t border-emerald-200/50 dark:border-emerald-900/50">
                              <div className="flex justify-between items-baseline text-xs">
                                <span className="text-[10px] text-muted-foreground font-bold">Moment 2h :</span>
                                <span className="font-black text-amber-700 dark:text-amber-400">
                                  {format(room.price_per_moment || 1500)}
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline text-xs">
                                <span className="text-[10px] text-muted-foreground font-bold">Nuitée :</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">
                                  {format(room.price_per_night)}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      }

                      return null;
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Right Side: Cart Panel */}
        <StaggerItem className="w-full lg:w-96 flex flex-col shrink-0">
          <Card className="h-full flex flex-col border-border/60 shadow-sm bg-card">
            <CardHeader className="p-3.5 pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Panier ({cart.reduce((sum, i) => sum + i.quantity, 0)})
                </CardTitle>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCart([])}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Vider
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-3 flex flex-col justify-between">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                  <ShoppingCart className="h-10 w-10 stroke-[1.5] mb-2 opacity-40" />
                  <p className="text-xs font-medium">Panier vide</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Touchez un produit, plat, cocktail ou chambre pour l'ajouter.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-muted/30 text-xs"
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="font-bold text-foreground truncate">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground font-semibold">
                            {format(item.unit_price)} × {item.quantity} = {format(item.unit_price * item.quantity)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, -1)}
                            className="h-6 w-6 rounded bg-background border flex items-center justify-center hover:bg-accent"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center font-bold text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, 1)}
                            className="h-6 w-6 rounded bg-background border flex items-center justify-center hover:bg-accent"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.key)}
                            className="h-6 w-6 rounded text-destructive hover:bg-destructive/10 flex items-center justify-center ml-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Total & Checkout button */}
              <div className="border-t pt-3 space-y-3 mt-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Total à Payer</span>
                  <span className="text-2xl font-black text-primary">{format(totals.total)}</span>
                </div>

                <Button
                  size="lg"
                  className="w-full font-black text-sm bg-primary hover:bg-primary/90 h-11 gap-2 shadow-sm"
                  disabled={cart.length === 0}
                  onClick={handleOpenPayment}
                >
                  <CreditCard className="h-4 w-4" /> Encaisser & Facturer
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Options Modal: Unit or Case */}
      <Dialog open={optionsModalOpen} onOpenChange={setOptionsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{selectedProduct?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Choisissez le format de vente pour cette boisson :
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-1.5 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => {
                if (!selectedProduct) return;
                addToCart(selectedProduct.id, selectedProduct.name, selectedProduct.price_per_unit, "UNITE", "product");
              }}
            >
              <Beer className="h-6 w-6 text-primary" />
              <div className="text-center">
                <span className="font-bold text-xs block">À l'Unité / Bouteille</span>
                <span className="text-sm font-black text-primary">{format(selectedProduct?.price_per_unit || 0)}</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-1.5 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => {
                if (!selectedProduct) return;
                addToCart(
                  selectedProduct.id,
                  selectedProduct.name,
                  selectedProduct.price_per_case || selectedProduct.price_per_unit * (selectedProduct.units_per_case || 24),
                  "CAISSE",
                  "product"
                );
              }}
            >
              <Package className="h-6 w-6 text-primary" />
              <div className="text-center">
                <span className="font-bold text-xs block">À la Caisse ({selectedProduct?.units_per_case || 24} pcs)</span>
                <span className="text-sm font-black text-primary">
                  {format(selectedProduct?.price_per_case || 0)}
                </span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Options Modal: Moment (2h) or Night */}
      <Dialog open={roomModalOpen} onOpenChange={setRoomModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Hotel className="h-5 w-5 text-emerald-600" />
              Chambre {selectedRoom?.room_number} ({selectedRoom?.room_type})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Choisissez la formule de location pour la chambre :
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3">
            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-1.5 border-2 hover:border-amber-500 hover:bg-amber-500/5 text-center p-2"
              onClick={() => {
                if (!selectedRoom) return;
                addToCart(
                  selectedRoom.id,
                  `Chambre ${selectedRoom.room_number} — Moment (2h)`,
                  selectedRoom.price_per_moment || 1500,
                  "CHAMBRE",
                  "room"
                );
                setRoomModalOpen(false);
              }}
            >
              <Clock className="h-6 w-6 text-amber-600" />
              <div>
                <span className="font-bold text-xs block">Moment (2h)</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                  {format(selectedRoom?.price_per_moment || 1500)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Passage 2 heures</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-1.5 border-2 hover:border-primary hover:bg-primary/5 text-center p-2"
              onClick={() => {
                if (!selectedRoom) return;
                addToCart(
                  selectedRoom.id,
                  `Chambre ${selectedRoom.room_number} — Nuitée`,
                  selectedRoom.price_per_night || 3500,
                  "CHAMBRE",
                  "room"
                );
                setRoomModalOpen(false);
              }}
            >
              <Bed className="h-6 w-6 text-primary" />
              <div>
                <span className="font-bold text-xs block">Nuitée Complète</span>
                <span className="text-sm font-black text-primary">
                  {format(selectedRoom?.price_per_night || 3500)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Jusqu'au matin</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Payment Dialog with Haitian Gourde Tender */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Encaissement Caisse
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total à payer</p>
              <p className="text-3xl font-black text-primary">{format(totals.total)}</p>
            </div>

            {/* Mode de paiement */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Moyen de paiement</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "ESPECES", label: "Espèces", icon: Banknote },
                  { id: "MONCASH", label: "MonCash", icon: Smartphone },
                  { id: "CARTE", label: "Carte", icon: CreditCard },
                  { id: "TRANSFERT", label: "Virement", icon: RefreshCw },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <Button
                      key={m.id}
                      type="button"
                      size="sm"
                      variant={paymentMethod === m.id ? "default" : "outline"}
                      className="h-12 flex flex-col gap-1 text-[11px] font-bold"
                      onClick={() => setPaymentMethod(m.id as any)}
                    >
                      <Icon className="h-4 w-4" />
                      {m.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Montant reçu du client (Espèces) */}
            {paymentMethod === "ESPECES" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cash-received" className="text-xs font-bold">
                    Montant reçu du client
                  </Label>
                  <Input
                    id="cash-received"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="h-12 text-right text-2xl font-black"
                    value={amountReceivedInput}
                    onChange={(e) => setAmountReceivedInput(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    autoFocus
                  />
                </div>

                {/* Intelligent Cash Tender Buttons */}
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => {
                    const isSelected = Math.abs(Number(amountReceivedInput) - amount) < 0.01;
                    return (
                      <Button
                        key={amount}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={`flex-1 min-w-[75px] h-9 text-xs font-bold transition-all ${
                          isSelected ? "shadow-sm scale-[1.02]" : "hover:border-primary/50"
                        }`}
                        onClick={() => setAmountReceivedInput(amount.toFixed(2))}
                      >
                        {format(amount)}
                      </Button>
                    );
                  })}
                </div>

                {/* Monnaie à rendre */}
                <div
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                    isPaymentValid ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"
                  }`}
                >
                  <span className="text-xs font-bold">
                    {isPaymentValid ? "Monnaie à rendre :" : "Montant insuffisant"}
                  </span>
                  <span
                    className={`text-xl font-black ${
                      isPaymentValid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                    }`}
                  >
                    {isPaymentValid ? format(changeToReturn) : `Manque ${format(totals.total - receivedAmount)}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={completeCheckout}
              disabled={!isPaymentValid}
              className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Valider & Facturer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Reçu #{lastSale?.sale_number || ""}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!lastSale || !receiptRef.current) return;
                  const data: ReceiptData = {
                    business: {
                      name: "BAR, RESTO & HÔTEL",
                    },
                    transaction: {
                      invoiceNumber: lastSale.sale_number || lastSale.id,
                      date: lastSale.created_at || new Date().toISOString(),
                      cashierName: user?.user_metadata?.name || profile?.full_name || "Caisse",
                      cashRegister: "CAISSE PRINCIPALE",
                    },
                    items:
                      lastSale.items?.map((i: any) => ({
                        name: i.name,
                        quantity: i.quantity,
                        price: i.unit_price,
                        total: i.quantity * i.unit_price,
                      })) || [],
                    totals: {
                      subtotal: lastSale.total || 0,
                      total: lastSale.total || 0,
                    },
                    payment: {
                      method: lastSale.payment || "ESPÈCES",
                      amountReceived: lastSale.amountReceived || lastSale.total || 0,
                      change: lastSale.change || 0,
                    },
                    currencyCode: currencyCode,
                  };
                  printUnifiedReceipt(data, format);
                }}
                className="gap-1 font-bold"
              >
                <Printer className="h-4 w-4" /> Imprimer Ticket
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="bg-gray-100 p-2 rounded flex justify-center max-h-[60vh] overflow-y-auto">
            <ReceiptTemplate
              ref={receiptRef}
              formatAmount={format}
              data={{
                business: {
                  name: "BAR, RESTO & HÔTEL",
                },
                transaction: {
                  invoiceNumber: lastSale?.sale_number || lastSale?.id,
                  date: lastSale?.created_at || new Date().toISOString(),
                  cashierName: user?.user_metadata?.name || profile?.full_name || "Caisse",
                  cashRegister: "CAISSE PRINCIPALE",
                },
                items:
                  lastSale?.items?.map((i: any) => ({
                    name: i.name,
                    quantity: i.quantity,
                    price: i.unit_price,
                    total: i.quantity * i.unit_price,
                  })) || [],
                totals: {
                  subtotal: lastSale?.total || 0,
                  total: lastSale?.total || 0,
                },
                payment: {
                  method: lastSale?.payment || "ESPÈCES",
                  amountReceived: lastSale?.amountReceived || lastSale?.total || 0,
                  change: lastSale?.change || 0,
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
