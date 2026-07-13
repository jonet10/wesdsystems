import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, CalendarClock, Ban, Plus } from "lucide-react";
import type { PharmacyBatch, PharmacyProduct } from "@/modules/pharmacy/types";
import { inventoryService } from "@/modules/pharmacy/services/inventoryService";
import { productService } from "@/modules/pharmacy/services/productService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function PharmacyBatches() {
  const { format } = useCurrency();
  const [data, setData] = useState<PharmacyBatch[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  const [form, setForm] = useState({
    product_id: "",
    batch_number: "",
    manufacture_date: "",
    expiration_date: "",
    initial_quantity: 0,
    cost_price: 0,
    sale_price: 0
  });

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      load(businessId);
    }
  }, [businessId]);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [batchesRes, prodsRes] = await Promise.all([
        inventoryService.getBatches(bizId),
        productService.getProducts(bizId)
      ]);
      setData(batchesRes);
      setProducts(prodsRes);
    } catch (e: any) {
      toast.error("Erreur de chargement : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (dateString: string) => new Date(dateString) < new Date();
  const isExpiringSoon = (dateString: string) => {
    const d = new Date(dateString);
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);
    return d > new Date() && d <= in60Days;
  };

  const openCreate = () => {
    setForm({
      product_id: "",
      batch_number: "",
      manufacture_date: "",
      expiration_date: "",
      initial_quantity: 0,
      cost_price: 0,
      sale_price: 0
    });
    setOpen(true);
  };

  // Pre-fill prices when product is selected in dropdown
  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      cost_price: prod?.cost_price || 0,
      sale_price: prod?.sale_price || 0
    });
  };

  const handleSave = async () => {
    if (!form.product_id || !form.batch_number || !form.expiration_date || form.initial_quantity <= 0) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    
    try {
      const payload = {
        ...form,
        manufacture_date: form.manufacture_date || null
      };
      await inventoryService.createBatch(payload, businessId || undefined);
      toast.success("Lot ajouté avec succès");
      setOpen(false);
      if (businessId) load(businessId);
    } catch (e: any) {
      toast.error("Erreur lors de l'ajout : " + e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Lots & Péremptions (FEFO)" subtitle="Gestion des lots de médicaments et dates d'expiration">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Inventaire des Lots" 
            description={`${data.length} lot(s) enregistré(s)`} 
            action={{ label: "Nouveau Lot", onClick: openCreate }}
          />
          
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "product", label: "Produit", render: (r) => <span className="font-medium">{r.product?.name || "Inconnu"}</span> },
              { key: "batch_number", label: "N° Lot", render: (r) => <span className="text-muted-foreground font-mono">{r.batch_number}</span> },
              { key: "quantity", label: "Stock Restant", render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-bold">{r.current_quantity}</span>
                  <span className="text-xs text-muted-foreground">/ {r.initial_quantity}</span>
                </div>
              )},
              { key: "cost_price", label: "Prix d'Achat", render: (r) => format(r.cost_price || 0) },
              { key: "sale_price", label: "Prix de Vente", render: (r) => format(r.sale_price || 0) },
              { key: "expiration_date", label: "Péremption", render: (r) => {
                const expired = isExpired(r.expiration_date);
                const soon = isExpiringSoon(r.expiration_date);
                return (
                  <div className={`flex items-center gap-2 font-medium ${expired ? 'text-red-500' : soon ? 'text-orange-500' : 'text-green-600'}`}>
                    {expired && <Ban className="w-4 h-4"/>}
                    {soon && <CalendarClock className="w-4 h-4"/>}
                    {new Date(r.expiration_date).toLocaleDateString()}
                  </div>
                );
              }},
              { key: "status", label: "Statut", render: (r) => {
                if (r.current_quantity <= 0) return <span className="px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs">Épuisé</span>;
                if (isExpired(r.expiration_date)) return <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-full text-xs flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3"/> Périmé</span>;
                if (isExpiringSoon(r.expiration_date)) return <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded-full text-xs">Expire bientôt</span>;
                return <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-semibold">Valide</span>;
              }},
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un Nouveau Lot (Batch)</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Médicament / Produit *</Label>
              <Select value={form.product_id} onValueChange={handleProductChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le produit..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.generic_name ? `(${p.generic_name})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Numéro de Lot *</Label>
              <Input placeholder="Ex: LOT-26-001" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Quantité Initiale *</Label>
              <Input type="number" min="1" value={form.initial_quantity} onChange={(e) => setForm({ ...form, initial_quantity: Number(e.target.value) })} />
            </div>

            <div className="space-y-2">
              <Label>Date de Fabrication</Label>
              <Input type="date" value={form.manufacture_date} onChange={(e) => setForm({ ...form, manufacture_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date de Péremption *</Label>
              <Input type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Prix d'Achat (unitaire) *</Label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Prix de Vente (unitaire) *</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.product_id || !form.batch_number || !form.expiration_date || form.initial_quantity <= 0}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
