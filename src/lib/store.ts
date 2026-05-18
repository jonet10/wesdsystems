// GlowUp Client-Side Storage Engine
// Features LocalStorage persistence and dynamic custom events for cross-page reactive synchronization

const memoryStore = new Map<string, string>();

const canUseLocalStorage = (): boolean => {
  try {
    const testKey = "__wesd_storage_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

const getItemSafe = (key: string): string | null => {
  if (canUseLocalStorage()) {
    return localStorage.getItem(key);
  }
  return memoryStore.get(key) ?? null;
};

const setItemSafe = (key: string, value: string) => {
  if (canUseLocalStorage()) {
    localStorage.setItem(key, value);
    return;
  }
  memoryStore.set(key, value);
};

export interface Salon {
  id: string;
  name: string;
  owner: string;
  plan: "Basic" | "Pro" | "Premium";
  status: "active" | "expiring" | "expired";
  date: string;
}

export interface Employee {
  id: string;
  name: string;
  color: string; // Tailwind background color token e.g., 'bg-primary', 'bg-info', 'bg-success', 'bg-warning'
  services: string[]; // List of service IDs they can perform
  status: "active" | "inactive";
}

export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number; // in Euros
  category: string;
  popular: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastVisit: string;
  visits: number;
  totalSpent: string;
}

export interface Appointment {
  id: string;
  clientName: string;
  serviceName: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // Decimal representing the starting hour (e.g., 9.5 for 9:30)
  duration: number; // Decimal representing duration in hours (e.g., 1.5 for 1h30)
}

// Initial Mock Datasets
const defaultSalons: Salon[] = [
  { id: "1", name: "Salon Élégance", owner: "Marie Laurent", plan: "Pro", status: "active", date: "2024-01-15" },
  { id: "2", name: "BarberShop Paris", owner: "Thomas Dubois", plan: "Premium", status: "active", date: "2024-01-14" },
  { id: "3", name: "Beauty Concept", owner: "Sophie Martin", plan: "Basic", status: "expiring", date: "2024-01-12" },
  { id: "4", name: "Coiff & Style", owner: "Lucas Bernard", plan: "Pro", status: "expired", date: "2024-01-10" },
];

const defaultEmployees: Employee[] = [
  { id: "1", name: "Julie", color: "bg-primary", services: ["1", "3", "5", "6", "7"], status: "active" },
  { id: "2", name: "Marc", color: "bg-info", services: ["1", "2", "5"], status: "active" },
  { id: "3", name: "Emma", color: "bg-success", services: ["2", "3", "4", "8"], status: "active" },
];

const defaultServices: Service[] = [
  { id: "1", name: "Coupe femme", duration: 60, price: 45, category: "Coupe", popular: true },
  { id: "2", name: "Coupe homme", duration: 30, price: 25, category: "Coupe", popular: true },
  { id: "3", name: "Couleur", duration: 90, price: 65, category: "Coloration", popular: true },
  { id: "4", name: "Mèches / Balayage", duration: 120, price: 95, category: "Coloration", popular: false },
  { id: "5", name: "Brushing", duration: 45, price: 30, category: "Coiffage", popular: true },
  { id: "6", name: "Coupe + Couleur", duration: 150, price: 95, category: "Forfait", popular: true },
  { id: "7", name: "Soin capillaire", duration: 45, price: 35, category: "Soins", popular: false },
  { id: "8", name: "Lissage brésilien", duration: 180, price: 180, category: "Soins", popular: false },
];

const defaultClients: Client[] = [
  { id: "1", name: "Marie Laurent", email: "marie.laurent@email.com", phone: "06 12 34 56 78", lastVisit: "15/01/2024", visits: 12, totalSpent: "540€" },
  { id: "2", name: "Sophie Martin", email: "sophie.martin@email.com", phone: "06 23 45 67 89", lastVisit: "14/01/2024", visits: 8, totalSpent: "320€" },
  { id: "3", name: "Emma Wilson", email: "emma.wilson@email.com", phone: "06 34 56 78 90", lastVisit: "12/01/2024", visits: 5, totalSpent: "180€" },
  { id: "4", name: "Lucas Bernard", email: "lucas.bernard@email.com", phone: "06 45 67 89 01", lastVisit: "10/01/2024", visits: 3, totalSpent: "90€" },
  { id: "5", name: "Clara Dubois", email: "clara.dubois@email.com", phone: "06 56 78 90 12", lastVisit: "08/01/2024", visits: 15, totalSpent: "780€" },
  { id: "6", name: "Thomas Petit", email: "thomas.petit@email.com", phone: "06 67 89 01 23", lastVisit: "05/01/2024", visits: 7, totalSpent: "210€" },
];

const defaultAppointments: Appointment[] = [
  { id: "1", clientName: "Marie Laurent", serviceName: "Coupe + Couleur", employeeId: "1", date: new Date().toISOString().split("T")[0], startHour: 9, duration: 2 },
  { id: "2", clientName: "Sophie Martin", serviceName: "Brushing", employeeId: "1", date: new Date().toISOString().split("T")[0], startHour: 11.5, duration: 0.75 },
  { id: "3", clientName: "Emma Wilson", serviceName: "Coupe femme", employeeId: "2", date: new Date().toISOString().split("T")[0], startHour: 10, duration: 1 },
  { id: "4", clientName: "Lucas Bernard", serviceName: "Coupe homme", employeeId: "2", date: new Date().toISOString().split("T")[0], startHour: 14, duration: 0.5 },
  { id: "5", clientName: "Clara Dubois", serviceName: "Soin capillaire", employeeId: "1", date: new Date().toISOString().split("T")[0], startHour: 14, duration: 1.5 },
  { id: "6", clientName: "Thomas Petit", serviceName: "Coupe homme", employeeId: "3", date: new Date().toISOString().split("T")[0], startHour: 9, duration: 0.5 },
  { id: "7", clientName: "Anna Rose", serviceName: "Couleur", employeeId: "3", date: new Date().toISOString().split("T")[0], startHour: 11, duration: 1.5 },
];

// Helper to trigger store-wide reactivity
const notifyStoreUpdated = () => {
  window.dispatchEvent(new Event("glowup-store-update"));
};

// Initialize Store
const initializeStore = () => {
  if (!getItemSafe("glowup_salons")) {
    setItemSafe("glowup_salons", JSON.stringify(defaultSalons));
  }
  if (!getItemSafe("glowup_employees")) {
    setItemSafe("glowup_employees", JSON.stringify(defaultEmployees));
  }
  if (!getItemSafe("glowup_services")) {
    setItemSafe("glowup_services", JSON.stringify(defaultServices));
  }
  if (!getItemSafe("glowup_clients")) {
    setItemSafe("glowup_clients", JSON.stringify(defaultClients));
  }
  if (!getItemSafe("glowup_appointments")) {
    setItemSafe("glowup_appointments", JSON.stringify(defaultAppointments));
  }
};

// Auto-run on load
initializeStore();

export const glowupStore = {
  // --- SALONS ---
  getSalons(): Salon[] {
    initializeStore();
    return JSON.parse(getItemSafe("glowup_salons") || "[]");
  },
  saveSalons(salons: Salon[]) {
    setItemSafe("glowup_salons", JSON.stringify(salons));
    notifyStoreUpdated();
  },
  addSalon(salon: Omit<Salon, "id">) {
    const salons = this.getSalons();
    const newSalon = { ...salon, id: Math.random().toString(36).substr(2, 9) };
    salons.push(newSalon);
    this.saveSalons(salons);
    return newSalon;
  },
  updateSalon(updatedSalon: Salon) {
    const salons = this.getSalons();
    const index = salons.findIndex(s => s.id === updatedSalon.id);
    if (index !== -1) {
      salons[index] = updatedSalon;
      this.saveSalons(salons);
    }
  },
  deleteSalon(id: string) {
    const salons = this.getSalons();
    const filtered = salons.filter(s => s.id !== id);
    this.saveSalons(filtered);
  },

  // --- EMPLOYEES ---
  getEmployees(): Employee[] {
    initializeStore();
    return JSON.parse(getItemSafe("glowup_employees") || "[]");
  },
  saveEmployees(employees: Employee[]) {
    setItemSafe("glowup_employees", JSON.stringify(employees));
    notifyStoreUpdated();
  },
  addEmployee(employee: Omit<Employee, "id">) {
    const employees = this.getEmployees();
    const newEmployee = { ...employee, id: Math.random().toString(36).substr(2, 9) };
    employees.push(newEmployee);
    this.saveEmployees(employees);
    return newEmployee;
  },
  updateEmployee(updatedEmployee: Employee) {
    const employees = this.getEmployees();
    const index = employees.findIndex(e => e.id === updatedEmployee.id);
    if (index !== -1) {
      employees[index] = updatedEmployee;
      this.saveEmployees(employees);
    }
  },
  deleteEmployee(id: string) {
    const employees = this.getEmployees();
    const filtered = employees.filter(e => e.id !== id);
    this.saveEmployees(filtered);
  },

  // --- SERVICES ---
  getServices(): Service[] {
    initializeStore();
    return JSON.parse(getItemSafe("glowup_services") || "[]");
  },
  saveServices(services: Service[]) {
    setItemSafe("glowup_services", JSON.stringify(services));
    notifyStoreUpdated();
  },
  addService(service: Omit<Service, "id">) {
    const services = this.getServices();
    const newService = { ...service, id: Math.random().toString(36).substr(2, 9) };
    services.push(newService);
    this.saveServices(services);
    return newService;
  },
  updateService(updatedService: Service) {
    const services = this.getServices();
    const index = services.findIndex(s => s.id === updatedService.id);
    if (index !== -1) {
      services[index] = updatedService;
      this.saveServices(services);
    }
  },
  deleteService(id: string) {
    const services = this.getServices();
    const filtered = services.filter(s => s.id !== id);
    this.saveServices(filtered);
  },

  // --- CLIENTS ---
  getClients(): Client[] {
    initializeStore();
    return JSON.parse(getItemSafe("glowup_clients") || "[]");
  },
  saveClients(clients: Client[]) {
    setItemSafe("glowup_clients", JSON.stringify(clients));
    notifyStoreUpdated();
  },
  addClient(client: Omit<Client, "id" | "lastVisit" | "visits" | "totalSpent">) {
    const clients = this.getClients();
    const newClient: Client = {
      ...client,
      id: Math.random().toString(36).substr(2, 9),
      lastVisit: "Jamais",
      visits: 0,
      totalSpent: "0€"
    };
    clients.push(newClient);
    this.saveClients(clients);
    return newClient;
  },
  updateClient(updatedClient: Client) {
    const clients = this.getClients();
    const index = clients.findIndex(c => c.id === updatedClient.id);
    if (index !== -1) {
      clients[index] = updatedClient;
      this.saveClients(clients);
    }
  },
  deleteClient(id: string) {
    const clients = this.getClients();
    const filtered = clients.filter(c => c.id !== id);
    this.saveClients(filtered);
  },

  // --- APPOINTMENTS ---
  getAppointments(): Appointment[] {
    initializeStore();
    return JSON.parse(getItemSafe("glowup_appointments") || "[]");
  },
  saveAppointments(appointments: Appointment[]) {
    setItemSafe("glowup_appointments", JSON.stringify(appointments));
    notifyStoreUpdated();
  },
  addAppointment(appointment: Omit<Appointment, "id">) {
    const appointments = this.getAppointments();
    const newAppointment = { ...appointment, id: Math.random().toString(36).substr(2, 9) };
    appointments.push(newAppointment);
    
    // Also update client visits stats contextually!
    const clients = this.getClients();
    const clientIndex = clients.findIndex(c => c.name.toLowerCase() === appointment.clientName.toLowerCase());
    if (clientIndex !== -1) {
      const client = clients[clientIndex];
      client.visits += 1;
      client.lastVisit = appointment.date.split("-").reverse().join("/"); // DD/MM/YYYY
      // Add estimated service price to totalSpent
      const services = this.getServices();
      const service = services.find(s => s.name.toLowerCase() === appointment.serviceName.toLowerCase());
      if (service) {
        const currentSpent = parseInt(client.totalSpent.replace("€", "")) || 0;
        client.totalSpent = `${currentSpent + service.price}€`;
      }
      clients[clientIndex] = client;
      this.saveClients(clients);
    }

    this.saveAppointments(appointments);
    return newAppointment;
  },
  updateAppointment(updatedAppointment: Appointment) {
    const appointments = this.getAppointments();
    const index = appointments.findIndex(a => a.id === updatedAppointment.id);
    if (index !== -1) {
      appointments[index] = updatedAppointment;
      this.saveAppointments(appointments);
    }
  },
  deleteAppointment(id: string) {
    const appointments = this.getAppointments();
    const filtered = appointments.filter(a => a.id !== id);
    this.saveAppointments(filtered);
  },

  // --- MULTI-BUSINESS CONFIG ---
  getActiveBusiness(): "salon" | "pharmacie" | "restaurant" | "market" | "boutique" {
    return (getItemSafe("glowup_active_business") as any) || "salon";
  },
  setActiveBusiness(type: "salon" | "pharmacie" | "restaurant" | "market" | "boutique") {
    setItemSafe("glowup_active_business", type);
    notifyStoreUpdated();
  }
};
