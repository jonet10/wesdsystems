import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SchoolNotificationService } from "@/modules/school/services/SchoolNotificationService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface StudentAttendanceState {
  id: string;
  name: string;
  status: string;
  arrival_time: string;
  parent_phone?: string;
  attendance_id?: string;
}

export default function TeacherAttendance() {
  const { user, profile } = useAuth();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentAttendanceState[]>([]);

  // Configuration (Official start time for lateness calculation)
  const officialStartTime = "08:00";
  const lateThresholdMinutes = 15; // 8:15 = late

  // 1. Initial Load: Find teacher record and classes
  useEffect(() => {
    if (!user?.id || !businessId) return;

    const initTeacher = async () => {
      try {
        const { data: teacherData } = await supabase
          .from("school_teachers")
          .select("id")
          .eq("user_id", user.id)
          .eq("business_id", businessId)
          .maybeSingle();

        if (!teacherData) return;
        setTeacherId(teacherData.id);

        // Fetch assigned classes
        const { data: assignments } = await supabase
          .from("school_teacher_assignments")
          .select("class_id, class:school_classes(name)")
          .eq("teacher_id", teacherData.id)
          .eq("business_id", businessId);

        const assignedClasses = (assignments || [])
          .filter((a: any) => a.class)
          .map((a: any) => ({
            id: a.class_id,
            name: a.class.name
          }));

        // Deduplicate classes list
        const uniqueClasses = Array.from(new Map(assignedClasses.map(c => [c.id, c])).values());
        setClasses(uniqueClasses);
      } catch (err) {
        console.error("Init teacher error:", err);
      }
    };

    initTeacher();
  }, [user, businessId]);

  // 2. Load class students & existing attendance
  useEffect(() => {
    if (!selectedClass || !date || !businessId) {
      setStudents([]);
      return;
    }

    const loadAttendance = async () => {
      try {
        setLoading(true);

        // 1. Fetch class students
        const { data: enrollments } = await supabase
          .from("school_enrollments")
          .select("student:student_id(id, first_name, last_name, parent_phone)")
          .eq("class_id", selectedClass)
          .eq("business_id", businessId)
          .eq("status", "active");

        const activeStudents = (enrollments || [])
          .filter((e: any) => e.student)
          .map((e: any) => ({
            id: e.student.id,
            name: `${e.student.first_name} ${e.student.last_name}`,
            parent_phone: e.student.parent_phone || ""
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // 2. Fetch attendance entries for today
        const { data: attendanceData } = await supabase
          .from("school_attendance")
          .select("id, person_id, status, delay_minutes, time")
          .eq("class_id", selectedClass)
          .eq("date", date)
          .eq("type", "student")
          .eq("business_id", businessId);

        const attendanceMap = new Map(attendanceData?.map(a => [a.person_id, a]) || []);

        const studentStates = activeStudents.map(s => {
          const attRecord = attendanceMap.get(s.id);
          return {
            id: s.id,
            name: s.name,
            status: attRecord ? attRecord.status : "present",
            arrival_time: attRecord?.time ? attRecord.time.substring(0, 5) : "",
            parent_phone: s.parent_phone,
            attendance_id: attRecord?.id
          };
        });

        setStudents(studentStates);
      } catch (err) {
        console.error("Error loading attendance:", err);
        toast.error("Erreur de chargement des élèves.");
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, [selectedClass, date, businessId]);

  // Calcul automatique du retard
  useEffect(() => {
    setStudents(prev => prev.map(s => {
      if (s.status === 'absent' || s.status === 'excused') return s;
      
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
  }, [students.map(s => s.arrival_time).join(",")]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setStudents(students.map(s => {
      if (s.id === id) {
        return { ...s, status: newStatus, arrival_time: newStatus === 'absent' ? '' : s.arrival_time };
      }
      return s;
    }));
  };

  const handleTimeChange = (id: string, time: string) => {
    setStudents(students.map(s => s.id === id ? { ...s, arrival_time: time } : s));
  };

  const handleSave = async () => {
    if (!selectedClass || !date || !businessId) return;
    try {
      setLoading(true);
      const className = classes.find(c => c.id === selectedClass)?.name || "";

      for (const s of students) {
        let delayMinutes = 0;
        if (s.status === 'late' && s.arrival_time) {
          const [hourStr, minStr] = s.arrival_time.split(":");
          const [offHour, offMin] = officialStartTime.split(":");
          const arrTime = parseInt(hourStr) * 60 + parseInt(minStr);
          const offTime = parseInt(offHour) * 60 + parseInt(offMin);
          delayMinutes = Math.max(0, arrTime - offTime);
        }

        const payload = {
          business_id: businessId,
          class_id: selectedClass,
          person_id: s.id,
          type: 'student' as const,
          date,
          status: s.status,
          time: s.arrival_time ? `${s.arrival_time}:00` : null,
          delay_minutes: delayMinutes,
          teacher_id: teacherId || null
        };

        if (s.attendance_id) {
          await supabase
            .from("school_attendance")
            .update(payload)
            .eq("id", s.attendance_id);
        } else {
          await supabase
            .from("school_attendance")
            .insert(payload);
        }

        // WhatsApp notification fallback to parents in real-time
        if (s.parent_phone && s.parent_phone.trim() !== "") {
          if (s.status === 'absent') {
            await SchoolNotificationService.notifyStudentAbsent(s.name, className, s.parent_phone, businessId);
          } else if (s.status === 'late') {
            await SchoolNotificationService.notifyStudentLate(s.name, s.arrival_time, s.parent_phone, businessId);
          }
        }
      }

      toast.success("Présences enregistrées avec succès et parents notifiés.");
      
      // Force reload to get newly created ids
      // Light reload by re-assigning the date
      setDate(d => d);
    } catch (err: any) {
      console.error("Save attendance error:", err);
      toast.error("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setLoading(false);
    }
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
