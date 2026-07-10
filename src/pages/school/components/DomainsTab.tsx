import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function DomainsTab() {
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [domains, setDomains] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog & Form
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (businessId) loadDomains();
  }, [businessId]);

  const loadDomains = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("school_subject_domains")
        .select("*")
        .eq("business_id", businessId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setDomains(data || []);
    } catch (err: any) {
      toast.error("Erreur de chargement: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingDomain(null);
    setName("");
    setDisplayOrder(domains.length + 1);
  };

  const handleEdit = (domain: any) => {
    setEditingDomain(domain);
    setName(domain.name);
    setDisplayOrder(domain.display_order || 0);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nom du domaine requis");

    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        name: name.trim(),
        display_order: displayOrder
      };

      if (editingDomain) {
        const { error } = await supabase.from("school_subject_domains").update(payload).eq("id", editingDomain.id);
        if (error) throw error;
        toast.success("Domaine mis à jour");
      } else {
        const { error } = await supabase.from("school_subject_domains").insert([payload]);
        if (error) throw error;
        toast.success("Domaine ajouté");
      }

      setIsDialogOpen(false);
      loadDomains();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer ce domaine ?")) return;
    try {
      const { error } = await supabase.from("school_subject_domains").delete().eq("id", id);
      if (error) throw error;
      toast.success("Domaine supprimé");
      loadDomains();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Domaines de Compétences
          </CardTitle>
          <CardDescription>
            Créez les grands groupes (Langues, Mathématiques...) pour structurer vos bulletins et exports Excel.
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card shadow-2xl border-muted">
            <DialogHeader>
              <DialogTitle>{editingDomain ? "Modifier le domaine" : "Nouveau domaine"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nom du Domaine (ex: Langue, Mathématiques)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du domaine" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Ordre d'affichage (ex: 1, 2, 3)</Label>
                <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isSaving}>Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[80px]">Ordre</TableHead>
                <TableHead>Nom du Domaine</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Aucun domaine configuré.</TableCell>
                </TableRow>
              ) : (
                domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-mono text-xs">{domain.display_order}</TableCell>
                    <TableCell className="font-medium">{domain.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(domain)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(domain.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
