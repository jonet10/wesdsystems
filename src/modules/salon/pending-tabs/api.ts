import { supabase } from "@/lib/supabase";
import { recordStockMovement } from "@/modules/salon/inventory";
import type {
  PendingTabCheckoutInput,
  PendingTabCreateInput,
  PendingTabDetail,
  PendingTabItemInput,
  PendingTabSummary,
  PendingTabItem,
} from "./types";

const toNumber = (value: unknown) => Number(value || 0);

const getBusinessIdForBranch = async (branchId: string) => {
  const { data, error } = await supabase
    .from("salon_branches")
    .select("id, business_id")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.business_id) throw new Error("Business introuvable pour cette branche");
  return String(data.business_id);
};

const getCommissionRate = async (employeeId: string, serviceId: string): Promise<{ type: string; value: number } | null> => {
  const { data: employee, error: employeeError } = await supabase
    .from("salon_employees")
    .select("role, commission_percentage")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee) return null;

  const { data: rules, error: ruleError } = await supabase
    .from("commission_rules")
    .select("rate_type, rate_value")
    .eq("employee_id", employeeId)
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (ruleError) return null;
  if (rules) return { type: rules.rate_type, value: Number(rules.rate_value) };

  if (employee.commission_percentage && employee.commission_percentage > 0) {
    return { type: "percentage", value: Number(employee.commission_percentage) };
  }

  return null;
};

export async function listPendingTabs(branchId: string, status: "open" | "closed" | "cancelled" = "open"): Promise<PendingTabSummary[]> {
  const { data, error } = await supabase
    .from("salon_pending_tabs")
    .select("*, items:salon_pending_tab_items(*)")
    .eq("branch_id", branchId)
    .eq("status", status)
    .order("opened_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((tab: any) => ({
    ...tab,
    items_count: tab.items?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0,
    total_amount: tab.items?.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0) || 0,
  }));
}

export async function createPendingTab(input: PendingTabCreateInput): Promise<PendingTabDetail> {
  const tab_number = "TAB-" + Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  
  const { data, error } = await supabase
    .from("salon_pending_tabs")
    .insert({
      branch_id: input.branch_id,
      client_id: input.client_id || null,
      guest_name: input.guest_name || null,
      cashier_id: input.cashier_id || null,
      label: input.label,
      notes: input.notes || null,
      tab_number,
      status: "open",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    items: [],
    items_count: 0,
    total_amount: 0,
  };
}

export async function getPendingTab(tabId: string): Promise<PendingTabDetail> {
  const { data, error } = await supabase
    .from("salon_pending_tabs")
    .select("*, items:salon_pending_tab_items(*)")
    .eq("id", tabId)
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    items_count: data.items?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0,
    total_amount: data.items?.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0) || 0,
  };
}

export async function addPendingTabItem(tabId: string, input: PendingTabItemInput): Promise<PendingTabDetail> {
  const quantity = input.quantity || 1;
  const subtotal = quantity * input.unit_price;

  // Check if item already exists
  const { data: existing } = await supabase
    .from("salon_pending_tab_items")
    .select("*")
    .eq("tab_id", tabId)
    .eq("item_type", input.item_type)
    .eq("item_id", input.item_id)
    .eq("unit_price", input.unit_price)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("salon_pending_tab_items")
      .update({
        quantity: existing.quantity + quantity,
        subtotal: existing.subtotal + subtotal,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("salon_pending_tab_items")
      .insert({
        tab_id: tabId,
        item_type: input.item_type,
        item_id: input.item_id,
        item_name: input.item_name,
        unit_price: input.unit_price,
        quantity,
        subtotal,
        added_by: input.added_by || null,
      });
    if (error) throw new Error(error.message);
  }

  // Touch the tab so updated_at triggers
  await supabase.from("salon_pending_tabs").update({ updated_at: new Date().toISOString() }).eq("id", tabId);

  return getPendingTab(tabId);
}

export async function updatePendingTabItem(tabId: string, itemId: string, quantity: number): Promise<PendingTabDetail> {
  const { data: item } = await supabase.from("salon_pending_tab_items").select("unit_price").eq("id", itemId).single();
  if (item) {
    const subtotal = quantity * Number(item.unit_price);
    const { error } = await supabase.from("salon_pending_tab_items").update({ quantity, subtotal }).eq("id", itemId);
    if (error) throw new Error(error.message);
    await supabase.from("salon_pending_tabs").update({ updated_at: new Date().toISOString() }).eq("id", tabId);
  }
  return getPendingTab(tabId);
}

export async function deletePendingTabItem(tabId: string, itemId: string): Promise<PendingTabDetail> {
  const { error } = await supabase.from("salon_pending_tab_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  await supabase.from("salon_pending_tabs").update({ updated_at: new Date().toISOString() }).eq("id", tabId);
  return getPendingTab(tabId);
}

export async function cancelPendingTab(tabId: string): Promise<PendingTabDetail> {
  const { error } = await supabase
    .from("salon_pending_tabs")
    .update({ status: "cancelled", closed_at: new Date().toISOString() })
    .eq("id", tabId);
  if (error) throw new Error(error.message);
  return getPendingTab(tabId);
}

export async function checkoutPendingTab(tabId: string, input: PendingTabCheckoutInput) {
  const tab = await getPendingTab(tabId);
  if (!tab) throw new Error("Fiche introuvable");
  if (tab.status !== "open") throw new Error("La fiche est déjà fermée ou annulée");

  const businessId = await getBusinessIdForBranch(tab.branch_id);
  const saleItems = tab.items || [];
  const totalAmount = input.total_amount ?? tab.total_amount;
  const now = new Date().toISOString();

  const { data: sale, error: saleError } = await supabase
    .from("salon_sales")
    .insert({
      branch_id: tab.branch_id,
      customer_id: tab.client_id || input.employee_id || null, 
      employee_id: input.employee_id || null, 
      total_amount: totalAmount,
      tax_amount: 0,
      discount_amount: input.discount_amount ?? 0,
      payment_method: input.payment_splits && input.payment_splits.length > 0 ? "split" : input.payment_method,
      payment_status: "completed",
      customer_name: tab.client_id ? undefined : tab.guest_name || tab.label,
      notes: "Via fiche en attente #" + tab.tab_number,
      cashier_name: input.cashier_name || null,
      cashier_id: input.cashier_id || tab.cashier_id || null,
    })
    .select("id, sale_number, created_at")
    .single();

  if (saleError || !sale?.id) throw new Error(saleError?.message || "Impossible de créer la transaction");

  const serviceIds = saleItems
    .filter((item) => item.item_type === "service" && item.item_id)
    .map((item) => item.item_id);
  const existingServiceIds = new Set<string>();
  if (serviceIds.length > 0) {
    const { data: services } = await supabase.from("salon_services").select("id").in("id", serviceIds);
    if (services) {
      for (const s of services) existingServiceIds.add(s.id);
    }
  }

  const { error: saleItemError } = await supabase.from("salon_sale_items").insert(
    saleItems.map((item) => ({
      sale_id: sale.id,
      branch_id: tab.branch_id,
      product_id: item.item_type === "product" ? item.item_id : null,
      service_id: item.item_type === "service" && existingServiceIds.has(item.item_id) ? item.item_id : null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.subtotal,
    }))
  );
  if (saleItemError) throw new Error(saleItemError.message);

  try {
    if (Array.isArray(input.payment_splits) && input.payment_splits.length > 0) {
      await supabase.from("salon_sale_payments").insert(
        input.payment_splits.map((split) => ({
          sale_id: sale.id,
          business_id: businessId,
          branch_id: tab.branch_id,
          payment_method: split.method || input.payment_method,
          amount: Number(split.amount || 0),
          currency_code: input.currency_code || "HTG",
        }))
      );
    } else {
      await supabase.from("salon_sale_payments").insert({
        sale_id: sale.id,
        business_id: businessId,
        branch_id: tab.branch_id,
        payment_method: input.payment_method,
        amount: Number(input.amount_paid || totalAmount),
        currency_code: input.currency_code || "HTG",
      });
    }
  } catch (paymentErr: any) {
    console.warn("Détails de paiement non enregistrés:", paymentErr?.message);
  }

  for (const item of saleItems) {
    if (item.item_type !== "product") continue;

    const { data: product, error: productError } = await supabase
      .from("salon_products")
      .select("id, quantity_in_stock")
      .eq("id", item.item_id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);

    const previousStock = Number(product?.quantity_in_stock || 0);
    const nextStock = Math.max(0, previousStock - Number(item.quantity || 0));

    const { error: updateError } = await supabase
      .from("salon_products")
      .update({ quantity_in_stock: nextStock })
      .eq("id", item.item_id);
    if (updateError) throw new Error(updateError.message);

    try {
      await recordStockMovement({
        business_id: businessId,
        branch_id: tab.branch_id,
        product_id: item.item_id,
        movement_type: "sale",
        quantity_delta: -Number(item.quantity || 0),
        reason: `Vente fiche #${tab.tab_number}`,
        reference_id: sale.id,
      });
    } catch (err: any) {
      console.warn("Mouvement stock produit non enregistré:", err.message);
    }
  }

  const hasServices = saleItems.some((item) => item.item_type === "service");
  if (input.employee_id && hasServices) {
    for (const item of saleItems) {
      if (item.item_type !== "service") continue;

      const rate = await getCommissionRate(input.employee_id, item.item_id);
      if (!rate) continue;

      const saleAmount = Number(item.quantity || 0) * Number(item.unit_price || 0);
      const commissionAmount = rate.type === "percentage"
        ? saleAmount * (rate.value / 100)
        : rate.value;

      const { error: commissionError } = await supabase.from("commission_transactions").insert({
        business_id: businessId,
        employee_id: input.employee_id,
        sale_id: sale.id,
        service_id: item.item_id,
        rate_type: rate.type,
        rate_value: rate.value,
        sale_amount: saleAmount,
        commission_amount: commissionAmount,
        currency_code: input.currency_code || "HTG",
        status: "pending",
      });
      if (commissionError) throw new Error(commissionError.message);
    }
  }

  const { error: tabCloseError } = await supabase
    .from("salon_pending_tabs")
    .update({ status: "closed", closed_at: now })
    .eq("id", tabId);
  if (tabCloseError) throw new Error(tabCloseError.message);
  
  const closedTab = { ...tab, status: "closed" as const, closed_at: now };

  return {
    sale: {
      ...sale,
      tab_number: tab.tab_number,
      label: tab.label,
      customer_name: tab.label,
      customer_id: tab.client_id || null,
      opened_at: tab.opened_at,
      closed_at: now,
      cashier_name: input.cashier_name || null,
    },
    items: saleItems,
    tab: closedTab,
  };
}

export async function findClientOptions(query: string, branchId?: string | null) {
  let request = supabase
    .from("salon_customers")
    .select("id, first_name, last_name, phone, visit_count")
    .eq("is_active", true)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(6);

  if (branchId) {
    request = request.eq("branch_id", branchId);
  }

  const { data } = await request;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    phone: row.phone || "",
    visit_count: row.visit_count || 0,
  }));
}
export async function recordTabPayment(tabId: string, amount: number) {
  const { data: tab, error: fetchError } = await supabase
    .from("salon_pending_tabs")
    .select("total_paid")
    .eq("id", tabId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const newTotalPaid = Number(tab.total_paid || 0) + amount;

  const { error: updateError } = await supabase
    .from("salon_pending_tabs")
    .update({ total_paid: newTotalPaid, updated_at: new Date().toISOString() })
    .eq("id", tabId);

  if (updateError) throw new Error(updateError.message);

  return { success: true };
}
