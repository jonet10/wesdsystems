import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Clock, Scissors, Calendar as CalendarIcon, User, Search, X, Pen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { glowupStore, Appointment, Employee, Service } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useActiveBranchId } from "@/lib/branch";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AlertCircle } from "lucide-react";

const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 to 18:00

export default function AppointmentsPage() {
  const { isAuthenticated, profile } = useAuth();
  const { format, currency } = useCurrency();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [], isFetching: branchesFetching } = useBusinessBranches();

  const activeBranchId = useMemo(() => {
    const valid = branchId && branches.some(b => b.id === branchId) ? branchId : null;
    return valid || branches[0]?.id || null;
  }, [branchId, branches]);

  const [employeesDb, setEmployeesDb] = useState<any[]>([]);
  const [servicesDb, setServicesDb] = useState<any[]>([]);
  const [appointmentsDb, setAppointmentsDb] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBranchId || !isAuthenticated) return;
    const load = async () => {
      const [empRes, svcRes, aptRes] = await Promise.all([
        supabase.from("salon_employees").select("*").eq("branch_id", activeBranchId).eq("is_active", true),
        supabase.from("salon_services").select("*").eq("branch_id", activeBranchId).eq("is_active", true),
        supabase.from("salon_appointments").select("*").eq("branch_id", activeBranchId).order("appointment_date"),
      ]);
      if (!empRes.error) setEmployeesDb(empRes.data || []);
      if (!svcRes.error) setServicesDb(svcRes.data || []);
      if (!aptRes.error) setAppointmentsDb(aptRes.data || []);
    };
    void load();
  }, [activeBranchId, isAuthenticated]);

  const [localEmployees, setLocalEmployees] = useState<Employee[]>(glowupStore.getEmployees().filter(e => e.status === "active"));
  const [localServices, setLocalServices] = useState<Service[]>(glowupStore.getServices());
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>(glowupStore.getAppointments());

  useEffect(() => {
    const handleUpdate = () => {
      setLocalEmployees(glowupStore.getEmployees().filter(e => e.status === "active"));
      setLocalServices(glowupStore.getServices());
      setLocalAppointments(glowupStore.getAppointments());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const employees = useMemo(() => {
    if (isAuthenticated && employeesDb.length > 0) {
      return employeesDb.map((e: any) => ({
        id: e.id,
        name: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
        color: e.color || "bg-primary",
        services: [],
        status: "active"
      }));
    }
    return localEmployees;
  }, [employeesDb, localEmployees, isAuthenticated]);

  const services = useMemo(() => {
    if (isAuthenticated && servicesDb.length > 0) {
      return servicesDb.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration_minutes || 60,
        price: Number(s.price_htg || s.price || 0),
        category: s.category || "Standard",
        popular: false,
        addon_options: Array.isArray(s.metadata?.addon_options) ? s.metadata.addon_options : [],
      }));
    }
    return localServices;
  }, [servicesDb, localServices, isAuthenticated]);

  const appointments = useMemo(() => {
    const formattedDateStr = currentDate.toISOString().split("T")[0];
    if (isAuthenticated && appointmentsDb.length > 0) {
      return appointmentsDb
        .filter((a: any) => a.appointment_date === formattedDateStr)
        .map((a: any) => {
          const [hStr, mStr] = (a.appointment_time || "09:00").split(":");
          const startHour = parseInt(hStr) + parseInt(mStr) / 60;
          const service = servicesDb.find((s: any) => s.id === a.service_id);
          // Use guest_name as fallback when no linked customer record
          const clientLabel = a.guest_name || a.customer_name || "Client inconnu";
          return {
            id: a.id,
            clientName: clientLabel,
            serviceName: service?.name || "Service",
            employeeId: a.employee_id,
            date: a.appointment_date,
            startHour,
            duration: (a.duration_minutes || 60) / 60,
          };
        });
    }
    return localAppointments.filter(apt => apt.date === formattedDateStr);
  }, [appointmentsDb, localAppointments, currentDate, servicesDb, isAuthenticated]);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);

  // ── Client search state (appt form)
  interface ApptClientResult { id: string | null; name: string; phone: string; isGuest: boolean; }
  const [apptClient, setApptClient] = useState<ApptClientResult | null>(null);
  const [apptClientQuery, setApptClientQuery] = useState("");
  const [apptClientResults, setApptClientResults] = useState<ApptClientResult[]>([]);
  const [apptClientLoading, setApptClientLoading] = useState(false);
  const [apptClientDropdown, setApptClientDropdown] = useState(false);
  const apptClientRef = useRef<HTMLDivElement>(null);

  // ── New-client quick-create (inside appt modal)
  const [showNewApptClient, setShowNewApptClient] = useState(false);
  const [newApptClientName, setNewApptClientName] = useState("");
  const [newApptClientPhone, setNewApptClientPhone] = useState("");
  const [newApptClientEmail, setNewApptClientEmail] = useState("");
  const [newApptClientSaving, setNewApptClientSaving] = useState(false);

  // Form Fields
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [startTime, setStartTime] = useState("9"); // decimal hour as string
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<string[]>([]);

  // ── Client search helpers
  const searchApptClients = useCallback(async (q: string) => {
    if (q.length < 2) { setApptClientResults([]); setApptClientDropdown(false); return; }
    setApptClientLoading(true);
    try {
      const { data } = await supabase
        .from("salon_customers")
        .select("id, first_name, last_name, phone")
        .eq("is_active", true)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6);
      setApptClientResults(
        (data || []).map((r: any) => ({
          id: r.id,
          name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
          phone: r.phone || "",
          isGuest: false,
        }))
      );
      setApptClientDropdown(true);
    } catch {
      setApptClientResults([]);
    } finally {
      setApptClientLoading(false);
    }
  }, []);

  const apptClientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleApptClientQuery = (val: string) => {
    setApptClientQuery(val);
    if (apptClientTimer.current) clearTimeout(apptClientTimer.current);
    apptClientTimer.current = setTimeout(() => searchApptClients(val), 300);
  };

  const pickApptClient = (c: ApptClientResult) => {
    setApptClient(c);
    setApptClientQuery("");
    setApptClientResults([]);
    setApptClientDropdown(false);
  };

  const clearApptClient = () => { setApptClient(null); setApptClientQuery(""); };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (apptClientRef.current && !apptClientRef.current.contains(e.target as Node))
        setApptClientDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const saveNewApptClient = async () => {
    if (!newApptClientName.trim() || !newApptClientPhone.trim()) {
      toast.error("Nom et téléphone requis");
      return;
    }
    if (!activeBranchId) { toast.error("Aucune branche sélectionnée"); return; }
    setNewApptClientSaving(true);
    try {
      const parts = newApptClientName.trim().split(" ");
      const { data, error } = await supabase
        .from("salon_customers")
        .insert([{
          branch_id: activeBranchId,
          first_name: parts[0],
          last_name: parts.slice(1).join(" ") || null,
          phone: newApptClientPhone.trim(),
          email: newApptClientEmail.trim() || null,
        }])
        .select("id, first_name, last_name, phone")
        .single();
      if (error) throw error;
      pickApptClient({
        id: data.id,
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        phone: data.phone || "",
        isGuest: false,
      });
      setShowNewApptClient(false);
      setNewApptClientName(""); setNewApptClientPhone(""); setNewApptClientEmail("");
      toast.success("Client créé et sélectionné");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setNewApptClientSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
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

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId || !selectedEmpId || !startTime) {
      toast.error("Veuillez remplir les champs Service, Employé et Heure.");
      return;
    }

    const service = services.find((s: any) => s.id === selectedServiceId);
    if (!service) return;

    const startHourNum = parseFloat(startTime);
    const durationHours = service.duration / 60;
    const selectedOptions = (service.addon_options || []).filter((option: any) => selectedServiceOptions.includes(option.name));

    // Determine client label for display & conflict check
    const clientLabel = apptClient?.name || "Client sans nom";
    const clientId = apptClient?.isGuest ? null : (apptClient?.id ?? null);
    const guestName = apptClient?.isGuest ? apptClient.name : null;

    // Check for double-bookings
    const isConflict = appointments.some((apt: any) => {
      if (apt.employeeId !== selectedEmpId) return false;
      const aptEnd = apt.startHour + apt.duration;
      const bookingEnd = startHourNum + durationHours;
      return (
        (startHourNum >= apt.startHour && startHourNum < aptEnd) ||
        (bookingEnd > apt.startHour && bookingEnd <= aptEnd) ||
        (startHourNum <= apt.startHour && bookingEnd >= aptEnd)
      );
    });

    if (isConflict) {
      toast.error("Cet employé a déjà une prestation planifiée sur ce créneau horaire.");
      return;
    }

    if (isAuthenticated && activeBranchId) {
      const hh = Math.floor(startHourNum).toString().padStart(2, "0");
      const mm = Math.round((startHourNum - Math.floor(startHourNum)) * 60).toString().padStart(2, "0");
      try {
        const { error } = await supabase.from("salon_appointments").insert([{
          branch_id: activeBranchId,
          customer_id: clientId,
          guest_name: guestName,
          service_id: selectedServiceId,
          employee_id: selectedEmpId || null,
          appointment_date: bookingDate,
          appointment_time: `${hh}:${mm}`,
          duration_minutes: service.duration,
          status: "pending",
          notes: selectedOptions.map((o: any) => o.name).join(", ") || null,
        }]);
        if (error) throw error;
        toast.success(`Le rendez-vous pour ${clientLabel} a été réservé !`);
        setIsOpen(false);
        setCurrentDate(new Date(bookingDate));
        resetForm();
        const aptRes = await supabase.from("salon_appointments").select("*").eq("branch_id", activeBranchId).order("appointment_date");
        if (!aptRes.error) setAppointmentsDb(aptRes.data || []);
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      glowupStore.addAppointment({
        clientName: clientLabel,
        serviceName: service.name,
        employeeId: selectedEmpId,
        date: bookingDate,
        startHour: startHourNum,
        duration: durationHours,
      });
      toast.success(`Le rendez-vous pour ${clientLabel} a été réservé (Local) !`);
      setIsOpen(false);
      setCurrentDate(new Date(bookingDate));
      resetForm();
    }
  };

  const resetForm = () => {
    setApptClient(null);
    setApptClientQuery("");
    setApptClientResults([]);
    setApptClientDropdown(false);
    setSelectedServiceId("");
    setSelectedEmpId("");
    setStartTime("9");
    setBookingDate(new Date().toISOString().split("T")[0]);
    setSelectedServiceOptions([]);
  };

  const formatHourString = (decHour: number) => {
    const hoursPart = Math.floor(decHour);
    const minutesPart = Math.round((decHour - hoursPart) * 60);
    return `${hoursPart.toString().padStart(2, "0")}:${minutesPart.toString().padStart(2, "0")}`;
  };

  if ((isAuthenticated && branchesFetching) || (isAuthenticated && !activeBranchId)) {
    return (
      <DashboardLayout role="salon_admin" title="Agenda" subtitle="Initialisation du salon...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card/95 p-8 text-center shadow-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">L’agenda se prépare</h2>
            <p className="text-muted-foreground">
              La branche principale est en cours de création. Dès qu’elle est disponible, vous pourrez enregistrer des rendez-vous et des clients sans sélection manuelle.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="salon_admin"
      title="Agenda"
      subtitle="Gérez vos rendez-vous"
      userName="Marie Laurent"
    >
      <StaggerContainer className="space-y-6">
        {/* Header */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-lg font-semibold capitalize font-display">{formatDate(currentDate)}</h2>
              <Button variant="ghost" size="sm" onClick={goToToday} className="hover:bg-muted/80">
                Aujourd'hui
              </Button>
            </div>
            <Button variant="hero" onClick={() => { resetForm(); setIsOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau RDV
            </Button>
          </div>
        </StaggerItem>

        {/* Legend */}
        <StaggerItem>
          <div className="flex flex-wrap items-center gap-4">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", emp.color)} />
                <span className="text-sm text-muted-foreground">{emp.name}</span>
              </div>
            ))}
          </div>
        </StaggerItem>

        {/* Calendar Grid */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Employee Headers */}
              <div
                className="grid border-b border-border"
                style={{ gridTemplateColumns: `80px repeat(${employees.length || 1}, 1fr)` }}
              >
                <div className="p-4 bg-muted/30 border-r border-border flex items-center justify-center">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                {employees.map((emp) => (
                  <div key={emp.id} className="p-4 text-center border-r border-border last:border-r-0 bg-muted/30">
                    <div className={cn("w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-primary-foreground font-bold", emp.color)}>
                      {emp.name.charAt(0)}
                    </div>
                    <span className="font-medium text-sm">{emp.name}</span>
                  </div>
                ))}
                {employees.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm">Veuillez créer des employés actifs.</div>
                )}
              </div>

              {/* Time Slots grid overlay */}
              <div className="relative">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="grid border-b border-border last:border-b-0"
                    style={{ gridTemplateColumns: `80px repeat(${employees.length || 1}, 1fr)`, height: "80px" }}
                  >
                    <div className="p-2 border-r border-border flex items-start justify-center text-xs text-muted-foreground font-semibold">
                      {hour}:00
                    </div>
                    {employees.map((emp) => (
                      <div key={emp.id} className="border-r border-border last:border-r-0 relative" />
                    ))}
                  </div>
                ))}

                {/* Appointments Overlay */}
                {employees.length > 0 && appointments.map((apt) => {
                  const empIndex = employees.findIndex(e => e.id === apt.employeeId);
                  const employee = employees[empIndex];
                  if (!employee) return null;

                  const top = (apt.startHour - 8) * 80;
                  const height = apt.duration * 80;
                  
                  // Compute dynamic widths and offsets depending on current active employees
                  const colPercentage = 100 / employees.length;
                  const left = `calc(80px + ${empIndex * colPercentage}% + 4px)`;
                  const width = `calc(${colPercentage}% - 8px)`;

                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "absolute rounded-lg p-2.5 text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex flex-col justify-between shadow-sm",
                        employee.color
                      )}
                      style={{ top: `${top}px`, height: `${height}px`, left, width }}
                      onClick={() => {
                        if (confirm(`Voulez-vous supprimer ce rendez-vous pour ${apt.clientName} ?`)) {
                          glowupStore.deleteAppointment(apt.id);
                          toast.success("Rendez-vous annulé.");
                        }
                      }}
                      title="Cliquez pour supprimer le rendez-vous"
                    >
                      <div>
                        <p className="font-semibold text-xs sm:text-sm truncate leading-tight">{apt.clientName}</p>
                        <p className="text-[10px] sm:text-xs opacity-90 truncate mt-0.5 leading-tight">{apt.serviceName}</p>
                      </div>
                      <span className="text-[9px] opacity-75 font-medium flex items-center gap-0.5 mt-1 self-start bg-black/15 px-1.5 py-0.5 rounded">
                        <Clock className="h-2.5 w-2.5" />
                        {formatHourString(apt.startHour)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* BOOK APPOINTMENT MODAL DIALOG */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-display">Planifier un Rendez-vous</DialogTitle>
            <DialogDescription>
              Créez un rendez-vous dans le calendrier en renseignant les détails ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBooking} className="space-y-4 py-2">
            
            {/* ── Client (optionnel) ── */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Client
                <span className="text-muted-foreground font-normal text-xs">(optionnel)</span>
              </Label>

              {apptClient ? (
                /* Selected state */
                <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                    {apptClient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{apptClient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {apptClient.isGuest ? "Client occasionnel" : apptClient.phone || ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearApptClient}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                    title="Désélectionner"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                /* Search state */
                <div className="relative" ref={apptClientRef}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        id="booking-client"
                        type="text"
                        value={apptClientQuery}
                        onChange={e => handleApptClientQuery(e.target.value)}
                        onFocus={() => apptClientQuery.length >= 2 && setApptClientDropdown(true)}
                        placeholder="Rechercher ou saisir un nom..."
                        className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {apptClientLoading && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNewApptClientName(""); setNewApptClientPhone(""); setNewApptClientEmail(""); setShowNewApptClient(true); }}
                      className="flex items-center gap-1 px-2.5 h-9 text-xs font-medium rounded-md border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" /> Nouveau
                    </button>
                  </div>

                  {/* Dropdown */}
                  {apptClientDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                      {apptClientResults.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground text-center">Aucun client trouvé</p>
                      )}
                      {apptClientResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickApptClient(c)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                            {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                          </div>
                        </button>
                      ))}
                      {/* Always show free-text option */}
                      {apptClientQuery.trim().length >= 2 && (
                        <button
                          type="button"
                          onClick={() => pickApptClient({ id: null, name: apptClientQuery.trim(), phone: "", isGuest: true })}
                          className="w-full flex items-center gap-2.5 px-3 py-2 border-t border-border hover:bg-muted/50 transition-colors text-left text-muted-foreground"
                        >
                          <Pen className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="text-xs">
                            Utiliser <strong className="text-foreground">&ldquo;{apptClientQuery.trim()}&rdquo;</strong> comme nom de client
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service Selection */}
            <div className="space-y-2">
              <Label htmlFor="booking-service">Service *</Label>
              <Select
                value={selectedServiceId}
                onValueChange={(value) => {
                  setSelectedServiceId(value);
                  setSelectedServiceOptions([]);
                }}
              >
                <SelectTrigger id="booking-service">
                  <SelectValue placeholder="Sélectionner la prestation" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="flex items-center gap-2">
                          <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">
                          ({format(s.price)}{(s.addon_options?.length || 0) > 0 ? " • options" : ""})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {services.find((s: any) => s.id === selectedServiceId)?.addon_options?.length > 0 && (
              <div className="space-y-2">
                <Label>Options supplémentaires</Label>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {services.find((s: any) => s.id === selectedServiceId)?.addon_options?.map((option: any) => (
                    <label key={option.name} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedServiceOptions.includes(option.name)}
                          onChange={(e) => {
                            setSelectedServiceOptions((prev) =>
                              e.target.checked ? [...prev, option.name] : prev.filter((item) => item !== option.name)
                            );
                          }}
                        />
                        <span>{option.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        +{format(Number(option.extra_cost || 0))}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Employee Selection */}
            <div className="space-y-2">
              <Label htmlFor="booking-employee">Employé *</Label>
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger id="booking-employee">
                  <SelectValue placeholder="Attribuer à un praticien" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", e.color)} />
                        <span>{e.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label htmlFor="booking-date">Date du rendez-vous *</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="booking-date"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Time Slot Selection */}
            <div className="space-y-2">
              <Label htmlFor="booking-time">Heure de début *</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="booking-time">
                  <SelectValue placeholder="Choisir une heure" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">08:00</SelectItem>
                  <SelectItem value="8.5">08:30</SelectItem>
                  <SelectItem value="9">09:00</SelectItem>
                  <SelectItem value="9.5">09:30</SelectItem>
                  <SelectItem value="10">10:00</SelectItem>
                  <SelectItem value="10.5">10:30</SelectItem>
                  <SelectItem value="11">11:00</SelectItem>
                  <SelectItem value="11.5">11:30</SelectItem>
                  <SelectItem value="12">12:00</SelectItem>
                  <SelectItem value="12.5">12:30</SelectItem>
                  <SelectItem value="13">13:00</SelectItem>
                  <SelectItem value="13.5">13:30</SelectItem>
                  <SelectItem value="14">14:00</SelectItem>
                  <SelectItem value="14.5">14:30</SelectItem>
                  <SelectItem value="15">15:00</SelectItem>
                  <SelectItem value="15.5">15:30</SelectItem>
                  <SelectItem value="16">16:00</SelectItem>
                  <SelectItem value="16.5">16:30</SelectItem>
                  <SelectItem value="17">17:00</SelectItem>
                  <SelectItem value="17.5">17:30</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit" variant="hero">Valider le RDV</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Nouveau client depuis le formulaire RDV ── */}
      <Dialog open={showNewApptClient} onOpenChange={setShowNewApptClient}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Créez une fiche client et sélectionnez-la pour ce rendez-vous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nac-name">Nom complet *</Label>
              <Input id="nac-name" placeholder="Ex : Jean Martin" value={newApptClientName} onChange={e => setNewApptClientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nac-phone">Téléphone *</Label>
              <Input id="nac-phone" placeholder="Ex : +509 34 56 78 90" value={newApptClientPhone} onChange={e => setNewApptClientPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nac-email">Email <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input id="nac-email" type="email" placeholder="jean@example.com" value={newApptClientEmail} onChange={e => setNewApptClientEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewApptClient(false)}>Annuler</Button>
            <Button onClick={saveNewApptClient} disabled={newApptClientSaving}>
              {newApptClientSaving ? "Enregistrement..." : "Créer et sélectionner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
