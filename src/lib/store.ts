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

// Empty defaults for a clean production workspace.
const defaultSalons: Salon[] = [];
const defaultEmployees: Employee[] = [];
const defaultServices: Service[] = [];
const defaultClients: Client[] = [];
const defaultAppointments: Appointment[] = [];

const STORE_SCHEMA_VERSION = "2";
const legacyDemoSalons = [
  "Salon Élégance",
  "BarberShop Paris",
  "Beauty Concept",
  "Coiff & Style",
];
const legacyDemoEmployees = ["Julie", "Marc", "Emma"];
const legacyDemoClients = [
  "Marie Laurent",
  "Sophie Martin",
  "Emma Wilson",
  "Lucas Bernard",
  "Clara Dubois",
  "Thomas Petit",
];

const resetLegacyDemoData = () => {
  const currentVersion = getItemSafe("glowup_store_schema_version");
  if (currentVersion === STORE_SCHEMA_VERSION) return;

  const keysToClear = [
    "glowup_salons",
    "glowup_employees",
    "glowup_services",
    "glowup_clients",
    "glowup_appointments",
    "glowup_store_schema_version",
  ];

  keysToClear.forEach((key) => {
    if (canUseLocalStorage()) {
      localStorage.removeItem(key);
    } else {
      memoryStore.delete(key);
    }
  });

  setItemSafe("glowup_store_schema_version", STORE_SCHEMA_VERSION);
};

const shouldReplaceLegacySeed = (key: string, value: string | null): boolean => {
  if (!value) return true;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;

    if (key === "glowup_salons") {
      return parsed.some((item) => legacyDemoSalons.includes(item?.name));
    }
    if (key === "glowup_employees") {
      return parsed.some((item) => legacyDemoEmployees.includes(item?.name));
    }
    if (key === "glowup_clients") {
      return parsed.some((item) => legacyDemoClients.includes(item?.name));
    }
    if (key === "glowup_appointments") {
      return parsed.some((item) => legacyDemoClients.includes(item?.clientName));
    }
  } catch {
    return true;
  }

  return false;
};

// Helper to trigger store-wide reactivity
const notifyStoreUpdated = () => {
  window.dispatchEvent(new Event("glowup-store-update"));
};

// Initialize Store
const initializeStore = () => {
  resetLegacyDemoData();

  const salonSeed = getItemSafe("glowup_salons");
  if (shouldReplaceLegacySeed("glowup_salons", salonSeed)) {
    setItemSafe("glowup_salons", JSON.stringify(defaultSalons));
  }
  const employeeSeed = getItemSafe("glowup_employees");
  if (shouldReplaceLegacySeed("glowup_employees", employeeSeed)) {
    setItemSafe("glowup_employees", JSON.stringify(defaultEmployees));
  }
  const serviceSeed = getItemSafe("glowup_services");
  if (!serviceSeed) {
    setItemSafe("glowup_services", JSON.stringify(defaultServices));
  }
  const clientSeed = getItemSafe("glowup_clients");
  if (shouldReplaceLegacySeed("glowup_clients", clientSeed)) {
    setItemSafe("glowup_clients", JSON.stringify(defaultClients));
  }
  const appointmentSeed = getItemSafe("glowup_appointments");
  if (shouldReplaceLegacySeed("glowup_appointments", appointmentSeed)) {
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
