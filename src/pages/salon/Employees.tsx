import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Mail, UserCog, Shield, Scissors, Coins, Star, DollarSign } from "lucide-react";
import { glowupStore, Employee, Service } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { usePermissions, hasPermission, EmployeeRole } from "@/lib/permissions";
import { CommissionRules } from "@/components/modules/salon/commissions/CommissionRules";
import { CommissionHistory } from "@/components/modules/salon/commissions/CommissionHistory";
import { useBusinessSubscription } from "@/hooks/useBusinessSubscription";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { UpgradePrompt } from "@/components/shared/UpgradePrompt";
import { isUnlimited } from "@/lib/saas";
import { useActiveBranchId } from "@/lib/branch";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { DEFAULT_PLATFORM_TIME_ZONE, getDateKeyInTimeZone } from "@/lib/timezone-date";

// Types
interface EmployeeForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  role: EmployeeRole;
  permissions: {
    canAccessPOS: boolean;
    canManageInventory: boolean;
    canViewReports: boolean;
    canManageAppointments: boolean;
  };
  commissionRate?: number;
  services: string[];
}

const ROLE_OPTIONS: { value: EmployeeRole; label: string; icon: React.ComponentType<{className?: string}>; desc: string }[] = [
 { value: "cashier", label: "Caissier(ère)", icon: Coins, desc: "Accès caisse POS et ventes uniquement" },
  { value: "barber", label: "Barbier / Coiffeur", icon: Scissors, desc: "Gestion des rendez-vous et prestations" },
  { value: "manager", label: "Responsable", icon: Star, desc: "Accès complet sauf facturation" },
];

const COLORS = [
  { value: "bg-primary", label: "Pêche / Champagne", color: "#f97316" },
  { value: "bg-info", label: "Bleu Moderne", color: "#3b82f6" },
  { value: "bg-success", label: "Vert Émeraude", color: "#10b981" },
  { value: "bg-warning", label: "Or / Miel", color: "#f59e0b" },
];

export default function EmployeesPage() {
  const { t } = useTranslation();
  const { isAuthenticated, profile } = useAuth();
  const perms = usePermissions("salon_admin");
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [] } = useBusinessBranches();
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);
  const businessId = profile?.business_id ?? null;

  const [localEmployees, setLocalEmployees] = useState(glowupStore.getEmployees());
  const [localServices, setLocalServices] = useState(glowupStore.getServices());
  const [remoteEmployees, setRemoteEmployees] = useState<any[]>([]);
  const [remoteServices, setRemoteServices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteLoading, setRemoteLoading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setLocalEmployees(glowupStore.getEmployees());
      setLocalServices(glowupStore.getServices());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, []);

  useEffect(() => {
    const loadRemoteData = async () => {
      if (!isAuthenticated || !activeBranchId) {
        setRemoteEmployees([]);
        setRemoteServices([]);
        return;
      }

      setRemoteLoading(true);
      try {
        const [employeeRes, servicesRes] = await Promise.all([
          supabase
            .from("salon_employees")
            .select("id, first_name, last_name, email, phone, role, commission_percentage, is_active, metadata")
            .eq("branch_id", activeBranchId)
            .order("first_name"),
          supabase
            .from("salon_services")
            .select("id, name, commission_percentage, is_active, branch_id")
            .eq("branch_id", activeBranchId)
            .eq("is_active", true)
            .order("name"),
        ]);

        if (employeeRes.error) throw employeeRes.error;
        if (servicesRes.error) throw servicesRes.error;

        setRemoteEmployees(employeeRes.data || []);
        setRemoteServices(servicesRes.data || []);
      } catch (err) {
        console.error("Erreur chargement employés:", err);
        setRemoteEmployees([]);
        setRemoteServices([]);
      } finally {
        setRemoteLoading(false);
      }
    };

    void loadRemoteData();
  }, [activeBranchId, isAuthenticated]);

  const employees = useMemo(() => {
    const base = remoteEmployees.length
      ? remoteEmployees.map((e: any) => ({
          id: e.id,
          name: `${e.first_name || ""} ${e.last_name || ""}`.trim() || "Employé",
          email: e.email || "",
          phone: e.phone || "",
          role: (e.role === "receptionist" ? "cashier" : e.role) || "cashier",
          services: Array.isArray(e.metadata?.services) ? e.metadata.services : [],
          color: e.metadata?.color || "bg-primary",
          status: e.is_active ? "active" : "inactive",
          commission_rate: e.commission_percentage || 0,
          permissions: e.metadata?.permissions || {
            canAccessPOS: true,
            canManageInventory: false,
            canViewReports: false,
            canManageAppointments: false,
          },
        }))
      : localEmployees;
    return base.filter((e: any) => 
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [remoteEmployees, localEmployees, searchTerm]);

  const services = useMemo(() => {
    return remoteServices.length ? remoteServices : localServices;
  }, [remoteServices, localServices]);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState<EmployeeForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "cashier",
    permissions: {
      canAccessPOS: true,
      canManageInventory: false,
      canViewReports: false,
      canManageAppointments: false,
    },
    commissionRate: 40,
    services: [],
  });
  const [color, setColor] = useState("bg-primary");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [commissionsEmp, setCommissionsEmp] = useState<{ id: string; name: string } | null>(null);
  const [showCommissions, setShowCommissions] = useState(false);
  const subscription = useBusinessSubscription();
  const subscriptionState = subscription.data;

  const handleInputChange = (field: keyof EmployeeForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'username' && typeof value === 'string') {
      checkUsername(value);
    }
  };

  const checkUsername = useMemo(
    () => {
      let timer: any;
      return (val: string) => {
        if (!val || val.length < 3) {
          setUsernameAvailable(null);
          return;
        }
        setCheckingUsername(true);
        clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!activeBranchId) return;
          const { count } = await supabase
            .from("salon_employees")
            .select("id", { count: "exact", head: true })
            .eq("username", val)
            .eq("branch_id", activeBranchId);
          setUsernameAvailable(count === 0);
          setCheckingUsername(false);
        }, 500);
      };
    },
    [activeBranchId]
  );

  const handlePermissionToggle = (perm: keyof EmployeeForm['permissions']) => {
    setFormData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [perm]: !prev.permissions[perm] }
    }));
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter(id => id !== serviceId)
        : [...prev.services, serviceId]
    }));
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "cashier",
      permissions: {
        canAccessPOS: true,
        canManageInventory: false,
        canViewReports: false,
        canManageAppointments: false,
      },
      commissionRate: 40,
      services: [],
    });
    setColor("bg-primary");
    setStatus("active");
    setSelectedEmployee(null);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) {
      toast.error("Veuillez renseigner le nom et prénom de l'employé.");
      return;
    }
    if (isAuthenticated && !formData.email) {
      toast.error("L'email est requis pour créer un compte employé.");
      return;
    }
    const needsAuth = formData.role === "cashier" || formData.role === "manager";
    if (needsAuth && (!formData.username || formData.username.length < 3)) {
      toast.error(`Le nom d'utilisateur est requis (min 3 car.) pour le rôle ${ROLE_OPTIONS.find(r=>r.value===formData.role)?.label}.`);
      return;
    }
    if (formData.username && usernameAvailable === false) {
      toast.error("Ce nom d'utilisateur est déjà pris.");
      return;
    }
    if (formData.password && formData.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    const fullName = `${formData.firstName} ${formData.lastName}`;

    if (isAuthenticated) {
      try {
        if (!activeBranchId || !businessId) {
          toast.error("Sélectionnez d'abord une branche valide.");
          return;
        }
        setIsCreatingAccount(true);
        const dbRole = formData.role === "cashier" ? "receptionist" : formData.role;
        
        // 1. Create employee record
        const { data: employeeRow, error: employeeError } = await supabase
          .from("salon_employees")
          .insert([{
            branch_id: activeBranchId,
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            username: formData.username?.trim() || null,
            role: dbRole,
            commission_percentage: formData.commissionRate,
            metadata: {
              color,
              status,
              services: formData.services,
              permissions: formData.permissions,
            },
          }])
          .select("id, branch_id")
          .single();

        if (employeeError || !employeeRow?.id) {
          throw new Error(employeeError?.message || "Création employé impossible");
        }

        // 2. Create commission record
        if (formData.commissionRate !== undefined) {
          await supabase.from("employee_commissions").insert([{
            employee_id: employeeRow.id,
            business_id: businessId,
            global_rate: Math.max(0, Math.min(100, formData.commissionRate)),
            period_start: getDateKeyInTimeZone(new Date(), DEFAULT_PLATFORM_TIME_ZONE),
            period_end: getDateKeyInTimeZone(new Date(), DEFAULT_PLATFORM_TIME_ZONE),
          }]);
        }

        // 3. Set local app password (RPC)
        if (formData.password) {
          await supabase.rpc('set_employee_password', {
            p_employee_id: employeeRow.id,
            p_password: formData.password
          });
        }

        toast.success(`L'employé "${fullName}" a été créé avec succès !`);
        setIsAddOpen(false);
        resetForm();
      } catch (err: any) {
        const message = err instanceof Error ? err.message : "Erreur de création employé";
        toast.error(message);
      } finally {
        setIsCreatingAccount(false);
      }
    } else {
      // Local mode
      glowupStore.addEmployee({
        id: crypto.randomUUID(),
        name: fullName,
        email: formData.email,
        role: formData.role,
        color,
        status,
        services: formData.services,
      });
      toast.success(`L'employé "${fullName}" a été ajouté (mode local) !`);
      setIsAddOpen(false);
      resetForm();
    }
  };

  const handleEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !formData.firstName) return;

    const fullName = `${formData.firstName} ${formData.lastName}`;

    if (isAuthenticated && selectedEmployee.id?.includes('-')) {
      (async () => {
        try {
          const dbRole = formData.role === "cashier" ? "receptionist" : formData.role;
          const { error } = await supabase
            .from("salon_employees")
            .update({
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              phone: formData.phone,
              username: formData.username?.trim() || null,
              role: dbRole,
              commission_percentage: formData.commissionRate,
              is_active: status === "active",
              metadata: {
                color,
                status,
                services: formData.services,
                permissions: formData.permissions,
              },
            })
            .eq("id", selectedEmployee.id);

          if (error) throw error;

          // Set local app password (RPC) if provided during edit
          if (formData.password) {
            await supabase.rpc('set_employee_password', {
              p_employee_id: selectedEmployee.id,
              p_password: formData.password
            });
          }

          toast.success(`Les détails de "${fullName}" ont été mis à jour.`);
          setIsEditOpen(false);
          resetForm();
        } catch (err: any) {
          toast.error(err.message);
        }
      })();
    } else {
      glowupStore.updateEmployee({
        ...selectedEmployee,
        name: fullName,
        email: formData.email,
        role: formData.role,
        color,
        status,
        services: formData.services,
      });
      toast.success(`Les détails de "${fullName}" ont été mis à jour (local).`);
      setIsEditOpen(false);
      resetForm();
    }
  };

  const handleDeleteEmployee = () => {
    if (!selectedEmployee) return;

    if (isAuthenticated && selectedEmployee.id?.includes('-')) {
      (async () => {
        try {
          const { error } = await supabase
            .from("salon_employees")
            .update({ is_active: false })
            .eq("id", selectedEmployee.id);
          if (error) throw error;
          toast.success(`L'employé "${selectedEmployee.name}" a été retiré.`);
          setIsDeleteOpen(false);
          setSelectedEmployee(null);
        } catch (err: any) {
          toast.error(err.message);
        }
      })();
    } else {
      glowupStore.deleteEmployee(selectedEmployee.id);
      toast.success(`L'employé "${selectedEmployee.name}" a été retiré (local).`);
      setIsDeleteOpen(false);
      setSelectedEmployee(null);
    }
  };

  const openEditModal = (emp: any) => {
    const [firstName, ...lastNameParts] = emp.name?.split(" ") || ["", ""];
    setSelectedEmployee(emp);
    setUsernameAvailable(null);
    setCheckingUsername(false);
    setFormData({
      firstName,
      lastName: lastNameParts.join(" "),
      email: emp.email || "",
      phone: emp.phone || "",
      username: emp.username || "",
      password: "",
      confirmPassword: "",
      role: emp.role || "cashier",
      permissions: emp.permissions || {
        canAccessPOS: true,
        canManageInventory: false,
        canViewReports: false,
        canManageAppointments: false,
      },
      commissionRate: emp.commission_rate || 40,
      services: emp.services || [],
    });
    setColor(emp.color || "bg-primary");
    setStatus(emp.status || "active");
    setIsEditOpen(true);
  };

  const openDeleteModal = (emp: any) => {
    setSelectedEmployee(emp);
    setIsDeleteOpen(true);
  };

  const maxEmployees = subscriptionState?.maxStaff ?? null;
  const planName = subscriptionState?.plan?.name || "Starter";

  const handleOpenAdd = () => {
    if (!isUnlimited(maxEmployees) && employees.length >= (maxEmployees || 0)) {
      toast.error(`Limite de ${maxEmployees} employés atteinte pour le plan ${planName}.`);
      return;
    }
    resetForm();
    setIsAddOpen(true);
  };

  const RoleIcon = ROLE_OPTIONS.find(r => r.value === formData.role)?.icon || UserCog;

  return (
    <DashboardLayout role="salon_admin" title="Gestion des employés" subtitle="Gérez votre équipe et leurs permissions">
      <SubscriptionGuard>
        <StaggerContainer className="space-y-6">
        {!subscription.hasFeature("advanced_reports") && (
          <StaggerItem>
            <UpgradePrompt
              title="Upgrade conseillé"
              message="Les plans supérieurs débloquent plus de staff, analytics avancés et les modules financiers."
            />
          </StaggerItem>
        )}
        
        {/* Header Actions */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Employés</h2>
              <p className="text-muted-foreground">
                {employees.length} membre{employees.length > 1 ? 's' : ''} • Limite: {isUnlimited(maxEmployees) ? "Illimitée" : maxEmployees}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="Rechercher un employé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleOpenAdd} disabled={!perms.canManageEmployees}>
                <Plus className="mr-2 h-4 w-4" /> Nouvel employé
              </Button>
            </div>
          </div>
        </StaggerItem>

        {/* Employees Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((emp: any) => (
              <Card key={emp.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold", emp.color || "bg-primary")}>
                        {emp.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base">{emp.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{emp.email || "Aucun email"}</p>
                      </div>
                    </div>
                    <Badge variant={emp.status === "active" ? "default" : "secondary"} className="text-xs">
                      {emp.status === "active" ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Role Badge */}
                  <div className="flex items-center gap-2">
                    {ROLE_OPTIONS.find(r => r.value === emp.role)?.icon && (
                      <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium capitalize">{emp.role || "cashier"}</span>
                  </div>
                  
                  {/* Services */}
                  {emp.services?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Prestations:</p>
                      <div className="flex flex-wrap gap-1">
                        {emp.services.slice(0, 3).map((svcId: string) => {
                          const svc = services.find((s: any) => s.id === svcId);
                          return svc ? (
                            <Badge key={svcId} variant="outline" className="text-[10px]">
                              {svc.name}
                            </Badge>
                          ) : null;
                        })}
                        {emp.services.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">+{emp.services.length - 3}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Commission */}
                  {emp.commission_rate ? (
                    <p className="text-xs text-muted-foreground">
                      Commission: <span className="font-medium">{emp.commission_rate}%</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aucune commission définie</p>
                  )}
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => openEditModal(emp)}
                      disabled={!perms.canManageEmployees}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Modifier
                    </Button>
                    {isAuthenticated && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => { setCommissionsEmp({ id: emp.id, name: emp.name }); setShowCommissions(true); }}
                      >
                        <DollarSign className="h-3 w-3 mr-1" /> Comm.
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => openDeleteModal(emp)}
                      disabled={!perms.canManageEmployees}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {employees.length === 0 && (
              <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                <UserCog className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucun employé trouvé</p>
                <Button variant="link" onClick={handleOpenAdd} className="mt-2">
                  Ajouter votre premier employé
                </Button>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* ADD EMPLOYEE DIALOG */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" /> Ajouter un employé
              </DialogTitle>
              <DialogDescription>
                Créez un nouveau membre d'équipe avec ses rôles et permissions.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAddEmployee} className="space-y-5 py-2">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input 
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input 
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required 
                  />
                </div>
              </div>
              
              {/* Contact */}
              {isAuthenticated && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email professionnel *</Label>
                    <Input 
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone (optionnel)</Label>
                    <Input 
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                </>
              )}
              
              {/* Accès & connexion */}
              <div className="space-y-4 pt-2 pb-2 border-t border-b">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-medium">Accès & connexion (Espace Employé)</h3>
                </div>
                
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="flex justify-between">
                      Nom d'utilisateur {formData.role !== 'barber' && '*'}
                      {checkingUsername && <span className="text-xs text-muted-foreground animate-pulse">Vérification...</span>}
                      {!checkingUsername && usernameAvailable === true && formData.username && (
                        <span className="text-xs text-success font-medium">Disponible ✅</span>
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <span className="text-xs text-destructive font-medium">Déjà pris ❌</span>
                      )}
                    </Label>
                    <Input 
                      id="username"
                      placeholder="ex: marie_caisse"
                      value={formData.username || ""}
                      onChange={(e) => handleInputChange('username', e.target.value.replace(/\s+/g, ''))}
                    />
                    <p className="text-[11px] text-muted-foreground">Sans espace. Utilisé pour la connexion à la caisse.</p>
                  </div>

                  {formData.username && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe *</Label>
                        <Input 
                          id="password"
                          type="password"
                          value={formData.password || ""}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                        />
                        {formData.password && (
                          <div className="flex gap-1 h-1 mt-1">
                            <div className={cn("h-full flex-1 rounded-l-full transition-all", formData.password.length > 0 ? "bg-destructive" : "bg-muted")} />
                            <div className={cn("h-full flex-1 transition-all", formData.password.length >= 6 ? "bg-warning" : "bg-muted")} />
                            <div className={cn("h-full flex-1 rounded-r-full transition-all", formData.password.length >= 8 && /[A-Z]/.test(formData.password) ? "bg-success" : "bg-muted")} />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmer *</Label>
                        <Input 
                          id="confirmPassword"
                          type="password"
                          value={formData.confirmPassword || ""}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        />
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                          <p className="text-[10px] text-destructive">Les mots de passe ne correspondent pas.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {formData.role === 'barber' && !formData.username && (
                    <div className="bg-muted/50 p-2.5 rounded-md border border-border/50">
                      <p className="text-xs text-muted-foreground">
                        ℹ️ Sans identifiant, cet employé ne pourra pas se connecter à la plateforme.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Role Selection */}
              <div className="space-y-3">
                <Label>Rôle dans l'équipe *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((roleOpt) => {
                    const Icon = roleOpt.icon;
                    return (
                      <button
                        key={roleOpt.value}
                        type="button"
                        onClick={() => handleInputChange('role', roleOpt.value)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-all",
                          formData.role === roleOpt.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 mb-2", formData.role === roleOpt.value ? "text-primary" : "text-muted-foreground")} />
                        <p className="text-sm font-medium">{roleOpt.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{roleOpt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Commission (for barbers) */}
              {formData.role === "barber" && (
                <div className="space-y-2">
                  <Label htmlFor="commission">Taux de commission (%)</Label>
                  <Input 
                    id="commission"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.commissionRate}
                    onChange={(e) => handleInputChange('commissionRate', Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Pourcentage sur les prestations réalisées</p>
                </div>
              )}
              
              {/* Color */}
              <div className="space-y-2">
                <Label>Couleur de l'agenda</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "h-8 px-3 rounded-full text-xs font-medium transition-all border-2",
                        c.value,
                        color === c.value ? "border-foreground scale-105" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c.color }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Status */}
              <div className="space-y-2">
                <Label>Statut de disponibilité</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✅ Actif - Peut être assigné</SelectItem>
                    <SelectItem value="inactive">⏸️ Inactif - Masqué des plannings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Services Assignment */}
              {services.length > 0 && (
                <div className="space-y-2">
                  <Label>Prestations qualifiées</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 border rounded-md">
                    {services.map((svc: any) => (
                      <div key={svc.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`svc-${svc.id}`}
                          checked={formData.services.includes(svc.id)}
                          onCheckedChange={() => handleServiceToggle(svc.id)}
                        />
                        <Label htmlFor={`svc-${svc.id}`} className="text-sm font-normal cursor-pointer">
                          {svc.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isCreatingAccount}>
                  {isCreatingAccount ? "Création..." : "Ajouter l'employé"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT EMPLOYEE DIALOG */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" /> Modifier l'employé
              </DialogTitle>
              <DialogDescription>
                Mettez à jour les informations, l'accès et les permissions de ce membre d'équipe.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditEmployee} className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">Prénom *</Label>
                  <Input
                    id="edit-firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Nom *</Label>
                  <Input
                    id="edit-lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              {isAuthenticated && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email professionnel *</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Téléphone (optionnel)</Label>
                    <Input
                      id="edit-phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-4 pt-2 pb-2 border-t border-b">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-medium">Accès & connexion (Espace Employé)</h3>
                </div>

                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-username" className="flex justify-between">
                      Nom d'utilisateur {formData.role !== "barber" && "*"}
                      {checkingUsername && <span className="text-xs text-muted-foreground animate-pulse">Vérification...</span>}
                      {!checkingUsername && usernameAvailable === true && formData.username && (
                        <span className="text-xs text-success font-medium">Disponible ✅</span>
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <span className="text-xs text-destructive font-medium">Déjà pris ❌</span>
                      )}
                    </Label>
                    <Input
                      id="edit-username"
                      placeholder="ex: marie_caisse"
                      value={formData.username || ""}
                      onChange={(e) => handleInputChange("username", e.target.value.replace(/\s+/g, ""))}
                    />
                    <p className="text-[11px] text-muted-foreground">Sans espace. Utilisé pour la connexion à la caisse.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-password">Nouveau mot de passe</Label>
                      <Input
                        id="edit-password"
                        type="password"
                        value={formData.password || ""}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        placeholder="Laisser vide pour conserver"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-confirmPassword">Confirmer</Label>
                      <Input
                        id="edit-confirmPassword"
                        type="password"
                        value={formData.confirmPassword || ""}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        placeholder="Laisser vide"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Rôle dans l'équipe *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((roleOpt) => {
                    const Icon = roleOpt.icon;
                    return (
                      <button
                        key={roleOpt.value}
                        type="button"
                        onClick={() => handleInputChange("role", roleOpt.value)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-all",
                          formData.role === roleOpt.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 mb-2", formData.role === roleOpt.value ? "text-primary" : "text-muted-foreground")} />
                        <p className="text-sm font-medium">{roleOpt.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{roleOpt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.role === "barber" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-commission">Taux de commission (%)</Label>
                  <Input
                    id="edit-commission"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.commissionRate}
                    onChange={(e) => handleInputChange("commissionRate", Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Pourcentage sur les prestations réalisées</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Couleur de l'agenda</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "h-8 px-3 rounded-full text-xs font-medium transition-all border-2",
                        c.value,
                        color === c.value ? "border-foreground scale-105" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c.color }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Statut de disponibilité</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✅ Actif - Peut être assigné</SelectItem>
                    <SelectItem value="inactive">⏸️ Inactif - Masqué des plannings</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {services.length > 0 && (
                <div className="space-y-2">
                  <Label>Prestations qualifiées</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 border rounded-md">
                    {services.map((svc: any) => (
                      <div key={svc.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-svc-${svc.id}`}
                          checked={formData.services.includes(svc.id)}
                          onCheckedChange={() => handleServiceToggle(svc.id)}
                        />
                        <Label htmlFor={`edit-svc-${svc.id}`} className="text-sm font-normal cursor-pointer">
                          {svc.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit">{t("common.save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE EMPLOYEE DIALOG */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" /> Retirer l'employé
              </DialogTitle>
              <DialogDescription>
                Cette action masque l'employé des sélections actives sans supprimer son historique.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">{selectedEmployee?.name}</p>
                <p className="text-xs text-muted-foreground">{selectedEmployee?.email || "Aucun email"}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Voulez-vous vraiment retirer cet employé ?
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>{t("common.cancel")}</Button>
              <Button variant="destructive" onClick={handleDeleteEmployee}>
                Retirer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Commission History Dialog */}
        <Dialog open={showCommissions} onOpenChange={setShowCommissions}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Commissions — {commissionsEmp?.name}</DialogTitle>
            </DialogHeader>
            {commissionsEmp && profile?.business_id && (
              <Tabs defaultValue="rules" className="w-full">
                <TabsList>
                  <TabsTrigger value="rules">Règles</TabsTrigger>
                  <TabsTrigger value="history">{t("common.history")}</TabsTrigger>
                </TabsList>
                <TabsContent value="rules" className="pt-4">
                  <CommissionRules
                    employeeId={commissionsEmp.id}
                    businessId={profile.business_id}
                    services={services.map((service: any) => ({
                      id: service.id,
                      name: service.name,
                      commission_percentage: service.commission_percentage,
                    }))}
                  />
                </TabsContent>
                <TabsContent value="history" className="pt-4">
                  <CommissionHistory employeeId={commissionsEmp.id} employeeName={commissionsEmp.name} />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
        
      </StaggerContainer>
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
