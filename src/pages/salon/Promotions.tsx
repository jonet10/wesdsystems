import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {
  Tag, Search, Plus, Pencil, Trash2, Gift,
  Percent, Combine, ToggleLeft, Calendar
} from "lucide-react";
import { PromotionBadge } from "@/components/modules/salon/PromotionBadge";

interface Promotion {
  id: string;
  branch_id: string;
  name: string;
  description?: string;
  promotion_type: "percentage" | "fixed_amount" | "bundle" | "combo";
  discount_value?: number;
  discount_percentage?: number;
  items_config: {
    services?: string[];
    products?: string[];
    beverages?: string[];
  };
  minimum_quantity?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export default function PromotionsPage() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promotionType, setPromotionType] = useState<"percentage" | "fixed_amount" | "bundle" | "combo">("percentage");
  const [discountValue, setDiscountValue] = useState("0");
  const [discountPercentage, setDiscountPercentage] = useState("0");
  const [minQuantity, setMinQuantity] = useState("0");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isActive, setIsActive] = useState(true);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("salon_promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPromotions((data || []) as Promotion[]);
    } catch (err: any) {
      toast.error("Erreur chargement promotions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPromotions(); }, []);

  const resetForm = () => {
    setEditing(null);
    setName(""); setDescription(""); setPromotionType("percentage");
    setDiscountValue("0"); setDiscountPercentage("0");
    setMinQuantity("0"); setValidFrom(""); setValidUntil(""); setIsActive(true);
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (p: Promotion) => {
    setEditing(p);
    setName(p.name); setDescription(p.description || "");
    setPromotionType(p.promotion_type);
    setDiscountValue(String(p.discount_value || 0));
    setDiscountPercentage(String(p.discount_percentage || 0));
    setMinQuantity(String(p.minimum_quantity || 0));
    setValidFrom(p.valid_from || ""); setValidUntil(p.valid_until || "");
    setIsActive(p.is_active);
    setOpen(true);
  };

  const savePromotion = async () => {
    if (!name.trim()) return toast.error("Nom requis");
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      promotion_type: promotionType,
      discount_value: promotionType === "fixed_amount" ? Number(discountValue || 0) : null,
      discount_percentage: promotionType === "percentage" ? Number(discountPercentage || 0) : null,
      items_config: {},
      minimum_quantity: Number(minQuantity || 0) || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_active: isActive,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("salon_promotions").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Promotion modifiée");
      } else {
        const { error } = await supabase.from("salon_promotions").insert([{
          ...payload, branch_id: profile?.business_id,
        }]);
        if (error) throw error;
        toast.success("Promotion créée");
      }
      setOpen(false); resetForm(); loadPromotions();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleActive = async (p: Promotion) => {
    try {
      const { error } = await supabase.from("salon_promotions")
        .update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
      toast.success(p.is_active ? "Promotion désactivée" : "Promotion activée");
      loadPromotions();
    } catch (err: any) { toast.error(err.message); }
  };

  const deletePromotion = async (p: Promotion) => {
    try {
      const { error } = await supabase.from("salon_promotions").delete().eq("id", p.id);
      if (error) throw error;
      toast.success("Promotion supprimée");
      loadPromotions();
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = useMemo(() => {
    let result = promotions;
    if (search) result = result.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    if (typeFilter !== "Tous") result = result.filter(p => p.promotion_type === typeFilter);
    return result;
  }, [promotions, search, typeFilter]);

  const activePromotions = promotions.filter(p => p.is_active);

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Promotions" subtitle="Gestion des promotions">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Promotions" subtitle="Créez des offres et bundles pour vos clients">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Total promotions</p>
              <p className="text-2xl font-bold">{promotions.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Actives</p>
              <p className="text-2xl font-bold text-success">{activePromotions.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Inactives</p>
              <p className="text-2xl font-bold text-muted-foreground">{promotions.length - activePromotions.length}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Tous types</SelectItem>
                  <SelectItem value="percentage">Pourcentage</SelectItem>
                  <SelectItem value="fixed_amount">Montant fixe</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                  <SelectItem value="combo">Combo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle promotion
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-soft transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Gift className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <PromotionBadge type={p.promotion_type} value={p.discount_percentage || p.discount_value} />
                    </div>
                  </div>
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground mb-3">{p.description}</p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {p.promotion_type === "percentage" && p.discount_percentage && (
                    <Badge variant="secondary">{p.discount_percentage}% de réduction</Badge>
                  )}
                  {p.promotion_type === "fixed_amount" && p.discount_value && (
                    <Badge variant="secondary">-{format(p.discount_value)}</Badge>
                  )}
                  {p.minimum_quantity && p.minimum_quantity > 0 && (
                    <Badge variant="outline">Min: {p.minimum_quantity} articles</Badge>
                  )}
                </div>

                {p.valid_from && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Du {p.valid_from} au {p.valid_until || "Illimité"}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePromotion(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Gift className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Aucune promotion trouvée</p>
            </div>
          )}
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la promotion" : "Nouvelle promotion"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: 3 Prestige = 500 Gdes" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Type de promotion</Label>
              <Select value={promotionType} onValueChange={(v: any) => setPromotionType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Pourcentage (ex: -20%)</SelectItem>
                  <SelectItem value="fixed_amount">Montant fixe (ex: -200 Gdes)</SelectItem>
                  <SelectItem value="bundle">Bundle (ex: 3 bières)</SelectItem>
                  <SelectItem value="combo">Combo (ex: Coupe + Bière)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {promotionType === "percentage" && (
              <div>
                <Label>Pourcentage de réduction</Label>
                <Input type="number" value={discountPercentage} onChange={e => setDiscountPercentage(e.target.value)} max={100} />
              </div>
            )}
            {promotionType === "fixed_amount" && (
              <div>
                <Label>Montant de réduction</Label>
                <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
              </div>
            )}
            {(promotionType === "bundle" || promotionType === "combo") && (
              <div>
                <Label>Quantité minimum</Label>
                <Input type="number" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valide du</Label>
                <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
              </div>
              <div>
                <Label>Jusqu'au</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">La promotion est visible pour les clients</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={savePromotion}>{editing ? "Modifier" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
