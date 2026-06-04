export type EmployeeAccessRole = "cashier" | "barber" | "manager";

const SERVICE_ROLES = new Set(["barber", "stylist", "nail_technician", "massage_therapist", "esthetician", "makeup_artist"]);

export function normalizeEmployeeRole(role?: string | null): EmployeeAccessRole | null {
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (normalized === "cashier" || normalized === "receptionist") return "cashier";
  if (SERVICE_ROLES.has(normalized)) return "barber";
  if (normalized === "manager") return "manager";
  return null;
}

export function isServiceRole(role?: string | null): boolean {
  if (!role) return false;
  return SERVICE_ROLES.has(role.toLowerCase());
}

export function canAccessEmployeePos(role?: string | null): boolean {
  const normalized = normalizeEmployeeRole(role);
  return normalized === "cashier" || normalized === "manager";
}

