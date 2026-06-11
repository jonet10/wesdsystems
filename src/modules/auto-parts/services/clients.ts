import { supabase } from "@/lib/supabase";
import type { AutoPartsClient } from "../types";

export async function listClients(businessId: string) {
  const { data, error } = await supabase.rpc("auto_parts_list_clients", { p_business_id: businessId });
  if (error) throw error;
  return data as AutoPartsClient[];
}

export async function createClient(businessId: string, values: Partial<AutoPartsClient>) {
  const { data, error } = await supabase.from("auto_parts_clients").insert({ ...values, business_id: businessId }).select().single();
  if (error) throw error;
  return data as AutoPartsClient;
}

export async function updateClient(id: string, values: Partial<AutoPartsClient>, businessId?: string) {
  let q = supabase.from("auto_parts_clients").update(values);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function deleteClient(id: string, businessId?: string) {
  let q = supabase.from("auto_parts_clients").delete();
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function searchClients(query: string, businessId?: string) {
  const { data, error } = await supabase.rpc("auto_parts_search_clients", { p_query: query, p_business_id: businessId ?? null });
  if (error) throw error;
  return data;
}
