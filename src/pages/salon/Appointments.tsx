import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Clock, Scissors, Calendar as CalendarIcon, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { glowupStore, Appointment, Employee, Client, Service } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery, useSupabaseInsert } from "@/hooks/useSupabaseQuery";
import { useCurrency } from "@/contexts/CurrencyContext";

const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 to 18:00

export default function AppointmentsPage() {
  const { isAuthenticated } = useAuth();
  const { format, currency } = useCurrency();
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- DUAL MODE DATA ---
  const { data: employeesDb } = useSupabaseQuery<any>(['employees'], 'employees', '*', { enabled: isAuthenticated });
  const { data: clientsDb } = useSupabaseQuery<any>(['clients'], 'clients', '*', { enabled: isAuthenticated });
  const { data: servicesDb } = useSupabaseQuery<any>(['salon_services'], 'salon_services', '*', { enabled: isAuthenticated });
  const { data: appointmentsDb } = useSupabaseQuery<any>(['transactions'], 'transactions', '*', { enabled: isAuthenticated });
  const insertAppointment = useSupabaseInsert<any>('transactions', ['transactions']);

  const [localEmployees, setLocalEmployees] = useState<Employee[]>(glowupStore.getEmployees().filter(e => e.status === "active"));
  const [localClients, setLocalClients] = useState<Client[]>(glowupStore.getClients());
  const [localServices, setLocalServices] = useState<Service[]>(glowupStore.getServices());
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>(glowupStore.getAppointments());

  useEffect(() => {
    const handleUpdate = () => {
      setLocalEmployees(glowupStore.getEmployees().filter(e => e.status === "active"));
      setLocalClients(glowupStore.getClients());
      setLocalServices(glowupStore.getServices());
      setLocalAppointments(glowupStore.getAppointments());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const employees = useMemo(() => {
    if (employeesDb && employeesDb.length > 0) {
      return employeesDb.map((e: any) => ({
        id: e.id, name: e.name, color: e.color || "bg-primary", services: e.services || [], status: e.status || "active"
      })).filter((e: any) => e.status === "active");
    }
    return localEmployees;
  }, [employeesDb, localEmployees]);

  const clients = useMemo(() => {
    if (clientsDb && clientsDb.length > 0) {
      return clientsDb.map((c: any) => ({
        id: c.id,
        name: c.full_name || c.name || "",
        email: c.email || "",
        phone: c.phone_number || c.phone || "",
        lastVisit: "Jamais",
        visits: 0,
        totalSpent: c.total_spent ? format(c.total_spent) : format(0),
      }));
    }
    return localClients.map(c => {
      const rawString = String(c.totalSpent).replace(/[^\d.-]/g, '');
      const amt = parseFloat(rawString);
      return { ...c, totalSpent: format(isNaN(amt) ? 0 : amt) };
    });
  }, [clientsDb, localClients, format]);

  const services = useMemo(() => {
    if (servicesDb && servicesDb.length > 0) {
      return servicesDb.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration_minutes || 60,
        price: Number(s.price_htg || s.price || 0),
        category: s.category || s.category_id || "Standard",
        popular: s.popular || false,
        addon_options: Array.isArray(s.metadata?.addon_options) ? s.metadata.addon_options : [],
      }));
    }
    return localServices;
  }, [servicesDb, localServices]);

  const appointments = useMemo(() => {
    const formattedDateStr = currentDate.toISOString().split("T")[0];
    
    if (appointmentsDb && appointmentsDb.length > 0) {
      return appointmentsDb.map((a: any) => ({
        id: a.id,
        clientName: a.client_id || a.clientName || "Client inconnu",
        serviceName: a.service_id || a.serviceName || "Service",
        employeeId: a.employee_id || a.employeeId,
        date: a.scheduled_at ? a.scheduled_at.split("T")[0] : formattedDateStr,
        startHour: a.startHour || 9,
        duration: a.amount ? 1 : 0.5
      })).filter((apt: any) => apt.date === formattedDateStr);
    }
    return localAppointments.filter(apt => apt.date === formattedDateStr);
  }, [appointmentsDb, localAppointments, currentDate]);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);

  // Form Fields
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [startTime, setStartTime] = useState("9"); // decimal hour as string
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<string[]>([]);

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

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedServiceId || !selectedEmpId || !startTime) {
      toast.error("Veuillez remplir tous les champs requis.");
      return;
    }

    const selectedClient = clients.find((client) => client.id === selectedClientId);
    const service = services.find((s: any) => s.id === selectedServiceId);
    if (!service) return;

    const startHourNum = parseFloat(startTime);
    const durationHours = service.duration / 60;
    const selectedOptions = (service.addon_options || []).filter((option: any) => selectedServiceOptions.includes(option.name));
    const optionsTotal = selectedOptions.reduce((sum: number, option: any) => sum + Number(option.extra_cost || 0), 0);

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

    if (isAuthenticated) {
      insertAppointment.mutate({
        client_id: selectedClientId,
        service_id: service.name,
        employee_id: selectedEmpId,
        scheduled_at: new Date(bookingDate).toISOString(),
        status: "pending",
        amount: Number(service.price || 0) + optionsTotal,
        notes: selectedOptions.map((option: any) => option.name).join(", "),
      }, {
        onSuccess: () => {
          toast.success(`Le rendez-vous pour ${selectedClient?.name || "le client"} a été réservé !`);
          setIsOpen(false);
          setCurrentDate(new Date(bookingDate));
          resetForm();
        },
        onError: (err) => toast.error(err.message)
      });
    } else {
      glowupStore.addAppointment({
        clientName: selectedClient?.name || selectedClientId,
        serviceName: service.name,
        employeeId: selectedEmpId,
        date: bookingDate,
        startHour: startHourNum,
        duration: durationHours,
      });
      toast.success(`Le rendez-vous pour ${selectedClient?.name || "le client"} a été réservé (Local) !`);
      setIsOpen(false);
      setCurrentDate(new Date(bookingDate));
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedClientId("");
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
            
            {/* Client input */}
            <div className="space-y-2">
              <Label htmlFor="booking-client">Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="booking-client">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{c.name} ({c.phone})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {clients.length === 0 && (
                    <SelectItem value="client_none" disabled>Aucun client trouvé</SelectItem>
                  )}
                </SelectContent>
              </Select>
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
    </DashboardLayout>
  );
}
