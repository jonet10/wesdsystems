export const PERMISSIONS = {
  POS_VIEW: "pos.view",
  POS_SELL: "pos.sell",
  DASHBOARD_VIEW: "dashboard.view",
  SALES_TODAY: "sales.today",
  PRODUCTS_READ: "products.read",
  PRODUCTS_MANAGE: "products.manage",
  CATEGORIES_MANAGE: "categories.manage",
  BRANDS_MANAGE: "brands.manage",
  MODELS_MANAGE: "models.manage",
  COMPATIBILITIES_MANAGE: "compatibilities.manage",
  CLIENTS_READ: "clients.read",
  CLIENTS_MANAGE: "clients.manage",
  SUPPLIERS_READ: "suppliers.read",
  SUPPLIERS_MANAGE: "suppliers.manage",
  PURCHASES_MANAGE: "purchases.manage",
  STOCK_VIEW: "stock.view",
  STOCK_MANAGE: "stock.manage",
  STAFF_READ: "staff.read",
  STAFF_MANAGE: "staff.manage",
  REPORTS_VIEW: "reports.view",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  APPOINTMENTS_VIEW: "appointments.view",
  SERVICES_MANAGE: "services.manage",
  PROMOTIONS_MANAGE: "promotions.manage",
  EXPENSES_MANAGE: "expenses.manage",
  ANALYTICS_VIEW: "analytics.view",
  SCHOOL_STUDENTS_MANAGE: "school.students.manage",
  SCHOOL_PAYMENTS_MANAGE: "school.payments.manage",
  SCHOOL_CLASSES_MANAGE: "school.classes.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type AutoPartsRole = "admin" | "manager" | "cashier";

export type SalonEmployeeRole = "cashier" | "barber" | "manager";

export type BusinessType = "salon" | "pharmacie" | "restaurant" | "bar" | "market" | "boutique" | "auto_parts" | "school_payments";

export const AUTO_PARTS_ROLE_PERMISSIONS: Record<AutoPartsRole, Permission[]> = {
  admin: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_TODAY,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.BRANDS_MANAGE,
    PERMISSIONS.MODELS_MANAGE,
    PERMISSIONS.COMPATIBILITIES_MANAGE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_MANAGE,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.SUPPLIERS_MANAGE,
    PERMISSIONS.PURCHASES_MANAGE,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
  ],
  manager: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_TODAY,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.BRANDS_MANAGE,
    PERMISSIONS.MODELS_MANAGE,
    PERMISSIONS.COMPATIBILITIES_MANAGE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_MANAGE,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.SUPPLIERS_MANAGE,
    PERMISSIONS.PURCHASES_MANAGE,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  cashier: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_TODAY,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_MANAGE,
    PERMISSIONS.STOCK_VIEW,
  ],
};

export const SALON_EMPLOYEE_PERMISSIONS: Record<SalonEmployeeRole, Permission[]> = {
  cashier: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_TODAY,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.REPORTS_VIEW,
  ],
  barber: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.CLIENTS_READ,
  ],
  manager: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_SELL,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_TODAY,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_MANAGE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.SERVICES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.PROMOTIONS_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
  ],
};

export function getSalonEmployeePermissions(role: SalonEmployeeRole): Permission[] {
  return SALON_EMPLOYEE_PERMISSIONS[role] ?? SALON_EMPLOYEE_PERMISSIONS.cashier;
}

export function getAutoPartsPermissions(role: AutoPartsRole): Permission[] {
  return AUTO_PARTS_ROLE_PERMISSIONS[role] ?? AUTO_PARTS_ROLE_PERMISSIONS.cashier;
}

export function hasPermission(
  permissions: Permission[] | undefined | null,
  required: Permission | Permission[]
): boolean {
  if (!permissions || permissions.length === 0) return false;
  const requiredArray = Array.isArray(required) ? required : [required];
  return requiredArray.every((p) => permissions.includes(p));
}

export interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  permission?: Permission;
  badge?: number;
}

export function filterMenuByPermissions(
  items: MenuItem[],
  permissions: Permission[] | undefined | null
): MenuItem[] {
  if (!permissions) return [];
  return items.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(permissions, item.permission);
  });
}
