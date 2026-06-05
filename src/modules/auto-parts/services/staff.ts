import { supabase } from "@/lib/supabase";
import type { AutoPartsStaff } from "../types";

export async function listStaff(businessId: string | null) {
  let query = supabase.from("auto_parts_staff").select("*").eq("is_active", true);
  if (businessId) query = query.eq("business_id", businessId);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return data as AutoPartsStaff[];
}

export async function createStaff(businessId: string, staff: {
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  role: string;
  pin_code?: string;
}) {
  const { data, error } = await supabase.rpc("create_auto_parts_staff", {
    p_business_id: businessId,
    p_name: staff.name,
    p_username: staff.username || null,
    p_email: staff.email || null,
    p_phone: staff.phone || null,
    p_role: staff.role,
    p_pin_code: staff.pin_code || null,
  });
  if (error) throw error;
  return data;
}

export async function updateStaff(id: string, staff: {
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  pin_code?: string;
  is_active?: boolean;
}) {
  const { data, error } = await supabase.rpc("update_auto_parts_staff", {
    p_id: id,
    p_name: staff.name ?? null,
    p_username: staff.username ?? null,
    p_email: staff.email ?? null,
    p_phone: staff.phone ?? null,
    p_role: staff.role ?? null,
    p_pin_code: staff.pin_code ?? null,
    p_is_active: staff.is_active ?? null,
  });
  if (error) throw error;
  return data;
}

export async function deleteStaff(id: string) {
  const { data, error } = await supabase.rpc("delete_auto_parts_staff", { p_id: id });
  if (error) throw error;
  return data;
}
