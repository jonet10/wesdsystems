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
  email?: string;
  phone?: string;
  role: string;
  pin_code?: string;
}) {
  const { data, error } = await supabase.from("auto_parts_staff").insert({
    business_id: businessId,
    name: staff.name,
    email: staff.email || null,
    phone: staff.phone || null,
    role: staff.role,
    pin_code: staff.pin_code || null,
  }).select().single();
  if (error) throw error;
  return data as AutoPartsStaff;
}

export async function updateStaff(id: string, staff: {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  pin_code?: string;
  is_active?: boolean;
}) {
  const { error } = await supabase.from("auto_parts_staff").update(staff).eq("id", id);
  if (error) throw error;
}

export async function deleteStaff(id: string) {
  const { error } = await supabase.from("auto_parts_staff").delete().eq("id", id);
  if (error) throw error;
}
