import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { GraduationCap, BookOpen, Clock, Users, ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const DAYS_LABEL: Record<number, string> = {
  1: "Lundi", 2: "Mardi", 3: "Mercredi",
  4: "Jeudi", 5: "Vendredi", 6: "Samedi", 7: "Dimanche"
};

interface TodaySlot {
  id: string;
  start_time: string;
  end_time: string;
  classroom: string | null;
  subject: { name: string } | null;
  class: { name: string; section: string | null } | null;
}

interface TeacherStats {
  totalClasses: number;
  totalSubjects: number;
  totalStudents: number;
  weeklyHours: number;
}

export default function TeacherDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  console.log("[TeacherDashboard] Rendering. user:", user?.id, "profile:", profile);

  const [stats, setStats] = useState<TeacherStats>({
    totalClasses: 0,
    totalSubjects: 0,
    totalStudents: 0,
    weeklyHours: 0,
  });
  const [todaySlots, setTodaySlots] = useState<TodaySlot[]>([]);
  const [teacherName, setTeacherName] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = user?.id;
        const businessId = profile?.business_id || user?.user_metadata?.business_id;
        if (!userId || !businessId) return;

        // 1. Find teacher record linked to this user account
        const { data: teacherData, error: teacherErr } = await supabase
          .from("school_teachers")
          .select("id, first_name, last_name")
          .eq("user_id", userId)
          .eq("business_id", businessId)
          .maybeSingle();

        if (teacherErr || !teacherData) return;

        const teacherId = teacherData.id;
        setTeacherName(`${teacherData.first_name} ${teacherData.last_name}`);

        // 2. Get all assignments for this teacher
        const { data: assignments } = await supabase
          .from("school_teacher_assignments")
          .select("id, class_id, subject_id, hours_per_week, subject:school_subjects(name), class:school_classes(name, section, id)")
          .eq("teacher_id", teacherId)
          .eq("business_id", businessId);

        const activeAssignments = assignments || [];

        // 3. Get all timetable slots for this teacher (only for today's schedule)
        const { data: slots } = await supabase
          .from("school_timetables")
          .select("id, day_of_week, start_time, end_time, classroom, subject:school_subjects(name), class:school_classes(name, section, id)")
          .eq("teacher_id", teacherId)
          .eq("business_id", businessId)
          .order("day_of_week")
          .order("start_time");

        // Today's slots
        const todayDow = new Date().getDay(); // 0 = Sunday
        const todayVal = todayDow === 0 ? 7 : todayDow; // convert to 1-7 (Mon-Sun)
        const todaySchedule = slots ? slots.filter((s: any) => s.day_of_week === todayVal) : [];
        setTodaySlots(todaySchedule as any);

        // 4. Distinct classes and subjects from assignments
        const classIds = [...new Set(activeAssignments.map((a: any) => a.class_id).filter(Boolean))];
        const subjectIds = [...new Set(activeAssignments.map((a: any) => a.subject_id).filter(Boolean))];

        // 5. Count students only from the teacher's classes (active enrollments)
        let totalStudents = 0;
        if (classIds.length > 0) {
          const { count, error: countErr } = await supabase
            .from("school_enrollments")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("status", "active")
            .in("class_id", classIds);
          
          if (countErr) {
            console.error("Erreur comptage élèves:", countErr);
          } else {
            totalStudents = count || 0;
          }
        }

        // 6. Weekly hours: sum of hours_per_week from assignments
        const weeklyHours = activeAssignments.reduce((sum: number, a: any) => sum + (Number(a.hours_per_week) || 0), 0);

        setStats({
          totalClasses: classIds.length,
          totalSubjects: subjectIds.length,
          totalStudents,
          weeklyHours,
        });
      } catch (err) {
        console.error("Erreur lors de la récupération des données du dashboard enseignant :", err);
      }
    };

    fetchData();
  }, [user, profile]);

  const formatTime = (t: string) => t?.substring(0, 5) || t;

  return (
    <DashboardLayout role="school_teacher" title="Espace Enseignant" subtitle={teacherName ? `Bienvenue, ${teacherName}` : "Bienvenue dans votre espace pédagogique"}>
      <StaggerContainer>
        {/* Stats Cards */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Mes Classes</p>
                    <p className="text-3xl font-bold">{stats.totalClasses}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Mes Matières</p>
                    <p className="text-3xl font-bold">{stats.totalSubjects}</p>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Élèves (mes classes)</p>
                    <p className="text-3xl font-bold">{stats.totalStudents}</p>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Heures / Semaine</p>
                    <p className="text-3xl font-bold">{stats.weeklyHours}h</p>
                  </div>
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        {/* Actions + Today's Schedule */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Actions Rapides</CardTitle>
                <CardDescription>Accès direct à vos tâches pédagogiques</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="justify-between h-auto py-4"
                  onClick={() => navigate("/school/teacher/grades")}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Saisir les Notes</p>
                      <p className="text-xs text-muted-foreground">Interrogations, devoirs, examens</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  className="justify-between h-auto py-4"
                  onClick={() => navigate("/school/teacher/attendance")}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Faire l'Appel (Présences)</p>
                      <p className="text-xs text-muted-foreground">Saisir les retards et absences</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>

            {/* Today's Schedule */}
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Aujourd'hui — {DAYS_LABEL[new Date().getDay() === 0 ? 7 : new Date().getDay()]}</CardTitle>
                    <CardDescription>Votre emploi du temps du jour</CardDescription>
                  </div>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {todaySlots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <Calendar className="w-8 h-8 opacity-40" />
                    <p className="text-sm">Pas de cours aujourd'hui</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todaySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/50"
                      >
                        <div className="font-bold text-base text-primary min-w-[60px]">
                          {formatTime(slot.start_time)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{slot.subject?.name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Classe : {slot.class?.name}{slot.class?.section ? ` ${slot.class.section}` : ""}
                            {slot.classroom ? ` · Salle ${slot.classroom}` : ""}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          → {formatTime(slot.end_time)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
