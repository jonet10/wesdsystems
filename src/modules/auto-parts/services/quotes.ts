import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";

const getBranch = (businessId: string, branchId?: string | null) => branchId ?? getStoredBranchId(businessId) ?? null;

export interface QuoteItem {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface Quote {
  id: string;
  quote_number: string;
  client_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  total: number;
  status: string;
  valid_until?: string | null;
  notes?: string | null;
  terms?: string | null;
  items?: QuoteItem[];
  created_at: string;
  updated_at: string;
}

export async function listQuotes(businessId: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const params: Record<string, any> = { p_business_id: businessId };
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("list_auto_parts_quotes", params);
  if (error) throw error;
  return data as Quote[];
}

export async function getQuote(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("get_auto_parts_quote", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data as Quote;
}

export async function createQuote(
  businessId: string,
  quote: {
    client_id?: string | null;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    total: number;
    valid_until?: string | null;
    notes?: string;
    terms?: string;
    quote_prefix?: string;
    branch_id?: string | null;
    items: QuoteItem[];
  }
) {
  const branch = quote.branch_id ?? getBranch(businessId);
  const params: Record<string, any> = {
    p_business_id: businessId,
    p_client_id: quote.client_id ?? null,
    p_client_name: quote.client_name ?? null,
    p_client_phone: quote.client_phone ?? null,
    p_client_email: quote.client_email ?? null,
    p_subtotal: quote.subtotal,
    p_tax_rate: quote.tax_rate,
    p_tax_amount: quote.tax_amount,
    p_discount_type: quote.discount_type,
    p_discount_value: quote.discount_value,
    p_discount_amount: quote.discount_amount,
    p_total: quote.total,
    p_valid_until: quote.valid_until ?? null,
    p_notes: quote.notes ?? null,
    p_terms: quote.terms ?? null,
    p_quote_prefix: quote.quote_prefix ?? "DEV-",
    p_items: quote.items as any,
  };
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("create_auto_parts_quote", params);
  if (error) throw error;
  return data as { id: string; quote_number: string };
}

export async function updateQuote(
  id: string,
  quote: {
    client_id?: string | null;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    total: number;
    status?: string;
    valid_until?: string | null;
    notes?: string;
    terms?: string;
    items: QuoteItem[];
  },
  businessId?: string
) {
  const { data, error } = await supabase.rpc("update_auto_parts_quote", {
    p_id: id,
    p_business_id: businessId ?? null,
    p_client_id: quote.client_id ?? null,
    p_client_name: quote.client_name ?? null,
    p_client_phone: quote.client_phone ?? null,
    p_client_email: quote.client_email ?? null,
    p_subtotal: quote.subtotal,
    p_tax_rate: quote.tax_rate,
    p_tax_amount: quote.tax_amount,
    p_discount_type: quote.discount_type,
    p_discount_value: quote.discount_value,
    p_discount_amount: quote.discount_amount,
    p_total: quote.total,
    p_status: quote.status ?? null,
    p_valid_until: quote.valid_until ?? null,
    p_notes: quote.notes ?? null,
    p_terms: quote.terms ?? null,
    p_items: quote.items as any,
  });
  if (error) throw error;
  return data;
}

export async function deleteQuote(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("delete_auto_parts_quote", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data;
}
