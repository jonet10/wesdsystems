import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";

interface ProductRow {
  id: string;
  name: string;
  selling_price: number;
  quantity: number;
}

interface ServiceRow {
  id: string;
  name: string;
  price: number;
}

type CartItem = {
  key: string;
  item_type: "product" | "service";
  product_id?: string;
  service_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
};

export default function POSPage() {
  const { currencyCode, format } = useCurrency();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");

  const loadData = async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("products").select("id, name, selling_price, quantity").eq("is_active", true).order("name"),
      supabase.from("services").select("id, name, price").order("name"),
    ]);
    setProducts((p || []) as ProductRow[]);
    setServices(((s || []).map((x: any) => ({ ...x, price: Number(x.price || 0) })) as ServiceRow[]));
  };

  useEffect(() => {
    void loadData();
  }, []);

  const addProduct = (p: ProductRow) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.item_type === "product" && i.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { key: `p-${p.id}`, item_type: "product", product_id: p.id, item_name: p.name, quantity: 1, unit_price: Number(p.selling_price || 0) }];
    });
  };

  const addService = (s: ServiceRow) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.item_type === "service" && i.service_id === s.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { key: `s-${s.id}`, item_type: "service", service_id: s.id, item_name: s.name, quantity: 1, unit_price: Number(s.price || 0) }];
    });
  };

  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0), [cart]);

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert([
        {
          customer_name: customerName || null,
          payment_method: paymentMethod,
          subtotal,
          total_amount: subtotal,
          currency_code: currencyCode,
        },
      ])
      .select("id")
      .single();
    if (saleError || !sale?.id) return toast.error(saleError?.message || "Vente impossible");

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
    if (itemErr) return toast.error(itemErr.message);

    toast.success("Vente enregistrée.");
    setCart([]);
    setCustomerName("");
    void loadData();
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <DashboardLayout role="salon_admin" title="POS / Caisse" subtitle="Vente produits + services sur facture unique" userName="Admin Studio">
      <StaggerContainer className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StaggerItem className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold mb-3">Produits</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {products.map((p) => (
                <Button key={p.id} variant="outline" className="justify-between" onClick={() => addProduct(p)}>
                  <span className="truncate">{p.name}</span>
                  <span className="ml-2 text-xs">{p.quantity}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold mb-3">Services</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {services.map((s) => (
                <Button key={s.id} variant="outline" onClick={() => addService(s)}>
                  {s.name}
                </Button>
              ))}
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <h3 className="font-semibold">Facture</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {cart.length === 0 && <p className="text-sm text-muted-foreground">Aucun article.</p>}
              {cart.map((i) => (
                <div key={i.key} className="flex items-center justify-between text-sm">
                  <span>{i.item_name} x{i.quantity}</span>
                  <span>{format(i.quantity * i.unit_price)}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-border flex justify-between font-semibold">
              <span>Total</span>
              <span>{format(subtotal)}</span>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nom client (optionnel)" />
            </div>
            <div className="space-y-2">
              <Label>Paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="moncash">MonCash</SelectItem>
                  <SelectItem value="natcash">NatCash</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={checkout}>Valider vente</Button>
              <Button variant="outline" onClick={printReceipt}>Imprimer</Button>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
