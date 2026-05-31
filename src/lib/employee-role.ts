export type EmployeeAccessRole = "cashier" | "barber" | "manager";

export function normalizeEmployeeRole(role?: string | null): EmployeeAccessRole | null {
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (normalized === "cashier" || normalized === "receptionist") return "cashier";
  if (normalized === "barber") return "barber";
  if (normalized === "manager") return "manager";
  return null;
}

export function canAccessEmployeePos(role?: string | null): boolean {
  const normalized = normalizeEmployeeRole(role);
  return normalized === "cashier" || normalized === "manager";
}

