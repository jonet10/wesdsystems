import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Printer, Edit2, Check, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface ScheduleRow {
  id: string;
  time: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
}

interface ClassScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  businessId: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const DAY_LABELS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'];

export function ClassScheduleDialog({ open, onOpenChange, classId, className, businessId }: ClassScheduleDialogProps) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (open && classId) {
      fetchSchedule();
    }
  }, [open, classId]);

  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("school_class_schedules")
        .select("*")
        .eq("class_id", classId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setRecordId(data.id);
        setRows(data.schedule_data || []);
      } else {
        setRecordId(null);
        // Default rows
        setRows([
          { id: crypto.randomUUID(), time: "8h10-8h50", monday: "", tuesday: "", wednesday: "", thursday: "", friday: "" },
          { id: crypto.randomUUID(), time: "8h50-9h25", monday: "", tuesday: "", wednesday: "", thursday: "", friday: "" }
        ]);
      }
    } catch (error: any) {
      toast.error("Erreur lors du chargement : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        business_id: businessId,
        class_id: classId,
        schedule_data: rows
      };

      if (recordId) {
        const { error } = await supabase.from("school_class_schedules").update(payload).eq("id", recordId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("school_class_schedules").insert(payload).select().single();
        if (error) throw error;
        if (data) setRecordId(data.id);
      }
      toast.success("Emploi du temps enregistré avec succès");
      setPreviewMode(true);
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement : " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), time: "Heure", monday: "", tuesday: "", wednesday: "", thursday: "", friday: "" }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof ScheduleRow, value: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(rows);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setRows(items);
  };

  const printSchedule = () => {
    window.print();
  };

  const renderMergedTable = () => {
    const isCovered = Array(rows.length).fill(null).map(() => Array(5).fill(false));

    return (
      <div className="bg-white p-6 printable-area print:p-0 print:m-0 w-full overflow-x-auto text-black">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-area, .printable-area * { visibility: visible; }
            .printable-area { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
            @page { size: landscape; margin: 10mm; }
            .no-print { display: none !important; }
          }
        `}</style>
        
        <h2 className="text-center font-bold uppercase mb-4 tracking-wider text-lg">
          CLASSE DE {className}
        </h2>

        <table className="w-full border-collapse border border-gray-800 text-sm">
          <thead>
            <tr>
              <th className="border border-gray-800 p-3 text-center uppercase font-bold bg-white w-32">HEURES</th>
              {DAY_LABELS.map(d => (
                <th key={d} className="border border-gray-800 p-3 text-center uppercase font-bold bg-white w-1/5">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={row.id}>
                <td className="border border-gray-800 p-2 text-center font-medium whitespace-nowrap">{row.time}</td>
                {DAYS.map((day, cIdx) => {
                  if (isCovered[rIdx][cIdx]) return null;
                  
                  const text = row[day];
                  if (!text || !text.trim()) {
                     return <td key={cIdx} className="border border-gray-800 p-2"></td>;
                  }

                  let colSpan = 1;
                  let rowSpan = 1;

                  // Try Horizontal Merge first
                  for (let c = cIdx + 1; c < 5; c++) {
                    if (rows[rIdx][DAYS[c]]?.trim() === text.trim() && !isCovered[rIdx][c]) {
                      colSpan++;
                    } else {
                      break;
                    }
                  }

                  // If no horizontal merge, try vertical merge
                  if (colSpan === 1) {
                    for (let r = rIdx + 1; r < rows.length; r++) {
                      if (rows[r][day]?.trim() === text.trim() && !isCovered[r][cIdx]) {
                        rowSpan++;
                      } else {
                        break;
                      }
                    }
                  }

                  // Mark covered
                  for (let i = 0; i < rowSpan; i++) {
                    for (let j = 0; j < colSpan; j++) {
                      isCovered[rIdx + i][cIdx + j] = true;
                    }
                  }

                  const isHeaderLike = colSpan > 2; // ex: Récréation
                  
                  return (
                    <td 
                      key={cIdx} 
                      colSpan={colSpan} 
                      rowSpan={rowSpan} 
                      className={`border border-gray-800 p-2 text-center ${isHeaderLike ? 'font-black text-xl' : 'font-medium'}`}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col bg-card shadow-2xl border-muted">
        <DialogHeader className="no-print">
          <DialogTitle>Emploi du temps : {className}</DialogTitle>
          <DialogDescription>
            {previewMode 
              ? "Aperçu avant impression. (Fusion automatique activée)" 
              : "Astuce : Écrivez un mot comme 'Récréation' sur tous les jours d'une même ligne pour fusionner la ligne. Tapez 'Evaluation' sur la même colonne pour fusionner la colonne."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* TOOLBAR */}
          <div className="flex justify-between items-center no-print">
            <div>
              {previewMode ? (
                <Button variant="outline" onClick={() => setPreviewMode(false)}>
                  <Edit2 className="mr-2 h-4 w-4" /> Mode Édition
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setPreviewMode(true)}>
                  <Check className="mr-2 h-4 w-4" /> Mode Aperçu (Impression)
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {!previewMode && (
                <>
                  <Button variant="secondary" onClick={addRow}>
                    <Plus className="mr-2 h-4 w-4" /> Ligne
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </>
              )}
              {previewMode && (
                <Button onClick={printSchedule}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimer
                </Button>
              )}
            </div>
          </div>

          {/* CONTENT */}
          <div className="flex-1 overflow-auto border rounded-md bg-white">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement...</div>
            ) : previewMode ? (
              renderMergedTable()
            ) : (
              <div className="min-w-[800px] p-4 text-black">
                <div className="grid grid-cols-[auto_120px_1fr_1fr_1fr_1fr_1fr_auto] gap-2 mb-2 font-bold text-center uppercase text-sm border-b pb-2">
                  <div className="w-8"></div>
                  <div>Heures</div>
                  {DAY_LABELS.map(d => <div key={d}>{d}</div>)}
                  <div className="w-8"></div>
                </div>
                
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="schedule-rows">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                        {rows.map((row, index) => (
                          <Draggable key={row.id} draggableId={row.id} index={index}>
                            {(provided) => (
                              <div 
                                ref={provided.innerRef} 
                                {...provided.draggableProps} 
                                className="grid grid-cols-[auto_120px_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-gray-50 border p-1 rounded-sm hover:bg-gray-100"
                              >
                                <div {...provided.dragHandleProps} className="text-gray-400 hover:text-gray-700 cursor-grab px-1">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <Input 
                                  value={row.time} 
                                  onChange={(e) => updateRow(row.id, 'time', e.target.value)} 
                                  placeholder="08h - 09h"
                                  className="font-bold text-center h-8"
                                />
                                {DAYS.map(day => (
                                  <Input 
                                    key={day}
                                    value={row[day]} 
                                    onChange={(e) => updateRow(row.id, day, e.target.value)} 
                                    placeholder="Matière..."
                                    className="h-8"
                                  />
                                ))}
                                <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
