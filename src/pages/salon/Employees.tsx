import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Scissors, Pencil, Trash2, CheckCircle, AlertTriangle, User, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { glowupStore, Employee, Service } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/useSupabaseQuery";

import { supabase } from "@/lib/supabase";

const COLORS = [
  { value: "bg-primary", label: "Pêche / Champagne (Primaire)" },
  { value: "bg-info", label: "Bleu Moderne" },
  { value: "bg-success", label: "Vert Émeraude" },
  { value: "bg-warning", label: "Or / Miel" }
];

export default function EmployeesPage() {
  const { isAuthenticated, user: profile } = useAuth();

  // --- DUAL MODE DATA ---
  const { data: employeesDb } = useSupabaseQuery<any>(['employees'], 'employees', '*', { enabled: isAuthenticated });
  const { data: servicesDb } = useSupabaseQuery<any>(['services'], 'services', '*', { enabled: isAuthenticated });
  const insertEmployee = useSupabaseInsert<any>('employees', ['employees']);
  const updateEmployeeDb = useSupabaseUpdate<any>('employees', ['employees']);
  const deleteEmployeeDb = useSupabaseDelete('employees', ['employees']);

  const [localEmployees, setLocalEmployees] = useState<Employee[]>(glowupStore.getEmployees());
  const [localServices, setLocalServices] = useState<Service[]>(glowupStore.getServices());

  useEffect(() => {
    const handleUpdate = () => {
      setLocalEmployees(glowupStore.getEmployees());
      setLocalServices(glowupStore.getServices());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const employees = useMemo(() => {
    if (employeesDb && employeesDb.length > 0) {
      return employeesDb.map((e: any) => ({
        id: e.id,
        name: e.name,
        color: e.color || "bg-primary",
        services: e.services || [],
        status: e.status || "active"
      }));
    }
    return localEmployees;
  }, [employeesDb, localEmployees]);

  const services = useMemo(() => {
    if (servicesDb && servicesDb.length > 0) {
      return servicesDb.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration || 60,
        price: s.price || 0,
        category: s.category || "Standard",
        popular: s.popular || false
      }));
    }
    return localServices;
  }, [servicesDb, localServices]);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [globalCommission, setGlobalCommission] = useState("40");
  const [color, setColor] = useState("bg-primary");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error("Veuillez renseigner le nom de l'employé.");
      return;
    }
    if (isAuthenticated && (!employeeEmail || !temporaryPassword)) {
      toast.error("Email et mot de passe temporaire sont requis.");
      return;
    }
    
    if (isAuthenticated) {
      try {
        setIsCreatingAccount(true);
        const { data: employeeRow, error: employeeError } = await supabase
          .from("employees")
          .insert([{ name, color, status, services: selectedServices }])
          .select("id, business_id")
          .single();

        if (employeeError || !employeeRow?.id) {
          throw new Error(employeeError?.message || "Création employé impossible");
        }

        const { error: accountError } = await supabase.functions.invoke("create-employee-account", {
          body: {
            employee_id: employeeRow.id,
            business_id: employeeRow.business_id,
            email: employeeEmail.trim().toLowerCase(),
            temporary_password: temporaryPassword,
            role: "employee",
            is_active: status === "active",
          },
        });

        if (accountError) throw new Error(accountError.message);

        const rate = Number(globalCommission);
        if (!Number.isNaN(rate)) {
          await supabase.from("employee_commissions").insert([
            {
              employee_id: employeeRow.id,
              business_id: employeeRow.business_id,
              global_rate: Math.max(0, Math.min(100, rate)),
              period_start: new Date().toISOString().split("T")[0],
              period_end: new Date().toISOString().split("T")[0],
            },
          ]);
        }

        toast.success(`L'employé "${name}" et son compte ont été créés.`);
        setIsAddOpen(false);
        resetForm();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur de création employé";
        toast.error(message);
      } finally {
        setIsCreatingAccount(false);
      }
    } else {
      glowupStore.addEmployee({ name, color, status, services: selectedServices });
      toast.success(`L'employé "${name}" a été ajouté (Local) !`);
      setIsAddOpen(false);
      resetForm();
    }
  };

  const handleEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !name) return;

    if (isAuthenticated && selectedEmployee.id.includes('-')) {
      updateEmployeeDb.mutate({ id: selectedEmployee.id, name, color, status, services: selectedServices }, {
        onSuccess: () => {
          toast.success(`Les détails de "${name}" ont été mis à jour.`);
          setIsEditOpen(false);
          resetForm();
        },
        onError: (err) => toast.error(err.message)
      });
    } else {
      glowupStore.updateEmployee({ ...selectedEmployee, name, color, status, services: selectedServices });
      toast.success(`Les détails de "${name}" ont été mis à jour (Local).`);
      setIsEditOpen(false);
      resetForm();
    }
  };

  const handleDeleteEmployee = () => {
    if (!selectedEmployee) return;

    if (isAuthenticated && selectedEmployee.id.includes('-')) {
      deleteEmployeeDb.mutate(selectedEmployee.id, {
        onSuccess: () => {
          toast.success(`L'employé "${selectedEmployee.name}" a été retiré.`);
          setIsDeleteOpen(false);
          setSelectedEmployee(null);
        },
        onError: (err) => toast.error(err.message)
      });
    } else {
      glowupStore.deleteEmployee(selectedEmployee.id);
      toast.success(`L'employé "${selectedEmployee.name}" a été retiré (Local).`);
      setIsDeleteOpen(false);
      setSelectedEmployee(null);
    }
  };

  const resetForm = () => {
    setName("");
    setEmployeeEmail("");
    setTemporaryPassword("");
    setGlobalCommission("40");
    setColor("bg-primary");
    setStatus("active");
    setSelectedServices([]);
    setSelectedEmployee(null);
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setName(emp.name);
    setColor(emp.color);
    setStatus(emp.status);
    setSelectedServices(emp.services || []);
    setIsEditOpen(true);
  };

  const openDeleteModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsDeleteOpen(true);
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const [maxEmployees, setMaxEmployees] = useState(10);
  const [planName, setPlanName] = useState("STARTER");

  useEffect(() => {
    if (isAuthenticated && profile?.business_id) {
      const fetchPlan = async () => {
        const { data: biz } = await supabase
          .from('businesses')
          .select('plan_id')
          .eq('id', profile.business_id)
          .single();
        if (biz?.plan_id) {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('max_employees, name')
            .eq('id', biz.plan_id)
            .single();
          if (plan) {
            setMaxEmployees(plan.max_employees);
            setPlanName(plan.name);
          }
        }
      };
      fetchPlan();
    }
  }, [isAuthenticated, profile]);

  const handleOpenAdd = () => {
    if (employees.length >= maxEmployees) {
      toast.error(`Vous avez atteint la limite maximale de ${maxEmployees} employés pour votre abonnement actuel (Plan ${planName}).`);
      return;
    }
    resetForm();
    setIsAddOpen(true);
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Employés"
      subtitle="Gérez l'équipe et attribuez les prestations"
      userName="Marie Laurent"
    >
      <StaggerContainer className="space-y-6">
        {/* Actions Bar */}
        <StaggerItem>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">Liste de l'équipe ({employees.length}/{maxEmployees})</h2>
            <Button variant="hero" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel employé
            </Button>
          </div>
        </StaggerItem>

        {/* Employees Cards Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map((emp) => (
              <div key={emp.id} className="bg-card rounded-xl border border-border p-6 hover:shadow-soft transition-all flex flex-col justify-between h-[280px]">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg", emp.color)}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{emp.name}</h3>
                        <span className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          emp.status === "active" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {emp.status === "active" ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Prestations assignées</span>
                    <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto pr-1">
                      {emp.services && emp.services.length > 0 ? (
                        emp.services.map((svcId) => {
                          const svc = services.find(s => s.id === svcId);
                          if (!svc) return null;
                          return (
                            <span key={svcId} className="px-2 py-0.5 bg-muted rounded text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                              <Scissors className="h-3 w-3" />
                              {svc.name}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Aucune prestation</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(emp)} className="h-8">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openDeleteModal(emp)} className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </StaggerItem>

        {/* ADD EMPLOYEE DIALOG */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Ajouter un employé</DialogTitle>
              <DialogDescription>
                Remplissez les détails pour ajouter un membre à votre équipe de coiffure/esthétique.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEmployee} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="add-name">Nom complet *</Label>
                <Input id="add-name" placeholder="Ex: Julie Dubois" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              {isAuthenticated && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="add-email">Email employé *</Label>
                    <Input id="add-email" type="email" placeholder="employe@studio.com" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-temp-password">Mot de passe temporaire *</Label>
                    <Input id="add-temp-password" type="text" placeholder="Temp#2026!" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-global-commission">Commission globale (%)</Label>
                    <Input
                      id="add-global-commission"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={globalCommission}
                      onChange={(e) => setGlobalCommission(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-color">Couleur Agenda</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger id="add-color">
                      <SelectValue placeholder="Choisir une couleur" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", c.value)} />
                            <span>{c.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-status">Statut de disponibilité</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger id="add-status">
                      <SelectValue placeholder="Choisir un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prestations qualifiées</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto border border-border p-3 rounded-lg">
                  {services.map(svc => (
                    <div key={svc.id} className="flex items-center gap-2 space-x-1">
                      <Checkbox
                        id={`add-svc-${svc.id}`}
                        checked={selectedServices.includes(svc.id)}
                        onCheckedChange={() => handleServiceToggle(svc.id)}
                      />
                      <label htmlFor={`add-svc-${svc.id}`} className="text-xs font-medium text-foreground cursor-pointer truncate">
                        {svc.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero" disabled={isCreatingAccount}>
                  {isCreatingAccount ? "Création..." : "Ajouter l'employé"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT EMPLOYEE DIALOG */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Modifier l'employé</DialogTitle>
              <DialogDescription>
                Mettez à jour les compétences ou les paramètres de l'agenda pour cet employé.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditEmployee} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom complet *</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-color">Couleur Agenda</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger id="edit-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", c.value)} />
                            <span>{c.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Statut de disponibilité</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prestations qualifiées</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto border border-border p-3 rounded-lg">
                  {services.map(svc => (
                    <div key={svc.id} className="flex items-center gap-2 space-x-1">
                      <Checkbox
                        id={`edit-svc-${svc.id}`}
                        checked={selectedServices.includes(svc.id)}
                        onCheckedChange={() => handleServiceToggle(svc.id)}
                      />
                      <label htmlFor={`edit-svc-${svc.id}`} className="text-xs font-medium text-foreground cursor-pointer truncate">
                        {svc.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
                <Button type="submit" variant="hero">Enregistrer les modifications</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRM DIALOG */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Retirer l'employé</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir retirer <strong>{selectedEmployee?.name}</strong> de votre effectif ? Ses rendez-vous actuels ne seront pas supprimés, mais il ne pourra plus être assigné à de futurs créneaux.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Annuler</Button>
              <Button type="button" variant="destructive" onClick={handleDeleteEmployee}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
