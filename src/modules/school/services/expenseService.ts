import { supabase } from "@/lib/supabase";
import type { SchoolExpense } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const expenseService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_expenses")
      .select("*")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false });
    if (error) throw error;
    return data as SchoolExpense[];
  },

  async create(payload: Partial<SchoolExpense>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_expenses")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as SchoolExpense;
  },

  async update(id: string, payload: Partial<SchoolExpense>) {
    const { data, error } = await supabase
      .from("school_expenses")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolExpense;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_expenses")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getStats() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_expenses")
      .select("amount")
      .eq("business_id", businessId);
    if (error) throw error;
    return data.reduce((sum, exp) => sum + Number(exp.amount), 0);
  }
};
