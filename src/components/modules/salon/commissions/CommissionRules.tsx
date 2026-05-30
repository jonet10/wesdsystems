import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Trash2, Percent, DollarSign } from "lucide-react";

interface CommissionRule {
  id: string;
  service_id: string | null;
  rate_type: "percentage" | "fixed_amount";
  rate_value: number;
  service_name?: string;
}

interface Props {
  employeeId: string;
  businessId: string;
  services: { id: string; name: string; commission_percentage?: number }[];
}

export function CommissionRules({ employeeId, businessId, services }: Props) {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [newServiceId, setNewServiceId] = useState<string>("");
  const [newRateType, setNewRateType] = useState<"percentage" | "fixed_amount">("percentage");
  const [newRateValue, setNewRateValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("commission_rules")
        .select("id, service_id, rate_type, rate_value")
        .eq("business_id", businessId)
        .eq("employee_id", employeeId)
        .eq("is_active", true);
      if (data) {
        setRules(
          data.map((r: any) => ({
            ...r,
            rate_value: Number(r.rate_value),
            service_name: services.find((s) => s.id === r.service_id)?.name || "Global",
          }))
        );
      }
    };
    load();
  }, [employeeId, services]);

  const addRule = async () => {
    if (!newRateValue) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commission_rules")
        .insert({
          business_id: businessId,
          employee_id: employeeId,
          service_id: newServiceId && newServiceId !== "all" ? newServiceId : null,
          rate_type: newRateType,
          rate_value: Number(newRateValue),
        })
        .select("id, service_id, rate_type, rate_value")
        .single();
      if (error) throw error;
      if (data) {
        setRules((prev) => [
          ...prev,
          { ...data, rate_value: Number(data.rate_value), service_name: services.find((s) => s.id === data.service_id)?.name || "Global" },
        ]);
      }
      setNewServiceId("");
      setNewRateType("percentage");
      setNewRateValue("");
      toast.success("Règle de commission ajoutée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await supabase.from("commission_rules").update({ is_active: false }).eq("id", id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Règle supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const remainingServices = services.filter(
    (s) => !rules.some((r) => r.service_id === s.id)
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-sm mb-1">Règles de commission</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Définissez des taux personnalisés par prestation
        </p>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Aucune règle personnalisée. La commission globale s'applique.
        </p>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between bg-muted/40 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {rule.service_name || "Global"}
              </Badge>
              <span className="text-sm font-medium">
                {rule.rate_type === "percentage" ? `${rule.rate_value}%` : `${rule.rate_value} HTG`}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule(rule.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        <h5 className="text-xs font-semibold uppercase text-muted-foreground">Ajouter une règle</h5>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Prestation</Label>
            <Select value={newServiceId} onValueChange={setNewServiceId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les prestations</SelectItem>
                {remainingServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={newRateType} onValueChange={(v: any) => setNewRateType(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage"><Percent className="h-3 w-3 inline mr-1" />%</SelectItem>
                <SelectItem value="fixed_amount"><DollarSign className="h-3 w-3 inline mr-1" />Fixe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valeur</Label>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={newRateValue}
              onChange={(e) => setNewRateValue(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={addRule} disabled={loading || !newRateValue} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}
