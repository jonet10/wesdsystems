import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { 
  Calendar, Users, Euro, Clock, Plus, Pill, Utensils, 
  ShoppingBag, Building, TrendingUp, Activity, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { glowupStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";

export default function SalonDashboard() {
  const { isAuthenticated } = useAuth();
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());

  // --- DUAL MODE DATA FETCHING ---
  const { data: clientsDb, isLoading: clientsLoading } = useSupabaseQuery<any>(['clients'], 'clients', '*', { enabled: isAuthenticated });
  const { data: employeesDb, isLoading: empLoading } = useSupabaseQuery<any>(['employees'], 'employees', '*', { enabled: isAuthenticated });
  const { data: appointmentsDb, isLoading: aptLoading } = useSupabaseQuery<any>(['transactions'], 'transactions', '*', { enabled: isAuthenticated });
  const { data: servicesDb, isLoading: servLoading } = useSupabaseQuery<any>(['services'], 'services', '*', { enabled: isAuthenticated });

  // Resolve active dataset (Supabase or LocalStorage Fallback)
  const clients = useMemo(() => {
    if (clientsDb && clientsDb.length > 0) {
      return clientsDb.map((c: any) => ({ ...c, totalSpent: c.total_spent ? `${c.total_spent}€` : "0€" }));
    }
    return glowupStore.getClients();
  }, [clientsDb]);

  const employees = useMemo(() => (employeesDb && employeesDb.length > 0) ? employeesDb : glowupStore.getEmployees(), [employeesDb]);
  
  const appointments = useMemo(() => {
    if (appointmentsDb && appointmentsDb.length > 0) {
      return appointmentsDb.map((a: any) => ({
        ...a,
        date: a.scheduled_at ? a.scheduled_at.split("T")[0] : new Date().toISOString().split("T")[0],
        duration: a.amount ? 1 : 0.5 // Simplified mapping for MVP
      }));
    }
    return glowupStore.getAppointments();
  }, [appointmentsDb]);

  const services = useMemo(() => (servicesDb && servicesDb.length > 0) ? servicesDb : glowupStore.getServices(), [servicesDb]);

  const isDataLoading = isAuthenticated && (clientsLoading || empLoading || aptLoading || servLoading);

  const [stats, setStats] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (isDataLoading) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const todayApts = appointments.filter((a: any) => a.date === todayStr);
    const business = glowupStore.getActiveBusiness();
    setActiveBiz(business);

    // Calculate MRR / Earnings
    const totalSpentSum = clients.reduce((sum: number, c: any) => {
      const amt = typeof c.totalSpent === 'string' ? parseInt(c.totalSpent.replace("€", "").replace("$", "")) : (c.total_spent || 0);
      return sum + (amt || 0);
    }, 0);

    // Calculate Average Duration
    let avgDurationStr = "45min";
    if (appointments.length > 0) {
      const avgHrs = appointments.reduce((sum: number, a: any) => sum + (a.duration || 1), 0) / appointments.length;
      avgDurationStr = `${Math.round(avgHrs * 60)}min`;
    }

    // Dynamic stats and labels per business vertical!
    if (business === "pharmacie") {
      setStats([
        { title: "Ordonnances aujourd'hui", value: todayApts.length.toString(), icon: <Calendar className="h-6 w-6" /> },
        { title: "Patients au fichier", value: clients.length.toString(), icon: <Users className="h-6 w-6" />, trend: { value: 9, isPositive: true } },
        { title: "Recettes Pharmacie", value: `${totalSpentSum.toLocaleString()}$`, icon: <DollarSign className="h-6 w-6" />, trend: { value: 18, isPositive: true } },
        { title: "Médicaments Référencés", value: services.length.toString(), icon: <Pill className="h-6 w-6" /> },
      ]);
    } else if (business === "restaurant") {
      setStats([
        { title: "Commandes aujourd'hui", value: todayApts.length.toString(), icon: <Utensils className="h-6 w-6" /> },
        { title: "Clients Table Map", value: (clients.length * 2).toString(), icon: <Users className="h-6 w-6" />, trend: { value: 14, isPositive: true } },
        { title: "Recettes Resto & Bar", value: `${(totalSpentSum * 1.2).toFixed(0)}$`, icon: <DollarSign className="h-6 w-6" />, trend: { value: 12, isPositive: true } },
        { title: "Plats / Boissons au Menu", value: services.length.toString(), icon: <ShoppingBag className="h-6 w-6" /> },
      ]);
    } else if (business === "market") {
      setStats([
        { title: "Ventes POS Caisse", value: (todayApts.length * 3).toString(), icon: <ShoppingBag className="h-6 w-6" /> },
        { title: "Membres Fidélité Club", value: clients.length.toString(), icon: <Users className="h-6 w-6" />, trend: { value: 8, isPositive: true } },
        { title: "Recettes Provision", value: `${(totalSpentSum * 2.1).toFixed(0)}$`, icon: <DollarSign className="h-6 w-6" />, trend: { value: 16, isPositive: true } },
        { title: "Articles Inventoriés", value: (services.length * 15).toString(), icon: <Activity className="h-6 w-6" /> },
      ]);
    } else if (business === "boutique") {
      setStats([
        { title: "Ventes Boutique", value: todayApts.length.toString(), icon: <ShoppingBag className="h-6 w-6" /> },
        { title: "Clients CRM", value: clients.length.toString(), icon: <Users className="h-6 w-6" />, trend: { value: 7, isPositive: true } },
        { title: "Revenus Cumulés", value: `${totalSpentSum.toLocaleString()}$`, icon: <DollarSign className="h-6 w-6" />, trend: { value: 11, isPositive: true } },
        { title: "Catalogue Articles", value: services.length.toString(), icon: <Building className="h-6 w-6" /> },
      ]);
    } else {
      setStats([
        { title: "Rendez-vous aujourd'hui", value: todayApts.length.toString(), icon: <Calendar className="h-6 w-6" /> },
        { title: "Clients au fichier", value: clients.length.toString(), icon: <Users className="h-6 w-6" />, trend: { value: 12, isPositive: true } },
        { title: "Revenus cumulés", value: `${totalSpentSum.toLocaleString()}$`, icon: <DollarSign className="h-6 w-6" />, trend: { value: 15, isPositive: true } },
        { title: "Durée moy. RDV", value: avgDurationStr, icon: <Clock className="h-6 w-6" /> },
      ]);
    }

    const formatted = todayApts.map((apt: any) => {
      const emp = employees.find((e: any) => e.id === (apt.employeeId || apt.employee_id));
      const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
      const startH = apt.startHour || 9; 
      const endHour = startH + (apt.duration || 1);
      
      let status = "upcoming";
      if (currentHour >= endHour) {
        status = "done";
      } else if (currentHour >= startH && currentHour < endHour) {
        status = "in_progress";
      }

      const durationMins = Math.round((apt.duration || 1) * 60);
      let durationStr = `${durationMins}min`;
      if (durationMins >= 60) {
        const hrs = Math.floor(durationMins / 60);
        const mins = durationMins % 60;
        durationStr = mins > 0 ? `${hrs}h${mins}` : `${hrs}h`;
      }

      const hoursPart = Math.floor(startH);
      const minutesPart = Math.round((startH - hoursPart) * 60);
      const timeStr = `${hoursPart.toString().padStart(2, "0")}:${minutesPart.toString().padStart(2, "0")}`;

      return {
        client: apt.clientName || apt.client_id || "Client inconnu",
        service: apt.serviceName || apt.service_id || "Service par défaut",
        time: timeStr,
        duration: durationStr,
        employee: emp ? emp.name : "Non assigné",
        status,
        startHour: startH
      };
    });

    formatted.sort((a: any, b: any) => a.startHour - b.startHour);
    setTodayAppointments(formatted);

    const handleUpdate = () => {
      if (!isAuthenticated) setActiveBiz(glowupStore.getActiveBusiness());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, [clients, employees, appointments, services, isDataLoading, isAuthenticated]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done":
        return <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success text-xs font-bold">Terminé</span>;
      case "in_progress":
        return <span className="px-2.5 py-0.5 rounded-full bg-info/15 text-info text-xs font-bold">En cours</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">Planifié</span>;
    }
  };

  const getFormattedTodayDate = () => {
    return new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const getVerticalTexts = () => {
    switch (activeBiz) {
      case "pharmacie":
        return {
          title: "Ordonnances du jour", actionBtn: "Nouvelle Ordonnance", cardTitle: "Rapport Patients & Molécules",
          actionLabel1: "Gérer Ordonnances", actionLabel2: "Base Patients", actionLabel3: "Stock Médicaments"
        };
      case "restaurant":
        return {
          title: "Commandes de service", actionBtn: "Nouvelle Commande", cardTitle: "Dashboard Caisse & Tables",
          actionLabel1: "Caisse & Tables", actionLabel2: "Répertoire Clients", actionLabel3: "Gérer le Menu"
        };
      case "market":
        return {
          title: "Session POS en direct", actionBtn: "Enregistrer Vente", cardTitle: "Transactions de Caisse",
          actionLabel1: "Caisse POS", actionLabel2: "Membres Club", actionLabel3: "Inventaire Produits"
        };
      case "boutique":
        return {
          title: "Ventes Boutique", actionBtn: "Nouvelle Vente", cardTitle: "Dashboard CRM & POS",
          actionLabel1: "Ventes POS", actionLabel2: "Base Clients / CRM", actionLabel3: "Catalogue Articles"
        };
      case "salon":
      default:
        return {
          title: "Rendez-vous du jour", actionBtn: "Nouveau RDV", cardTitle: "Agenda du salon",
          actionLabel1: "Gérer l'agenda", actionLabel2: "Fichier clients", actionLabel3: "Services & tarifs"
        };
    }
  };

  const texts = getFormattedTodayDate();
  const vt = getVerticalTexts();

  if (isDataLoading) {
    return (
      <DashboardLayout role="salon_admin" title="Tableau de bord ERP" subtitle="Synchronisation de vos données...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="salon_admin"
      title="Tableau de bord ERP"
      subtitle={`Espace de gestion multi-business • Propulsé par Wesd Systems`}
      userName="Équipe Wesd"
    >
      <StaggerContainer className="space-y-8">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card text-left">
            <div className="p-6 border-b border-border flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold font-sans tracking-tight">{vt.title}</h2>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{texts}</p>
              </div>
              <div className="flex gap-3">
                <Link to="/salon/appointments">
                  <Button variant="outline" size="sm" className="font-semibold text-xs">Vue interactive</Button>
                </Link>
                <Link to="/salon/appointments">
                  <Button size="sm" variant="hero" className="font-semibold text-xs shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {vt.actionBtn}
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="divide-y divide-border">
              {todayAppointments.map((appointment, index) => (
                <div key={index} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="font-bold text-sm">{appointment.time}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold">{appointment.duration}</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {appointment.client.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-bold text-sm leading-tight text-foreground">{appointment.client}</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{appointment.service}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground font-semibold leading-none">Collaborateur</p>
                      <p className="font-bold text-xs text-foreground mt-0.5">{appointment.employee}</p>
                    </div>
                    {getStatusBadge(appointment.status)}
                  </div>
                </div>
              ))}

              {todayAppointments.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm font-medium">
                  Aucune activité enregistrée pour aujourd'hui !
                </div>
              )}
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <Link to="/salon/appointments" className="group">
              <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 hover:shadow-soft transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm tracking-tight text-foreground">{vt.actionLabel1}</h3>
                <p className="text-xs text-muted-foreground mt-1">Accéder au terminal de vente et réservations</p>
              </div>
            </Link>

            <Link to="/salon/clients" className="group">
              <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 hover:shadow-soft transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm tracking-tight text-foreground">{vt.actionLabel2}</h3>
                <p className="text-xs text-muted-foreground mt-1">Gérer les fiches de comptes et coordonnées clients</p>
              </div>
            </Link>

            <Link to="/salon/services" className="group">
              <div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 hover:shadow-soft transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {activeBiz === "pharmacie" ? <Pill className="h-6 w-6" /> : activeBiz === "restaurant" ? <Utensils className="h-6 w-6" /> : <Euro className="h-6 w-6" />}
                </div>
                <h3 className="font-bold text-sm tracking-tight text-foreground">{vt.actionLabel3}</h3>
                <p className="text-xs text-muted-foreground mt-1">Éditer le catalogue de produits, prix et inventaires</p>
              </div>
            </Link>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
