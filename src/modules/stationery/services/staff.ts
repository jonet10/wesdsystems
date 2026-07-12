import { supabase } from "@/lib/supabase";

export async function listStaff(businessId: string) {
  // Using generic profiles since Stationery specific staff table is not defined yet,
  // or it relies on global auth.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("business_id", businessId);

  if (error) throw error;
  return (data || []).map((p: any) => ({ ...p, name: p.full_name }));
}
