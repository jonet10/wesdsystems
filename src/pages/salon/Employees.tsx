import { useState, useEffect } from "react";
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

const COLORS = [
  { value: "bg-primary", label: "Pêche / Champagne (Primaire)" },
  { value: "bg-info", label: "Bleu Moderne" },
  { value: "bg-success", label: "Vert Émeraude" },
  { value: "bg-warning", label: "Or / Miel" }
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [color, setColor] = useState("bg-primary");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const loadData = () => {
    setEmployees(glowupStore.getEmployees());
    setServices(glowupStore.getServices());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error("Veuillez renseigner le nom de l'employé.");
      return;
    }
    glowupStore.addEmployee({
      name,
      color,
      status,
      services: selectedServices
    });
    toast.success(`L'employé "${name}" a été ajouté avec succès !`);
    setIsAddOpen(false);
    resetForm();
  };

  const handleEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !name) return;

    glowupStore.updateEmployee({
      ...selectedEmployee,
      name,
      color,
      status,
      services: selectedServices
    });
    toast.success(`Les détails de "${name}" ont été mis à jour.`);
    setIsEditOpen(false);
    resetForm();
  };

  const handleDeleteEmployee = () => {
    if (!selectedEmployee) return;
    glowupStore.deleteEmployee(selectedEmployee.id);
    toast.success(`L'employé "${selectedEmployee.name}" a été retiré.`);
    setIsDeleteOpen(false);
    setSelectedEmployee(null);
  };

  const resetForm = () => {
    setName("");
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
            <h2 className="text-xl font-semibold font-display">Liste de l'équipe</h2>
            <Button variant="hero" onClick={() => { resetForm(); setIsAddOpen(true); }}>
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
                <Button type="submit" variant="hero">Ajouter l'employé</Button>
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
