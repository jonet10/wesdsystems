import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { toast } from "sonner";

export default function AutoPartsSettingsPage() {
  const businessId = useAutoPartsBusinessId();
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from("auto_parts_settings")
      .select("low_stock_threshold")
      .eq("business_id", businessId)
      .single()
      .then(({ data }) => {
        if (data) setLowStockThreshold(data.low_stock_threshold ?? 5);
      })
      .catch(() => {});
  }, [businessId]);

  const saveSettings = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("auto_parts_settings").upsert(
        { business_id: businessId, low_stock_threshold: lowStockThreshold },
        { onConflict: "business_id" }
      );
      if (error) throw error;
      toast.success("Paramètres sauvegardés");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!businessId) {
    return (
      <DashboardLayout role="salon_admin" title="Paramètres" subtitle="Configuration du module auto-parts">
        <p className="text-muted-foreground p-8">
          Connectez-vous avec un établissement pour configurer les paramètres.
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Paramètres" subtitle="Configuration du module auto-parts">
      <StaggerContainer>
        <StaggerItem>
          <Card>
            <CardHeader><CardTitle className="text-base">Seuil d'alerte stock</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Seuil minimum de stock pour alerte</Label>
                <Input
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  className="w-48"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Une alerte sera générée quand le stock d'un produit passe en dessous de ce seuil.
                </p>
              </div>
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
