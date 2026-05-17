import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Calendar, Clock, CheckCircle } from "lucide-react";

const stats = [
  { title: "RDV aujourd'hui", value: 5, icon: <Calendar className="h-6 w-6" /> },
  { title: "RDV cette semaine", value: 18, icon: <Clock className="h-6 w-6" /> },
  { title: "Clients ce mois", value: 42, icon: <CheckCircle className="h-6 w-6" /> },
];

const todaySchedule = [
  { client: "Marie Laurent", service: "Coupe femme", time: "09:00", duration: "1h", status: "done" },
  { client: "Sophie Martin", service: "Brushing", time: "10:30", duration: "45min", status: "done" },
  { client: "Emma Wilson", service: "Coupe + Couleur", time: "14:00", duration: "2h", status: "in_progress" },
  { client: "Lucas Bernard", service: "Coupe homme", time: "16:30", duration: "30min", status: "upcoming" },
  { client: "Clara Dubois", service: "Soin capillaire", time: "17:30", duration: "1h", status: "upcoming" },
];

export default function EmployeeDashboard() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done":
        return <span className="px-2 py-1 rounded-full bg-success/20 text-success text-xs">Terminé</span>;
      case "in_progress":
        return <span className="px-2 py-1 rounded-full bg-info/20 text-info text-xs">En cours</span>;
      default:
        return <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">À venir</span>;
    }
  };

  return (
    <DashboardLayout
      role="employee"
      title="Mon Dashboard"
      subtitle="Bonjour Julie !"
      userName="Julie Martin"
    >
      <StaggerContainer className="space-y-8">
        {/* Stats */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        {/* Today's Schedule */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold font-display">Mon planning du jour</h2>
              <p className="text-sm text-muted-foreground">Mercredi 15 Janvier 2024</p>
            </div>
            <div className="divide-y divide-border">
              {todaySchedule.map((appointment, index) => (
                <div key={index} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="font-semibold">{appointment.time}</p>
                      <p className="text-xs text-muted-foreground">{appointment.duration}</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {appointment.client.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium">{appointment.client}</p>
                        <p className="text-sm text-muted-foreground">{appointment.service}</p>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(appointment.status)}
                </div>
              ))}
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
