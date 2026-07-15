import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Lock, AlertCircle } from "lucide-react";
import { SchoolNotificationService } from "@/modules/school/services/SchoolNotificationService";
import { useAuth } from "@/hooks/useAuth";

export default function TeacherGrades() {
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;
  const teacherName = profile?.full_name || user?.email || "Enseignant";

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock data for UI
  const classes = [{ id: "1", name: "7AF" }, { id: "2", name: "NS1" }];
  const subjects = [{ id: "1", name: "Mathématiques" }, { id: "2", name: "Physique" }];
  const [students, setStudents] = useState([
    { id: "s1", name: "Jean Pierre", grade: "" },
    { id: "s2", name: "Marie Claire", grade: "" },
  ]);

  const handleGradeChange = (id: string, val: string) => {
    if (isLocked) return;
    setStudents(students.map(s => s.id === id ? { ...s, grade: val } : s));
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    // Simulate save
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    toast.success("Brouillon enregistré.");
  };

  const handleSubmit = async () => {
    if (confirm("Attention : Une fois soumises, vous ne pourrez plus modifier ces notes. Voulez-vous continuer ?")) {
      setLoading(true);
      await new Promise(r => setTimeout(r, 1000));
      setIsLocked(true);
      setLoading(false);
      toast.success("Notes soumises et verrouillées ! La direction a été notifiée.");
      
      const className = classes.find(c => c.id === selectedClass)?.name || "";
      const subjectName = subjects.find(s => s.id === selectedSubject)?.name || "";
      await SchoolNotificationService.notifyGradesSubmitted(businessId || "", teacherName, subjectName, className);
    }
  };

  return (
    <DashboardLayout role="school_teacher" title="Saisie des Notes" subtitle="Évaluation des élèves">
      <StaggerContainer>
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une matière" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </StaggerItem>

        {selectedClass && selectedSubject && (
          <StaggerItem>
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Grille de Notes</CardTitle>
                  <CardDescription>Saisissez les notes sur 100</CardDescription>
                </div>
                {isLocked && (
                  <div className="flex items-center text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-sm font-medium">
                    <Lock className="w-4 h-4 mr-2" /> Notes Verrouillées
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead className="w-[150px] text-right">Note / 100</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              className="text-right font-bold" 
                              value={s.grade}
                              onChange={(e) => handleGradeChange(s.id, e.target.value)}
                              disabled={isLocked}
                              min={0}
                              max={100}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4">
                  {!isLocked && (
                    <>
                      <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
                        Enregistrer le brouillon
                      </Button>
                      <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                        {loading ? <span className="animate-pulse">Traitement...</span> : <Save className="w-4 h-4" />}
                        Soumettre & Verrouiller
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        )}
      </StaggerContainer>
    </DashboardLayout>
  );
}
