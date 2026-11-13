import { supabase } from "@/lib/supabase";
import { getDefaultPermissionsForRole } from "@/config/module-menu-permissions";

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
  gender?: "M" | "F" | string;
  permissions?: string[];
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

const GENDER_STORAGE_KEY_PREFIX = "wesd_pharmacy_staff_gender_";
const PERMISSIONS_STORAGE_KEY_PREFIX = "wesd_pharmacy_staff_permissions_";

export function getStoredStaffGender(businessId: string, userId?: string | null): "M" | "F" {
  if (!businessId || !userId) return "M";
  try {
    const raw = localStorage.getItem(`${GENDER_STORAGE_KEY_PREFIX}${businessId}`);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[userId] === "F" || map[userId] === "M") return map[userId];
    }
  } catch {}
  return "M";
}

export function saveStoredStaffGender(businessId: string, userId: string, gender: "M" | "F") {
  if (!businessId || !userId) return;
  try {
    const key = `${GENDER_STORAGE_KEY_PREFIX}${businessId}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[userId] = gender;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

export function getStoredStaffPermissions(businessId: string, userId?: string | null): string[] | null {
  if (!businessId || !userId) return null;
  try {
    const raw = localStorage.getItem(`${PERMISSIONS_STORAGE_KEY_PREFIX}${businessId}`);
    if (raw) {
      const map = JSON.parse(raw);
      if (Array.isArray(map[userId])) return map[userId];
    }
  } catch {}
  return null;
}

export function saveStoredStaffPermissions(businessId: string, userId: string, permissions: string[]) {
  if (!businessId || !userId) return;
  try {
    const key = `${PERMISSIONS_STORAGE_KEY_PREFIX}${businessId}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[userId] = permissions;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

export function pharmacyRoleLabel(role?: string | null, gender?: string | null): string {
  const isFemale = gender === "F" || gender === "female";
  switch (role) {
    case "pharmacy_cashier":
      return isFemale ? "Caissière" : "Caissier";
    case "pharmacy_manager":
      return isFemale ? "Gérante" : "Gérant";
    case "pharmacy_admin":
      return isFemale ? "Administratrice" : "Administrateur";
    case "pharmacy_stock_manager":
      return isFemale ? "Responsable stock (F)" : "Responsable stock";
    case "pharmacy_accountant":
      return isFemale ? "Comptable (F)" : "Comptable";
    default:
      return PHARMACY_STAFF_ROLES.find((r) => r.value === role)?.label || role || "Employé";
  }
}

export async function listPharmacyStaff(businessId: string): Promise<PharmacyStaffMember[]> {
  const { data, error } = await supabase.rpc("pharmacy_list_staff", {
    p_business_id: businessId,
  });
  if (error) throw error;
  const list = ((data as any[]) || []).map((member) => ({
    ...member,
    gender: member.gender || getStoredStaffGender(businessId, member.id),
    permissions: member.permissions || getStoredStaffPermissions(businessId, member.id) || getDefaultPermissionsForRole("pharmacie", member.role),
  }));
  return list;
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
  const list = ((data as any[]) || []).map((member) => ({
    ...member,
    gender: member.gender || getStoredStaffGender(businessId, member.id),
    permissions: member.permissions || getStoredStaffPermissions(businessId, member.id) || getDefaultPermissionsForRole("pharmacie", member.role),
  }));
  return list;
}

export async function createPharmacyStaffMember(params: {
  businessId: string;
  fullName: string;
  username: string;
  pin: string;
  role: PharmacyStaffRole;
  gender?: "M" | "F";
  permissions?: string[];
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
  const res = data as any;
  if (res?.user_id) {
    if (params.gender) {
      saveStoredStaffGender(params.businessId, res.user_id, params.gender);
    }
    if (params.permissions) {
      saveStoredStaffPermissions(params.businessId, res.user_id, params.permissions);
      // Persist in profiles table directly
      supabase.from("profiles").update({ permissions: params.permissions }).eq("id", res.user_id).catch(() => {});
    }
  }
  return res;
}

export async function updatePharmacyStaffMember(params: {
  userId: string;
  businessId?: string;
  fullName?: string;
  role?: PharmacyStaffRole;
  gender?: "M" | "F";
  permissions?: string[];
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
  if (params.businessId) {
    if (params.gender) {
      saveStoredStaffGender(params.businessId, params.userId, params.gender);
    }
    if (params.permissions) {
      saveStoredStaffPermissions(params.businessId, params.userId, params.permissions);
      supabase.from("profiles").update({ permissions: params.permissions }).eq("id", params.userId).catch(() => {});
    }
  }
  return data as any;
}

export async function deletePharmacyStaffMember(params: {
  userId: string;
  businessId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Try deleting directly from profiles
    const { error: delError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", params.userId)
      .eq("business_id", params.businessId);

    if (!delError) {
      // Clear local storage cache
      try {
        const key = `${PERMISSIONS_STORAGE_KEY_PREFIX}${params.businessId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const map = JSON.parse(raw);
          delete map[params.userId];
          localStorage.setItem(key, JSON.stringify(map));
        }
      } catch {}
      return { success: true };
    }

    // 2. If blocked by foreign key (past sales/registers), deactivate and anonymize
    const dummyDeletedUsername = `supprime_${Date.now().toString().slice(-6)}`;
    const { error: updError } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        username: dummyDeletedUsername,
        role: "deleted",
        role_normalized: "deleted",
      })
      .eq("id", params.userId)
      .eq("business_id", params.businessId);

    if (updError) throw updError;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de suppression" };
  }
}
