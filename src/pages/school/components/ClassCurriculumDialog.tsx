import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";

interface ClassCurriculumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  businessId: string;
}

export function ClassCurriculumDialog({ open, onOpenChange, classId, className, businessId }: ClassCurriculumDialogProps) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [coefficients, setCoefficients] = useState<Record<string, { domain_id: string | null, coef: number }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && classId) {
      loadData();
    }
  }, [open, classId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch domains
      const { data: domainData } = await supabase
        .from("school_subject_domains")
        .select("*")
        .eq("business_id", businessId)
        .order("display_order", { ascending: true });
      setDomains(domainData || []);

      // 2. Fetch all subjects linked to this class
      const { data: linkedSubjects } = await supabase
        .from("school_subject_classes")
        .select("subject_id, subject:school_subjects(id, name)")
        .eq("class_id", classId);

      const subjs = (linkedSubjects || []).map((ls: any) => ({
        id: ls.subject.id,
        name: ls.subject.name
      }));
      setSubjects(subjs);

      // 3. Fetch current coefficients and domains for this class
      const { data: coefData } = await supabase
        .from("school_class_subject_coefficients")
        .select("*")
        .eq("class_id", classId);

      const coefMap: Record<string, { domain_id: string | null, coef: number }> = {};
      
      subjs.forEach(s => {
        coefMap[s.id] = { domain_id: null, coef: 10 };
      });

      (coefData || []).forEach((c: any) => {
        coefMap[c.subject_id] = {
          domain_id: c.domain_id,
          coef: Number(c.coefficient || 10)
        };
      });

      setCoefficients(coefMap);

    } catch (err: any) {
      toast.error("Erreur de chargement: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDomainChange = (subjectId: string, domainId: string) => {
    setCoefficients(prev => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        domain_id: domainId === "none" ? null : domainId
      }
    }));
  };

  const handleCoefChange = (subjectId: string, coef: string) => {
    setCoefficients(prev => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        coef: Number(coef)
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = subjects.map(s => ({
        business_id: businessId,
        class_id: classId,
        subject_id: s.id,
        domain_id: coefficients[s.id]?.domain_id || null,
        coefficient: coefficients[s.id]?.coef || 10
      }));

      if (payload.length === 0) {
        toast.info("Aucune matière à configurer. Ajoutez des matières à cette classe d'abord.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from("school_class_subject_coefficients")
        .upsert(payload, { onConflict: "class_id, subject_id" });

      if (error) throw error;
      toast.success("Programme enregistré !");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erreur de sauvegarde: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col bg-card shadow-2xl border-muted">
        <DialogHeader>
          <DialogTitle>Programme : {className}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Associez les matières à des Domaines et définissez le Coefficient (qui servira de note maximale).
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
             <div className="flex justify-center p-8"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : subjects.length === 0 ? (
             <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
               Aucune matière associée à cette classe. Allez dans "Matières" pour en associer.
             </div>
          ) : (
             <Table>
               <TableHeader className="bg-muted/50 sticky top-0">
                 <TableRow>
                   <TableHead>Matière</TableHead>
                   <TableHead>Domaine</TableHead>
                   <TableHead className="w-[150px]">Coefficient (Max)</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {subjects.map(s => (
                   <TableRow key={s.id}>
                     <TableCell className="font-medium">{s.name}</TableCell>
                     <TableCell>
                       <select
                         className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                         value={coefficients[s.id]?.domain_id || "none"}
                         onChange={(e) => handleDomainChange(s.id, e.target.value)}
                       >
                         <option value="none">-- Aucun Domaine --</option>
                         {domains.map(d => (
                           <option key={d.id} value={d.id}>{d.name}</option>
                         ))}
                       </select>
                     </TableCell>
                     <TableCell>
                       <Input
                         type="number"
                         min={1}
                         className="h-9"
                         value={coefficients[s.id]?.coef || ""}
                         onChange={(e) => handleCoefChange(s.id, e.target.value)}
                       />
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={handleSave} disabled={isSaving || subjects.length === 0}>
            {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer le Programme
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
