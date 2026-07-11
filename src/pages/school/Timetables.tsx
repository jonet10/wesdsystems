import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PrintableTimetable } from "./components/PrintableTimetable";
import {
  Calendar, Plus, Clock, MapPin, BookOpen, User, Trash2, Pencil, AlertTriangle, RefreshCw, Printer
} from "lucide-react";
import { toast } from "sonner";
import {
  useClasses, useSubjects, useTeachers,
  useTimetable, useCreateTimetableSlot, useDeleteTimetableSlot
} from "@/hooks/useSchoolData";
import type { SchoolTimetableSlot } from "@/modules/school/services/timetableService";

const DAYS_OF_WEEK = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
];

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"
];

export default function SchoolTimetables() {
  const [selectedClassId, setSelectedClassId] = useState("");

  // Data fetching
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: teachers = [] } = useTeachers();
  const { data: slots = [], isLoading: isLoadingSlots, refetch } = useTimetable(selectedClassId);

  // Mutations
  const createSlotMutation = useCreateTimetableSlot();
  const deleteSlotMutation = useDeleteTimetableSlot();

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [classroom, setClassroom] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Select first class by default
  if (classes.length > 0 && !selectedClassId) {
    setSelectedClassId(classes[0].id);
  }

  const updateSuggestedTime = (day: number) => {
    const daySlots = slots.filter(s => s.day_of_week === day);
    if (daySlots.length > 0) {
      const endTimes = daySlots.map(s => s.end_time.substring(0, 5));
      const lastEndTime = endTimes.sort().reverse()[0];
      
      setStartTime(lastEndTime);
      
      const startIndex = TIME_SLOTS.indexOf(lastEndTime);
      if (startIndex !== -1 && startIndex + 2 < TIME_SLOTS.length) {
         setEndTime(TIME_SLOTS[startIndex + 2]); // default to +1 hour (2 slots of 30m)
      } else {
         setEndTime("10:00");
      }
    } else {
      setStartTime("08:00");
      setEndTime("09:00");
    }
  };

  const resetForm = () => {
    setSubjectId("");
    setTeacherId("");
    setDayOfWeek(1);
    updateSuggestedTime(1);
    setClassroom("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !subjectId || !teacherId) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (startTime >= endTime) {
      toast.error("L'heure de fin doit être postérieure à l'heure de début");
      return;
    }

    setIsSaving(true);
    try {
      await createSlotMutation.mutateAsync({
        class_id: selectedClassId,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
        classroom: classroom.trim() || null,
      });

      toast.success("Créneau de cours enregistré avec succès !");
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Erreur de planification");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous supprimer ce créneau horaire ?")) return;
    try {
      await deleteSlotMutation.mutateAsync({ id, classId: selectedClassId });
      toast.success("Créneau supprimé.");
    } catch (error: any) {
      toast.error("Erreur de suppression");
    }
  };

  // Group slots by day of week
  const slotsByDay = DAYS_OF_WEEK.map(day => {
    const daySlots = slots.filter(s => s.day_of_week === day.value);
    return {
      ...day,
      slots: daySlots,
    };
  });

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-5xl mx-auto print:hidden">
        
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" /> Emploi du Temps Scolaire
            </h1>
            <p className="text-muted-foreground">Planifiez les cours hebdomadaires et évitez les doubles réservations</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} disabled={!selectedClassId || slots.length === 0}>
              <Printer className="h-4 w-4 mr-2" /> Exporter (Grille)
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button disabled={!selectedClassId}>
                  <Plus className="h-4 w-4 mr-2" /> Ajouter un cours
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un créneau horaire</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Matière</Label>
                  <select
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Choisir une matière --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Professeur</Label>
                  <select
                    value={teacherId}
                    onChange={e => setTeacherId(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Choisir un enseignant --</option>
                    {teachers
                      .filter(t => t.active)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.job_title || "Professeur"})</option>
                      ))
                    }
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Jour</Label>
                    <select
                      value={dayOfWeek}
                      onChange={e => {
                        const newDay = parseInt(e.target.value);
                        setDayOfWeek(newDay);
                        updateSuggestedTime(newDay);
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                    >
                      {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5 font-medium">
                    <Label>Salle de classe</Label>
                    <select
                      value={classroom}
                      onChange={e => setClassroom(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="">-- Choisir une classe --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Début</Label>
                    <select
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                    >
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Fin</Label>
                    <select
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                    >
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  Le système validera en temps réel la disponibilité du professeur et de la salle.
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Planification..." : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* ── Selection Class ── */}
        <Card className="p-4 bg-muted/30">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="space-y-1.5 min-w-[200px]">
              <Label>Sélectionner une Classe</Label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                disabled={isLoadingClasses}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {isLoadingClasses ? (
                  <option>Chargement des classes...</option>
                ) : classes.length === 0 ? (
                  <option>Aucune classe disponible</option>
                ) : (
                  classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                )}
              </select>
            </div>
            {selectedClassId && (
              <p className="text-sm text-muted-foreground mt-4 sm:mt-0">
                Planification pour l'emploi du temps hebdomadaire de la classe.
              </p>
            )}
          </div>
        </Card>

        {/* ── Timetable Grid/List ── */}
        <div className="space-y-4">
          {isLoadingSlots ? (
            <div className="text-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Chargement de l'emploi du temps...
            </div>
          ) : slots.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Calendar className="h-8 w-8 opacity-45" />
              <p>Aucun cours n'est planifié pour cette classe.</p>
              <p className="text-xs">Cliquez sur "Ajouter un cours" ci-dessus pour construire la grille.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {slotsByDay.map(day => (
                <Card key={day.value} className={day.slots.length === 0 ? "opacity-60" : ""}>
                  <div className="p-4 border-b bg-muted/20 font-bold text-sm tracking-wide uppercase text-primary">
                    {day.label}
                  </div>
                  <CardContent className="p-0">
                    {day.slots.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Aucun cours prévu ce jour.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {day.slots.map(slot => (
                          <div key={slot.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-all">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                                  {slot.subject?.name}
                                </span>
                                {slot.classroom && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                                    <MapPin className="h-2.5 w-2.5" /> {slot.classroom}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {slot.teacher?.first_name} {slot.teacher?.last_name}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(slot.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE GRID */}
      <div className="hidden print:block w-full">
        <PrintableTimetable 
           slots={slots} 
           className={classes.find(c => c.id === selectedClassId)?.name} 
           showTeacher={true} 
        />
      </div>
    </DashboardLayout>
  );
}
