import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Plus, Trash2, Eye } from "lucide-react";
import type { PharmacyPurchase, PharmacySupplier, PharmacyProduct } from "@/modules/pharmacy/types";
import { inventoryService } from "@/modules/pharmacy/services/inventoryService";
import { productService, setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";

export default function PharmacyPurchases() {
  const { t } = useTranslation();
  const [data, setData] = useState<PharmacyPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<PharmacySupplier[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  // New Purchase Form
  const [form, setForm] = useState({ supplier_id: "", purchase_number: "" });
  const [items, setItems] = useState<any[]>([]);

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchases, supps, prods] = await Promise.all([
        inventoryService.getPurchases(),
        inventoryService.getSuppliers(),
        productService.getProducts()
      ]);
      setData(purchases);
      setSuppliers(supps);
      setProducts(prods);
    } catch (e: any) {
      if (e.message !== "Business ID not set for Pharmacy Module") {
        toast.error(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ supplier_id: "", purchase_number: `ACH-${Date.now().toString().slice(-6)}` });
    setItems([]);
    setOpen(true);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", quantity: 1, cost_price: 0, sale_price: 0, batch_number: "", expiration_date: "" }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.supplier_id || items.length === 0) {
      toast.error("Veuillez remplir les informations requises.");
      return;
    }
    try {
      const total_amount = items.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.cost_price)), 0);
      const purchasePayload = {
        ...form,
        total_amount,
        status: "received" as const,
        payment_status: "paid" as const
      };

      await inventoryService.createPurchase(purchasePayload, items);
      toast.success("Achat enregistré avec succès !");
      setOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Achats & Approvisionnements" subtitle="Gestion des entrées en stock">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Historique des Achats" 
            description={`${data.length} bon(s) de commande`} 
            action={{ label: "Saisir un Achat", onClick: openCreate }} 
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "date", label: "Date", render: (r) => new Date(r.purchase_date).toLocaleDateString() },
              { key: "purchase_number", label: "N° Facture" },
              { key: "supplier", label: "Fournisseur", render: (r) => r.supplier?.name || "-" },
              { key: "amount", label: "Montant Total", render: (r) => `${r.total_amount} HTG` },
              { key: "status", label: "Statut", render: (r) => (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Reçu</span>
              ) },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Saisir un Nouvel Achat</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fournisseur</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({...form, supplier_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>N° Facture / Référence</Label>
                <Input value={form.purchase_number} onChange={(e) => setForm({...form, purchase_number: e.target.value})} />
              </div>
            </div>

            <div className="border rounded-md p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Articles & Lots</h3>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-2"/> Ajouter Ligne</Button>
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-4">
                  <div className="col-span-3">
                    <Label className="text-xs">{t("common.product")}</Label>
                    <Select value={item.product_id} onValueChange={(v) => updateItem(index, "product_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Produit..." /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">N° de Lot</Label>
                    <Input placeholder="Lot..." value={item.batch_number} onChange={(e) => updateItem(index, "batch_number", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Péremption</Label>
                    <Input type="date" value={item.expiration_date} onChange={(e) => updateItem(index, "expiration_date", e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Qté</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", Number(e.target.value))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Prix Achat Unité</Label>
                    <Input type="number" value={item.cost_price} onChange={(e) => updateItem(index, "cost_price", Number(e.target.value))} />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Prix Vente</Label>
                    <Input type="number" value={item.sale_price} onChange={(e) => updateItem(index, "sale_price", Number(e.target.value))} />
                  </div>
                  <div className="col-span-1 text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Aucun article ajouté.</p>}
            </div>
            
            <div className="text-right text-lg font-bold">
              Total: {items.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.cost_price)), 0)} HTG
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={items.length === 0}>Valider l'Achat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
