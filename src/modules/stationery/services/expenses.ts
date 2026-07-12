import { supabase } from "@/lib/supabase";

export interface StationeryExpense {
  id: string;
  business_id: string;
  branch_id: string | null;
  expense_date: string;
  category: string;
  amount: number;
  description: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  created_at: string;
}

export async function listExpenses(businessId: string, branchId: string | null) {
  let query = supabase
    .from("stationery_expenses")
    .select("*")
    .eq("business_id", businessId)
    .order("expense_date", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as StationeryExpense[];
}

export async function createExpense(businessId: string, branchId: string | null, payload: any) {
  const { data, error } = await supabase
    .from("stationery_expenses")
    .insert({
      business_id: businessId,
      branch_id: branchId || null,
      expense_date: payload.expense_date,
      category: payload.category,
      amount: payload.amount,
      description: payload.description,
      payment_method: payload.payment_method
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExpense(id: string, businessId: string, payload: any) {
  const { data, error } = await supabase
    .from("stationery_expenses")
    .update({
      expense_date: payload.expense_date,
      category: payload.category,
      amount: payload.amount,
      description: payload.description,
      payment_method: payload.payment_method
    })
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string, businessId: string) {
  const { error } = await supabase
    .from("stationery_expenses")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) throw error;
}
