import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { AlertCircle, CalendarClock, Ban } from "lucide-react";
import type { PharmacyBatch } from "@/modules/pharmacy/types";
import { inventoryService } from "@/modules/pharmacy/services/inventoryService";
import { setPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { glowupStore } from "@/lib/store";

export default function PharmacyBatches() {
  const [data, setData] = useState<PharmacyBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const bizId = glowupStore.getSalons()[0]?.business_id;
      if (bizId) setPharmacyBusinessId(bizId);
    } catch (e) {}
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getBatches();
      setData(res);
    } catch (e: any) {
      if (e.message !== "Business ID not set for Pharmacy Module") {
        toast.error(e.message);
      }
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

  return (
    <DashboardLayout role="salon_admin" title="Lots & Péremptions (FEFO)" subtitle="Gestion des lots de médicaments et dates d'expiration">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Inventaire des Lots" 
            description={`${data.length} lot(s) enregistré(s)`} 
          />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "product", label: "Produit", render: (r) => <span className="font-medium">{r.product?.name || "Inconnu"}</span> },
              { key: "batch_number", label: "N° Lot", render: (r) => <span className="text-muted-foreground">{r.batch_number}</span> },
              { key: "quantity", label: "Stock Restant", render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-bold">{r.current_quantity}</span>
                  <span className="text-xs text-muted-foreground">/ {r.initial_quantity}</span>
                </div>
              )},
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
                if (r.current_quantity <= 0) return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">Épuisé</span>;
                if (isExpired(r.expiration_date)) return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3"/> Périmé</span>;
                if (isExpiringSoon(r.expiration_date)) return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">Expire bientôt</span>;
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Valide</span>;
              }},
            ]}
          />
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
