/**
 * Système de permissions granulaires pour WesdSystems
 * Utilisé avec le hook usePermissions() pour contrôler l'accès UI/API
 */

export type UserRole = "super_admin" | "salon_admin" | "school_admin" | "employee" | "client" | "school_parent";
export type EmployeeRole = "cashier" | "barber" | "manager" | "school_manager" | "school_cashier" | "school_accountant" | "school_teacher";

export interface PermissionSet {
  // Navigation
  canAccessDashboard: boolean;
  canAccessPOS: boolean;
  canAccessAppointments: boolean;
  canAccessInventory: boolean;
  canAccessClients: boolean;
  canAccessEmployees: boolean;
  canAccessSettings: boolean;
  canAccessAnalytics: boolean;
  
  // Actions CRUD
  canCreateSale: boolean;
  canViewSales: boolean;
  canEditSale: boolean;
  canDeleteSale: boolean;
  
  canManageInventory: boolean;
  canManageAppointments: boolean;
  canManageEmployees: boolean;
  canManageSettings: boolean;
  
  // Reports
  canViewReports: boolean;
  canExportData: boolean;
  
  // System
  canInviteUsers: boolean;
  canManageBilling: boolean;
}

export const ROLE_PERMISSIONS: Record<EmployeeRole, PermissionSet> = {
  cashier: {
    canAccessDashboard: true,
    canAccessPOS: true,
    canAccessAppointments: false,
    canAccessInventory: false,
    canAccessClients: true,
    canAccessEmployees: false,
    canAccessSettings: false,
    canAccessAnalytics: false,
    
    canCreateSale: true,
    canViewSales: true,
    canEditSale: false,
    canDeleteSale: false,
    
    canManageInventory: false,
    canManageAppointments: false,
    canManageEmployees: false,
    canManageSettings: false,
    
    canViewReports: false,
    canExportData: false,
    
    canInviteUsers: false,
    canManageBilling: false,
  },
  
  barber: {
    canAccessDashboard: true,
    canAccessPOS: false,
    canAccessAppointments: true,
    canAccessInventory: false,
    canAccessClients: true,
    canAccessEmployees: false,
    canAccessSettings: false,
    canAccessAnalytics: false,
    
    canCreateSale: false,
    canViewSales: false,
    canEditSale: false,
    canDeleteSale: false,
    
    canManageInventory: false,
    canManageAppointments: true,
    canManageEmployees: false,
    canManageSettings: false,
    
    canViewReports: false,
    canExportData: false,
    
    canInviteUsers: false,
    canManageBilling: false,
  },
  
  manager: {
    canAccessDashboard: true,
    canAccessPOS: true,
    canAccessAppointments: true,
    canAccessInventory: true,
    canAccessClients: true,
    canAccessEmployees: true,
    canAccessSettings: true,
    canAccessAnalytics: true,
    
    canCreateSale: true,
    canViewSales: true,
    canEditSale: true,
    canDeleteSale: false,
    
    canManageInventory: true,
    canManageAppointments: true,
    canManageEmployees: true,
    canManageSettings: true,
    
    canViewReports: true,
    canExportData: true,
    
    canInviteUsers: true,
    canManageBilling: false,
  },
  school_manager: {
    canAccessDashboard: true,
    canAccessPOS: true,
    canAccessAppointments: false,
    canAccessInventory: false,
    canAccessClients: true,
    canAccessEmployees: true,
    canAccessSettings: true,
    canAccessAnalytics: true,
    canCreateSale: true,
    canViewSales: true,
    canEditSale: true,
    canDeleteSale: false,
    canManageInventory: false,
    canManageAppointments: false,
    canManageEmployees: true,
    canManageSettings: true,
    canViewReports: true,
    canExportData: true,
    canInviteUsers: true,
    canManageBilling: false,
  },
  
  school_cashier: {
    canAccessDashboard: true,
    canAccessPOS: true,
    canAccessAppointments: false,
    canAccessInventory: false,
    canAccessClients: true,
    canAccessEmployees: false,
    canAccessSettings: false,
    canAccessAnalytics: false,
    canCreateSale: true,
    canViewSales: true,
    canEditSale: false,
    canDeleteSale: false,
    canManageInventory: false,
    canManageAppointments: false,
    canManageEmployees: false,
    canManageSettings: false,
    canViewReports: false,
    canExportData: false,
    canInviteUsers: false,
    canManageBilling: false,
  },
  
  school_accountant: {
    canAccessDashboard: true,
    canAccessPOS: true,
    canAccessAppointments: false,
    canAccessInventory: false,
    canAccessClients: true,
    canAccessEmployees: false,
    canAccessSettings: false,
    canAccessAnalytics: true,
    canCreateSale: true,
    canViewSales: true,
    canEditSale: true,
    canDeleteSale: false,
    canManageInventory: false,
    canManageAppointments: false,
    canManageEmployees: false,
    canManageSettings: false,
    canViewReports: true,
    canExportData: true,
    canInviteUsers: false,
    canManageBilling: false,
  },
  
  school_teacher: {
    canAccessDashboard: true,
    canAccessPOS: false,
    canAccessAppointments: false,
    canAccessInventory: false,
    canAccessClients: true, // students
    canAccessEmployees: false,
    canAccessSettings: false,
    canAccessAnalytics: false,
    canCreateSale: false,
    canViewSales: false,
    canEditSale: false,
    canDeleteSale: false,
    canManageInventory: false,
    canManageAppointments: false,
    canManageEmployees: false,
    canManageSettings: false,
    canViewReports: false,
    canExportData: false,
    canInviteUsers: false,
    canManageBilling: false,
  },
};

export const SALON_ADMIN_PERMISSIONS: PermissionSet = {
  ...ROLE_PERMISSIONS.manager,
  canDeleteSale: true,
  canManageBilling: true,
};

export const SCHOOL_ADMIN_PERMISSIONS: PermissionSet = {
  ...ROLE_PERMISSIONS.school_manager,
  canDeleteSale: true,
  canManageBilling: true,
};

/**
 * Hook utilitaire pour vérifier les permissions
 * @example const { canAccessPOS } = usePermissions(userRole);
 */
export function usePermissions(role: EmployeeRole | "salon_admin" | "school_admin"): PermissionSet {
  if (role === "salon_admin") return SALON_ADMIN_PERMISSIONS;
  if (role === "school_admin") return SCHOOL_ADMIN_PERMISSIONS;
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.cashier;
}

/**
 * Vérifie si un utilisateur a une permission spécifique
 */
export function hasPermission(
  role: EmployeeRole | "salon_admin" | "school_admin",
  permission: keyof PermissionSet
): boolean {
  const perms = role === "salon_admin" 
    ? SALON_ADMIN_PERMISSIONS 
    : role === "school_admin"
    ? SCHOOL_ADMIN_PERMISSIONS
    : ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.cashier;
  return perms[permission];
}