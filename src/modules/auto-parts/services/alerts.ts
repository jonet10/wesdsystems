import { supabase } from "@/lib/supabase";
import type { AutoPartsAlert } from "../types";

export async function listAlerts(businessId: string | null) {
  let query = supabase.from("auto_parts_alerts").select("*");
  if (businessId) query = query.or(`business_id.eq.${businessId},business_id.is.null`);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data as AutoPartsAlert[];
}

export async function markAlertRead(id: string) {
  const { error } = await supabase.from("auto_parts_alerts").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllAlertsRead(businessId: string | null) {
  if (!businessId) return;
  const { error } = await supabase.from("auto_parts_alerts").update({ read: true }).eq("business_id", businessId).eq("read", false);
  if (error) throw error;
}
