import { supabase } from "@/lib/supabase";

export type PharmacyStaffRole =
  | "pharmacy_admin"
  | "pharmacy_manager"
  | "pharmacy_cashier"
  | "pharmacy_stock_manager"
  | "pharmacy_accountant";

export interface PharmacyStaffMember {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: PharmacyStaffRole;
  is_active: boolean;
  created_at: string;
}

export const PHARMACY_STAFF_ROLES: { value: PharmacyStaffRole; label: string }[] = [
  { value: "pharmacy_cashier", label: "Caissier(ère)" },
  { value: "pharmacy_manager", label: "Gérant(e)" },
  { value: "pharmacy_stock_manager", label: "Responsable stock" },
  { value: "pharmacy_accountant", label: "Comptable" },
  { value: "pharmacy_admin", label: "Administrateur" },
];

export function pharmacyRoleLabel(role?: string | null): string {
  return PHARMACY_STAFF_ROLES.find((r) => r.value === role)?.label || role || "Employé";
}

export async function listPharmacyStaff(businessId: string): Promise<PharmacyStaffMember[]> {
  const { data, error } = await supabase.rpc("pharmacy_list_staff", {
    p_business_id: businessId,
  });
  if (error) throw error;
  return (data as PharmacyStaffMember[]) || [];
}

/**
 * Liste les employés actifs de la pharmacie pour les affecter à une caisse.
 * Contrairement à `listPharmacyStaff`, cette RPC est accessible à tous les
 * utilisateurs de la pharmacie (caissier, gérant, comptable...).
 */
export async function listPharmacyCashiers(businessId: string): Promise<PharmacyStaffMember[]> {
  const { data, error } = await supabase.rpc("pharmacy_list_cashiers", {
    p_business_id: businessId,
  });
  if (error) throw error;
  return (data as PharmacyStaffMember[]) || [];
}

export async function createPharmacyStaffMember(params: {
  businessId: string;
  fullName: string;
  username: string;
  pin: string;
  role: PharmacyStaffRole;
  email?: string;
}): Promise<{
  success: boolean;
  error?: string;
  user_id?: string;
  username?: string;
  email?: string;
  role?: string;
}> {
  const { data, error } = await supabase.rpc("create_pharmacy_staff_member", {
    p_business_id: params.businessId,
    p_full_name: params.fullName,
    p_username: params.username,
    p_pin: params.pin,
    p_role: params.role,
    p_email: params.email || null,
  });
  if (error) throw error;
  return data as any;
}

export async function updatePharmacyStaffMember(params: {
  userId: string;
  fullName?: string;
  role?: PharmacyStaffRole;
  isActive?: boolean;
  username?: string;
  pin?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("update_pharmacy_staff_member", {
    p_user_id: params.userId,
    p_full_name: params.fullName ?? null,
    p_role: params.role ?? null,
    p_is_active: params.isActive ?? null,
    p_username: params.username ?? null,
    p_pin: params.pin ?? null,
  });
  if (error) throw error;
  return data as any;
}
