import { supabase } from "@/lib/supabase";
import type { AutoPartsAlert } from "../types";

export async function listAlerts(businessId: string) {
  const { data, error } = await supabase.from("auto_parts_alerts").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data as AutoPartsAlert[];
}

export async function markAlertRead(id: string, businessId?: string) {
  let q = supabase.from("auto_parts_alerts").update({ read: true });
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function markAllAlertsRead(businessId: string | null) {
  if (!businessId) return;
  const { error } = await supabase.from("auto_parts_alerts").update({ read: true }).eq("business_id", businessId).eq("read", false);
  if (error) throw error;
}
