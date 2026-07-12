import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SchoolNotificationService } from "@/modules/school/services/SchoolNotificationService";

export default function TeacherAttendance() {
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Configuration (Mock for UI, should be fetched from school_notification_settings)
  const officialStartTime = "08:00";
  const lateThresholdMinutes = 15; // 8:15 = late

  const classes = [{ id: "1", name: "7AF" }, { id: "2", name: "NS1" }];
  
  const [students, setStudents] = useState([
    { id: "s1", name: "Jean Pierre", status: "present", arrival_time: "07:55" },
    { id: "s2", name: "Marie Claire", status: "absent", arrival_time: "" },
    { id: "s3", name: "Paul Junior", status: "present", arrival_time: "08:20" }, // Devrait être retard
  ]);

  // Calcul automatique du retard
  useEffect(() => {
    setStudents(prev => prev.map(s => {
      if (s.status === 'absent') return s;
      
      if (s.arrival_time) {
        const [hourStr, minStr] = s.arrival_time.split(":");
        const [offHour, offMin] = officialStartTime.split(":");
        
        const arrTime = parseInt(hourStr) * 60 + parseInt(minStr);
        const offTime = parseInt(offHour) * 60 + parseInt(offMin);
        
        if (arrTime > offTime + lateThresholdMinutes) {
          return { ...s, status: "late" };
        } else {
          return { ...s, status: "present" };
        }
      }
      return s;
    }));
  }, [students.map(s => s.arrival_time).join(",")]); // Trigger only when arrival_time changes

  const handleStatusChange = (id: string, newStatus: string) => {
    setStudents(students.map(s => {
      if (s.id === id) {
        // Reset arrival time if marked absent
        return { ...s, status: newStatus, arrival_time: newStatus === 'absent' ? '' : s.arrival_time };
      }
      return s;
    }));
  };

  const handleTimeChange = (id: string, time: string) => {
    setStudents(students.map(s => s.id === id ? { ...s, arrival_time: time } : s));
  };

  const handleSave = async () => {
    setLoading(true);
    // Simulate API Call
    await new Promise(r => setTimeout(r, 1000));
    
    // Simulate sending notifications
    for (const student of students) {
      if (student.status === 'absent') {
        await SchoolNotificationService.notifyStudentAbsent(student.name, "7AF", "+50900000000");
      } else if (student.status === 'late') {
        await SchoolNotificationService.notifyStudentLate(student.name, student.arrival_time, "+50900000000");
      }
    }

    setLoading(false);
    toast.success("Présences enregistrées avec succès. Les notifications WhatsApp seront envoyées selon la configuration.");
  };

  const getStatusBadge = (status: string) => {
    if (status === 'present') return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1"/> Présent</Badge>;
    if (status === 'absent') return <Badge variant="default" className="bg-destructive/10 text-destructive"><XCircle className="w-3 h-3 mr-1"/> Absent</Badge>;
    if (status === 'late') return <Badge variant="default" className="bg-amber-500/10 text-amber-500"><AlertTriangle className="w-3 h-3 mr-1"/> Retard</Badge>;
    return null;
  };

  return (
    <DashboardLayout role="school_teacher" title="Faire l'appel" subtitle="Gestion des présences et retards">
      <StaggerContainer>
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </StaggerItem>

        {selectedClass && (
          <StaggerItem>
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader>
                <CardTitle>Liste des élèves</CardTitle>
                <CardDescription>
                  Heure officielle d'entrée : {officialStartTime} (Seuil retard: {lateThresholdMinutes} min)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Heure d'arrivée</TableHead>
                        <TableHead className="text-right">Actions Rapides</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            {getStatusBadge(s.status)}
                          </TableCell>
                          <TableCell>
                            <div className="relative max-w-[120px]">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="time"
                                className="pl-9"
                                value={s.arrival_time}
                                onChange={(e) => handleTimeChange(s.id, e.target.value)}
                                disabled={s.status === 'absent'}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant={s.status === 'present' ? 'default' : 'outline'}
                                className={s.status === 'present' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                onClick={() => handleStatusChange(s.id, 'present')}
                              >
                                Présent
                              </Button>
                              <Button 
                                size="sm" 
                                variant={s.status === 'absent' ? 'default' : 'outline'}
                                className={s.status === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
                                onClick={() => handleStatusChange(s.id, 'absent')}
                              >
                                Absent
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={loading} className="gap-2">
                    {loading ? <span className="animate-pulse">Enregistrement...</span> : <Save className="w-4 h-4" />}
                    Enregistrer les présences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        )}
      </StaggerContainer>
    </DashboardLayout>
  );
}
