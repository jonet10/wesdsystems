import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Tag, Coins } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import type { SchoolFeeCategory, SchoolFee, SchoolClass, SchoolAcademicYear } from "@/modules/school/types";

export default function SchoolFees() {
  const { user, profile, isAuthenticated } = useAuth();
  const { format: formatAmount } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  // Data
  const [categories, setCategories] = useState<SchoolFeeCategory[]>([]);
  const [fees, setFees] = useState<SchoolFee[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<SchoolAcademicYear[]>([]);
  const [activeYear, setActiveYear] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);

  // Load Initial Data
  const loadData = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const [catsRes, feesRes, classRes, yearsRes] = await Promise.all([
        supabase.from("school_fee_categories").select("*").eq("business_id", businessId),
        supabase.from("school_fees").select("*, category:category_id(*)").eq("business_id", businessId),
        supabase.from("school_classes").select("*").eq("business_id", businessId).order("name"),
        supabase.from("school_academic_years").select("*").eq("business_id", businessId).order("name", { ascending: false })
      ]);

      if (catsRes.error) throw catsRes.error;
      if (feesRes.error) throw feesRes.error;
      if (classRes.error) throw classRes.error;
      if (yearsRes.error) throw yearsRes.error;

      setCategories(catsRes.data || []);
      setFees(feesRes.data || []);
      setClasses(classRes.data || []);
      
      const years = yearsRes.data || [];
      setAcademicYears(years);
      
      const currentYear = years.find(y => y.active);
      if (currentYear) setActiveYear(currentYear.id);
      else if (years.length > 0) setActiveYear(years[0].id);

    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, businessId]);

  // CATEGORY FORM
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<SchoolFeeCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catMandatory, setCatMandatory] = useState(false);

  const handleEditCat = (cat: SchoolFeeCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || "");
    setCatMandatory(cat.is_mandatory);
    setIsCatDialogOpen(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) { toast.error("Erreur de session (businessId manquant)"); return; }

    try {
      const payload = {
        business_id: businessId,
        name: catName,
        description: catDesc || null,
        is_mandatory: catMandatory,
      };

      if (editingCat) {
        await supabase.from("school_fee_categories").update(payload).eq("id", editingCat.id);
        toast.success("Catégorie mise à jour");
      } else {
        await supabase.from("school_fee_categories").insert([payload]);
        toast.success("Catégorie ajoutée");
      }
      setIsCatDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    try {
      await supabase.from("school_fee_categories").delete().eq("id", id);
      toast.success("Catégorie supprimée");
      loadData();
    } catch {
      toast.error("Impossible de supprimer", { description: "Cette catégorie est utilisée." });
    }
  };

  // FEE FORM
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<SchoolFee | null>(null);
  const [feeClassId, setFeeClassId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [feeCatId, setFeeCatId] = useState("");
  const [feeAmount, setFeeAmount] = useState("");

  // Filters
  const [filterClassId, setFilterClassId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");

  const handleEditFee = (fee: SchoolFee) => {
    setEditingFee(fee);
    setFeeClassId(fee.class_id);
    setSelectedClassIds([fee.class_id]);
    setFeeCatId(fee.category_id);
    setFeeAmount(fee.amount.toString());
    setIsFeeDialogOpen(true);
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !activeYear) return;

    try {
      if (editingFee) {
        const payload = {
          business_id: businessId,
          class_id: feeClassId,
          academic_year_id: activeYear,
          category_id: feeCatId,
          amount: parseFloat(feeAmount),
        };
        await supabase.from("school_fees").update(payload).eq("id", editingFee.id);
        toast.success("Frais mis à jour");
      } else {
        if (selectedClassIds.length === 0) {
          toast.error("Veuillez sélectionner au moins une classe");
          return;
        }

        const payloadsToInsert = [];
        let skippedCount = 0;

        for (const classId of selectedClassIds) {
          const exists = fees.find(f => 
            f.class_id === classId && 
            f.category_id === feeCatId && 
            f.academic_year_id === activeYear
          );
          if (exists) {
            skippedCount++;
            continue;
          }
          payloadsToInsert.push({
            business_id: businessId,
            class_id: classId,
            academic_year_id: activeYear,
            category_id: feeCatId,
            amount: parseFloat(feeAmount),
          });
        }

        if (payloadsToInsert.length === 0) {
          toast.error("Ces tarifs existent déjà pour toutes les classes sélectionnées.");
          return;
        }

        const { error } = await supabase.from("school_fees").insert(payloadsToInsert);
        if (error) throw error;

        if (skippedCount > 0) {
          toast.success(`Frais ajoutés pour ${payloadsToInsert.length} classe(s) (${skippedCount} ignorée(s) car déjà configurée(s))`);
        } else {
          toast.success(`Frais ajoutés pour ${payloadsToInsert.length} classe(s)`);
        }
      }
      setIsFeeDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    }
  };

  const handleDeleteFee = async (id: string) => {
    if (!confirm("Supprimer ce frais ?")) return;
    try {
      await supabase.from("school_fees").delete().eq("id", id);
      toast.success("Frais supprimé");
      loadData();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const filteredFees = fees.filter(f => {
    const matchesYear = f.academic_year_id === activeYear;
    const matchesClass = !filterClassId || f.class_id === filterClassId;
    const matchesCategory = !filterCategoryId || f.category_id === filterCategoryId;
    return matchesYear && matchesClass && matchesCategory;
  });

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Frais & Tarifs</h1>
          <p className="text-muted-foreground">
            Configurez les catégories de paiement et les montants par classe
          </p>
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
            <TabsTrigger value="categories" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
              <Tag className="h-4 w-4 mr-2" />
              Catégories de Frais
            </TabsTrigger>
            <TabsTrigger value="amounts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
              <Coins className="h-4 w-4 mr-2" />
              Montants par Classe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="m-0">
            <div className="flex justify-end mb-4">
              <Dialog open={isCatDialogOpen} onOpenChange={(open) => {
                setIsCatDialogOpen(open);
                if (!open) { setEditingCat(null); setCatName(""); setCatDesc(""); setCatMandatory(false); }
              }}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Nouvelle Catégorie</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingCat ? "Modifier" : "Nouvelle catégorie"}</DialogTitle></DialogHeader>
                  <form onSubmit={handleSaveCat} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Inscription, Scolarité" />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={catDesc} onChange={e => setCatDesc(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg mt-2">
                      <div className="space-y-0.5">
                        <Label>Obligatoire</Label>
                        <p className="text-sm text-muted-foreground">Est-ce un frais obligatoire pour tous ?</p>
                      </div>
                      <Switch checked={catMandatory} onCheckedChange={setCatMandatory} />
                    </div>
                    <div className="flex justify-end pt-4"><Button type="submit">Enregistrer</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Obligatoire</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune catégorie</TableCell></TableRow>
                    ) : (
                      categories.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.description || "-"}</TableCell>
                          <TableCell>{c.is_mandatory ? "Oui" : "Non"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCat(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteCat(c.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="amounts" className="m-0 space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-secondary/20 p-3 rounded-lg border border-border/50">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Année :</Label>
                    <select 
                      className="flex h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background"
                      value={activeYear}
                      onChange={e => setActiveYear(e.target.value)}
                    >
                      {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Classe :</Label>
                    <select 
                      className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background"
                      value={filterClassId}
                      onChange={e => setFilterClassId(e.target.value)}
                    >
                      <option value="">Toutes les classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Catégorie :</Label>
                    <select 
                      className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background"
                      value={filterCategoryId}
                      onChange={e => setFilterCategoryId(e.target.value)}
                    >
                      <option value="">Toutes les catégories</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <Dialog open={isFeeDialogOpen} onOpenChange={(open) => {
                  setIsFeeDialogOpen(open);
                  if (!open) { 
                    setEditingFee(null); 
                    setFeeClassId(""); 
                    setSelectedClassIds([]); 
                    setFeeCatId(""); 
                    setFeeAmount(""); 
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button disabled={!activeYear} className="w-full md:w-auto"><Plus className="h-4 w-4 mr-2" />Ajouter un tarif</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>{editingFee ? "Modifier le tarif" : "Ajouter un tarif"}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveFee} className="space-y-4 pt-4">
                      {editingFee ? (
                        <div className="space-y-2">
                          <Label>Classe</Label>
                          <select disabled className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={feeClassId}>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="font-semibold">Classes concernées</Label>
                          <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-background/50">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                              <input 
                                type="checkbox"
                                id="select-all-classes"
                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
                                checked={selectedClassIds.length === classes.length && classes.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClassIds(classes.map(c => c.id));
                                  } else {
                                    setSelectedClassIds([]);
                                  }
                                }}
                              />
                              <label htmlFor="select-all-classes" className="text-xs font-semibold cursor-pointer text-foreground/80 hover:text-foreground">
                                Sélectionner toutes les classes ({classes.length})
                              </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {classes.map(c => (
                                <div key={c.id} className="flex items-center gap-2 hover:bg-secondary/20 p-1 rounded-sm transition-colors">
                                  <input 
                                    type="checkbox"
                                    id={`class-chk-${c.id}`}
                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background cursor-pointer"
                                    checked={selectedClassIds.includes(c.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedClassIds([...selectedClassIds, c.id]);
                                      } else {
                                        setSelectedClassIds(selectedClassIds.filter(id => id !== c.id));
                                      }
                                    }}
                                  />
                                  <label htmlFor={`class-chk-${c.id}`} className="text-xs cursor-pointer truncate text-foreground/70 hover:text-foreground">
                                    {c.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Catégorie de Frais</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={feeCatId} onChange={e => setFeeCatId(e.target.value)}>
                          <option value="">Sélectionner une catégorie</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Montant</Label>
                        <Input type="number" step="0.01" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} />
                      </div>
                      <div className="flex justify-end pt-4"><Button type="submit">Enregistrer</Button></div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Classe</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFees.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun tarif configuré pour cette année</TableCell></TableRow>
                    ) : (
                      filteredFees.map(f => {
                        const clsName = classes.find(c => c.id === f.class_id)?.name || "-";
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium">{clsName}</TableCell>
                            <TableCell>{f.category?.name}</TableCell>
                            <TableCell className="font-semibold">{formatAmount(f.amount)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleEditFee(f)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteFee(f.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
