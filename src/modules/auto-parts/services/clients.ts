import { supabase } from "@/lib/supabase";
import type { AutoPartsClient } from "../types";

export async function listClients(businessId?: string | null) {
  if (businessId) {
    const { data, error } = await supabase.rpc("auto_parts_list_clients", { p_business_id: businessId });
    if (error) throw error;
    return data as AutoPartsClient[];
  }
  const { data, error } = await supabase.from("auto_parts_clients").select("*").order("name");
  if (error) throw error;
  return data as AutoPartsClient[];
}

export async function createClient(values: Partial<AutoPartsClient>) {
  const { data, error } = await supabase.from("auto_parts_clients").insert(values).select().single();
  if (error) throw error;
  return data as AutoPartsClient;
}

export async function updateClient(id: string, values: Partial<AutoPartsClient>) {
  const { error } = await supabase.from("auto_parts_clients").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("auto_parts_clients").delete().eq("id", id);
  if (error) throw error;
}

export async function searchClients(query: string) {
  const { data, error } = await supabase.rpc("auto_parts_search_clients", { p_query: query });
  if (error) throw error;
  return data;
}
