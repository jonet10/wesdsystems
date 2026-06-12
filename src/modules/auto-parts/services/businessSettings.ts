import { supabase } from "@/lib/supabase";

export interface AutoPartsBusinessSettings {
  id?: string;
  business_id: string;
  company_name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  nif?: string | null;
  patente?: string | null;
  rc?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  invoice_prefix: string;
  quote_prefix: string;
  delivery_note_prefix: string;
  receipt_footer?: string | null;
  receipt_header?: string | null;
  low_stock_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export async function getBusinessSettings(businessId: string): Promise<AutoPartsBusinessSettings | null> {
  const { data, error } = await supabase.rpc("get_auto_parts_business_settings", {
    p_business_id: businessId,
  });
  if (error) throw error;
  if (!data || Object.keys(data).length === 0) return null;
  return data as AutoPartsBusinessSettings;
}

export async function upsertBusinessSettings(
  businessId: string,
  settings: Omit<AutoPartsBusinessSettings, "id" | "business_id" | "created_at" | "updated_at">
) {
  const { data, error } = await supabase.rpc("upsert_auto_parts_business_settings", {
    p_business_id: businessId,
    p_company_name: settings.company_name,
    p_logo_url: settings.logo_url ?? null,
    p_address: settings.address ?? null,
    p_phone: settings.phone ?? null,
    p_email: settings.email ?? null,
    p_website: settings.website ?? null,
    p_nif: settings.nif ?? null,
    p_patente: settings.patente ?? null,
    p_rc: settings.rc ?? null,
    p_bank_name: settings.bank_name ?? null,
    p_bank_account: settings.bank_account ?? null,
    p_invoice_prefix: settings.invoice_prefix,
    p_quote_prefix: settings.quote_prefix,
    p_delivery_note_prefix: settings.delivery_note_prefix,
    p_receipt_footer: settings.receipt_footer ?? null,
    p_receipt_header: settings.receipt_header ?? null,
    p_low_stock_threshold: settings.low_stock_threshold,
  });
  if (error) throw error;
  return data;
}
