import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, ClipboardList, CheckCircle } from "lucide-react";
import { glowupStore, Appointment, Employee } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function EmployeeSchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  
  // For demo convenience, allow toggling employee context to see different schedules!
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("1"); // Julie by default

  const loadData = () => {
    const allEmps = glowupStore.getEmployees();
    setEmployees(allEmps);

    const emp = allEmps.find(e => e.id === selectedEmpId) || null;
    setActiveEmployee(emp);

    const allApts = glowupStore.getAppointments();
    const formattedDateStr = currentDate.toISOString().split("T")[0];
    
    // Filter by date and employee
    const filtered = allApts.filter(a => a.employeeId === selectedEmpId && a.date === formattedDateStr);
    
    // Sort chronologically by startHour
    filtered.sort((a, b) => a.startHour - b.startHour);
    setAppointments(filtered);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, [selectedEmpId, currentDate]);

  const formatDateStr = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  };

  const goToPreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const formatHourStr = (decimalHour: number) => {
    const hours = Math.floor(decimalHour);
    const minutes = Math.round((decimalHour - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  // Stats calculation
  const totalDuration = appointments.reduce((sum, a) => sum + a.duration, 0);

  return (
    <DashboardLayout
      role="employee"
      title="Mon Agenda"
      subtitle="Visualisez vos prestations planifiées"
      userName={activeEmployee?.name || "Julie"}
    >
      <StaggerContainer className="space-y-6">
        {/* Navigation Bar */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold capitalize font-display ml-2">
                {formatDateStr(currentDate)}
              </h2>
            </div>

            {/* Quick Employee Switcher (for demo flexibility) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mode Démo - Voir agenda de :</span>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="bg-card border border-border rounded-lg text-sm px-2 py-1 focus:outline-none"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
        </StaggerItem>

        {/* Metric Shift Summary */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total prestations</p>
                <h3 className="text-2xl font-bold font-display">{appointments.length}</h3>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-info/10 text-info rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Temps estimé de travail</p>
                <h3 className="text-2xl font-bold font-display">{totalDuration}h</h3>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-success/10 text-success rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponibilité Shift</p>
                <h3 className="text-2xl font-bold font-display text-success">Active</h3>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Appointment Agenda Stream */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
            <h3 className="font-semibold text-lg mb-4 font-display">Chronologie du jour</h3>

            {appointments.length > 0 ? (
              <div className="relative border-l border-border pl-6 ml-4 space-y-6">
                {appointments.map((apt) => {
                  const endHour = apt.startHour + apt.duration;
                  return (
                    <div key={apt.id} className="relative">
                      {/* Circle Dot Indicator */}
                      <div className={cn("absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-card ring-2", activeEmployee?.color || "bg-primary")} />

                      <div className="bg-muted/30 p-4 rounded-xl border border-border/80 hover:border-primary/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-primary font-semibold">
                            <Clock className="h-4 w-4" />
                            <span>
                              {formatHourStr(apt.startHour)} - {formatHourStr(endHour)} ({apt.duration * 60} min)
                            </span>
                          </div>
                          <h4 className="font-semibold text-base text-foreground">{apt.clientName}</h4>
                          <p className="text-sm text-muted-foreground">{apt.serviceName}</p>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
                          Confirmé
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Aucun rendez-vous planifié aujourd'hui.</p>
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
