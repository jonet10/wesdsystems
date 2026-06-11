import type { PendingTabCreateInput } from "../../src/modules/salon/pending-tabs.ts";
import { apiSupabase } from "../supabase.js";
import { adjustProductStock, json, loadTabDetail, loadTabSummaryList, restorePendingTabStock } from "./shared.js";

const groupItems = (items: any[]) => {
  const grouped = new Map<string, any>();
  for (const item of items) {
    const key = `${item.item_type}:${item.item_id}:${item.item_name}:${Number(item.unit_price || 0)}`;
    const current = grouped.get(key) || {
      item_type: item.item_type,
      item_id: item.item_id,
      item_name: item.item_name,
      unit_price: Number(item.unit_price || 0),
      quantity: 0,
      subtotal: 0,
      source_ids: [],
    };
    current.quantity += Number(item.quantity || 0);
    current.subtotal += Number(item.subtotal || 0);
    current.source_ids.push(item.id);
    grouped.set(key, current);
  }
  return Array.from(grouped.values());
};

const getCommissionRate = async (employeeId: string, serviceId: string) => {
  const { data: employee, error: employeeError } = await apiSupabase
    .from("salon_employees")
    .select("role, commission_percentage")
    .eq("id", employeeId)
    .maybeSingle();
  if (employeeError) throw employeeError;
  if (employee?.role !== "barber") return null;

  const { data: rules, error: ruleError } = await apiSupabase
    .from("commission_rules")
    .select("rate_type, rate_value")
    .eq("employee_id", employeeId)
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .maybeSingle();
  if (ruleError) throw ruleError;
  if (rules) return { type: rules.rate_type, value: Number(rules.rate_value) };

  const { data: global, error: globalError } = await apiSupabase
    .from("commission_rules")
    .select("rate_type, rate_value")
    .eq("employee_id", employeeId)
    .is("service_id", null)
    .eq("is_active", true)
    .maybeSingle();
  if (globalError) throw globalError;
  if (global) return { type: global.rate_type, value: Number(global.rate_value) };
  if (employee?.commission_percentage) return { type: "percentage", value: Number(employee.commission_percentage) };
  return null;
};

async function handleList(req: any, res: any) {
  const branchId = String(req.query.branch_id || "");
  const status = String(req.query.status || "open");
  if (!branchId) return json(res, 400, { error: "branch_id requis" });
  const tabs = await loadTabSummaryList(branchId, status);
  return json(res, 200, { data: tabs });
}

async function handleCreate(req: any, res: any) {
  const body = (req.body || {}) as PendingTabCreateInput;
  if (!body.branch_id) return json(res, 400, { error: "branch_id requis" });
  if (!body.label?.trim()) return json(res, 400, { error: "label requis" });

  const { data, error } = await apiSupabase
    .from("pending_tabs")
    .insert({
      label: body.label.trim(),
      client_id: body.client_id || null,
      guest_name: body.guest_name || null,
      branch_id: body.branch_id,
      cashier_id: body.cashier_id || null,
      notes: body.notes || null,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  const tab = await loadTabDetail(data.id);
  return json(res, 201, { data: tab });
}

async function handleDetail(req: any, res: any, tabId: string) {
  const tab = await loadTabDetail(tabId);
  if (!tab) return json(res, 404, { error: "Fiche introuvable" });
  return json(res, 200, { data: tab });
}

async function handleCancel(req: any, res: any, tabId: string) {
  const current = await loadTabDetail(tabId);
  if (!current) return json(res, 404, { error: "Fiche introuvable" });
  if (current.status !== "open") return json(res, 400, { error: "La fiche ne peut plus être annulée" });

  const { data: branch, error: branchError } = await apiSupabase
    .from("salon_branches")
    .select("business_id")
    .eq("id", current.branch_id)
    .maybeSingle();
  if (branchError) throw branchError;
  if (!branch?.business_id) return json(res, 400, { error: "Business introuvable pour cette branche" });

  try {
    await restorePendingTabStock(current, String(branch.business_id), null);
    const { error } = await apiSupabase.from("pending_tabs").update({ status: "cancelled" }).eq("id", tabId);
    if (error) throw error;
  } catch (cancelError) {
    for (const item of current.items) {
      if (item.item_type !== "product") continue;
      await adjustProductStock({
        businessId: String(branch.business_id),
        branchId: current.branch_id,
        productId: item.item_id,
        quantityDelta: -Number(item.quantity || 0),
        reason: `Rétablissement après échec d'annulation fiche #${current.tab_number}`,
        referenceId: current.id,
        referenceType: "pending_tab",
        createdBy: null,
      });
    }
    throw cancelError;
  }
  const tab = await loadTabDetail(tabId);
  return json(res, 200, { data: tab });
}

async function handleCheckout(req: any, res: any, tabId: string) {
  const body = req.body || {};
  const paymentMethod = String(body.payment_method || "cash");
  const cashierId = body.cashier_id || null;
  const employeeId = body.employee_id || null;
  const paymentSplits = Array.isArray(body.payment_splits) ? body.payment_splits : null;

  const tab = await loadTabDetail(tabId);
  if (!tab) return json(res, 404, { error: "Fiche introuvable" });
  if (tab.status !== "open") return json(res, 400, { error: "Fiche déjà clôturée" });

  const { data: branch, error: branchError } = await apiSupabase
    .from("salon_branches")
    .select("id, business_id")
    .eq("id", tab.branch_id)
    .maybeSingle();
  if (branchError) throw branchError;
  if (!branch?.business_id) return json(res, 400, { error: "Business introuvable pour cette branche" });

  const saleItems = groupItems(tab.items);
  const totalAmount = saleItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const cashierName = typeof body.cashier_name === "string" && body.cashier_name.trim()
    ? body.cashier_name.trim()
    : null;

  const { data: sale, error: saleError } = await apiSupabase
    .from("salon_sales")
    .insert({
      business_id: branch.business_id,
      branch_id: tab.branch_id,
      customer_name: tab.label,
      customer_id: tab.client_id || null,
      payment_method: paymentMethod === "mixed" ? "cash" : paymentMethod,
      total_amount: totalAmount,
      discount_amount: 0,
      discount_percentage: 0,
      tax_amount: 0,
      employee_id: employeeId,
      cashier_name: cashierName,
      cashier_id: cashierId,
    })
    .select("id, sale_number, created_at")
    .single();
  if (saleError || !sale?.id) throw new Error(saleError?.message || "Impossible de créer la transaction");

  const { error: saleItemError } = await apiSupabase.from("salon_sale_items").insert(
    saleItems.map((item) => ({
      sale_id: sale.id,
      branch_id: tab.branch_id,
      ...(item.item_type === "product" ? { product_id: item.item_id } : {}),
      ...(item.item_type === "service" ? { service_id: item.item_id } : {}),
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.subtotal,
    }))
  );
  if (saleItemError) throw new Error(saleItemError.message);

  if (paymentSplits?.length) {
    const { error: paymentError } = await apiSupabase.from("salon_sale_payments").insert(
      paymentSplits.map((split: any) => ({
        sale_id: sale.id,
        business_id: branch.business_id,
        branch_id: tab.branch_id,
        payment_method: split.method || paymentMethod,
        amount: Number(split.amount || 0),
        currency_code: body.currency_code || "HTG",
      }))
    );
    if (paymentError) throw paymentError;
  } else {
    const { error: paymentError } = await apiSupabase.from("salon_sale_payments").insert({
      sale_id: sale.id,
      business_id: branch.business_id,
      branch_id: tab.branch_id,
      payment_method: paymentMethod,
      amount: Number(body.amount_paid || totalAmount),
      currency_code: body.currency_code || "HTG",
    });
    if (paymentError) throw paymentError;
  }

  if (employeeId) {
    for (const item of saleItems) {
      if (item.item_type !== "service") continue;
      const rate = await getCommissionRate(employeeId, item.item_id);
      if (!rate) continue;
      const saleAmount = Number(item.quantity || 0) * Number(item.unit_price || 0);
      const commissionAmount = rate.type === "percentage" ? saleAmount * (rate.value / 100) : rate.value;
      const { error: commissionError } = await apiSupabase.from("commission_transactions").insert({
        business_id: branch.business_id,
        branch_id: tab.branch_id,
        employee_id: employeeId,
        sale_id: sale.id,
        service_id: item.item_id,
        rate_type: rate.type,
        rate_value: rate.value,
        sale_amount: saleAmount,
        commission_amount: commissionAmount,
        currency_code: body.currency_code || "HTG",
        status: "pending",
      });
      if (commissionError) throw commissionError;
    }
  }

  const { error: closeError } = await apiSupabase
    .from("pending_tabs")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", tab.id);
  if (closeError) throw closeError;

  const closedTab = await loadTabDetail(tab.id);
  return json(res, 200, {
    data: {
      sale: { ...sale, tab_number: tab.tab_number, label: tab.label, customer_name: tab.label, customer_id: tab.client_id || null, opened_at: tab.opened_at, closed_at: closedTab?.closed_at || new Date().toISOString(), cashier_name: cashierName },
      items: saleItems,
      tab: closedTab,
    },
  });
}

async function handleAddItem(req: any, res: any, tabId: string) {
  const body = req.body || {};
  if (!body.item_type || !body.item_id || !body.item_name) {
    return json(res, 400, { error: "item_type, item_id et item_name requis" });
  }
  const tab = await loadTabDetail(tabId);
  if (!tab) return json(res, 404, { error: "Fiche introuvable" });
  if (tab.status !== "open") return json(res, 400, { error: "La fiche n'est plus modifiable" });

  const quantity = Math.max(1, Number(body.quantity || 1));
  const unitPrice = Number(body.unit_price || 0);
  const { data: branch, error: branchError } = await apiSupabase
    .from("salon_branches")
    .select("business_id")
    .eq("id", tab.branch_id)
    .maybeSingle();
  if (branchError) throw branchError;

  if (body.item_type === "product" && branch?.business_id) {
    await adjustProductStock({
      businessId: String(branch.business_id),
      branchId: tab.branch_id,
      productId: body.item_id,
      quantityDelta: -quantity,
      reason: `Réservation fiche #${tab.tab_number}`,
      referenceId: tab.id,
      referenceType: "pending_tab",
      createdBy: body.added_by || null,
    });
  }

  try {
    const { error } = await apiSupabase.from("pending_tab_items").insert({
      tab_id: tabId,
      item_type: body.item_type,
      item_id: body.item_id,
      item_name: body.item_name,
      unit_price: unitPrice,
      quantity,
      added_by: body.added_by || null,
    });
    if (error) throw error;
  } catch (insertError) {
    if (body.item_type === "product" && branch?.business_id) {
      await adjustProductStock({
        businessId: String(branch.business_id),
        branchId: tab.branch_id,
        productId: body.item_id,
        quantityDelta: quantity,
        reason: `Annulation ajout fiche #${tab.tab_number}`,
        referenceId: tab.id,
        referenceType: "pending_tab",
        createdBy: body.added_by || null,
      });
    }
    throw insertError;
  }
  const refreshed = await loadTabDetail(tabId);
  return json(res, 201, { data: refreshed });
}

async function handleUpdateItem(req: any, res: any, tabId: string, itemId: string) {
  const tab = await loadTabDetail(tabId);
  if (!tab) return json(res, 404, { error: "Fiche introuvable" });
  if (tab.status !== "open") return json(res, 400, { error: "La fiche n'est plus modifiable" });

  const { data: branch, error: branchError } = await apiSupabase
    .from("salon_branches")
    .select("business_id")
    .eq("id", tab.branch_id)
    .maybeSingle();
  if (branchError) throw branchError;

  const currentItem = tab.items.find((item) => item.id === itemId);
  if (!currentItem) return json(res, 404, { error: "Article introuvable" });

  const quantity = Math.max(1, Number(req.body?.quantity || 1));
  const delta = quantity - Number(currentItem.quantity || 0);
  if (currentItem.item_type === "product" && branch?.business_id) {
    if (delta !== 0) {
      await adjustProductStock({
        businessId: String(branch.business_id),
        branchId: tab.branch_id,
        productId: currentItem.item_id,
        quantityDelta: -delta,
        reason: `Ajustement fiche #${tab.tab_number}`,
        referenceId: tab.id,
        referenceType: "pending_tab",
        createdBy: null,
      });
    }
  }

  try {
    const { error } = await apiSupabase.from("pending_tab_items").update({ quantity }).eq("id", itemId).eq("tab_id", tabId);
    if (error) throw error;
  } catch (updateError) {
    if (currentItem.item_type === "product" && branch?.business_id && delta !== 0) {
      await adjustProductStock({
        businessId: String(branch.business_id),
        branchId: tab.branch_id,
        productId: currentItem.item_id,
        quantityDelta: delta,
        reason: `Annulation ajustement fiche #${tab.tab_number}`,
        referenceId: tab.id,
        referenceType: "pending_tab",
        createdBy: null,
      });
    }
    throw updateError;
  }
  const refreshed = await loadTabDetail(tabId);
  return json(res, 200, { data: refreshed });
}

async function handleDeleteItem(req: any, res: any, tabId: string, itemId: string) {
  const tab = await loadTabDetail(tabId);
  if (!tab) return json(res, 404, { error: "Fiche introuvable" });
  if (tab.status !== "open") return json(res, 400, { error: "La fiche n'est plus modifiable" });

  const { data: branch, error: branchError } = await apiSupabase
    .from("salon_branches")
    .select("business_id")
    .eq("id", tab.branch_id)
    .maybeSingle();
  if (branchError) throw branchError;

  const currentItem = tab.items.find((item) => item.id === itemId);
  if (!currentItem) return json(res, 404, { error: "Article introuvable" });

  if (currentItem.item_type === "product" && branch?.business_id) {
    await adjustProductStock({
      businessId: String(branch.business_id),
      branchId: tab.branch_id,
      productId: currentItem.item_id,
      quantityDelta: Number(currentItem.quantity || 0),
      reason: `Suppression fiche #${tab.tab_number}`,
      referenceId: tab.id,
      referenceType: "pending_tab",
      createdBy: null,
    });
  }

  try {
    const { error } = await apiSupabase.from("pending_tab_items").delete().eq("id", itemId).eq("tab_id", tabId);
    if (error) throw error;
  } catch (deleteError) {
    if (currentItem.item_type === "product" && branch?.business_id) {
      await adjustProductStock({
        businessId: String(branch.business_id),
        branchId: tab.branch_id,
        productId: currentItem.item_id,
        quantityDelta: -Number(currentItem.quantity || 0),
        reason: `Annulation suppression fiche #${tab.tab_number}`,
        referenceId: tab.id,
        referenceType: "pending_tab",
        createdBy: null,
      });
    }
    throw deleteError;
  }
  const refreshed = await loadTabDetail(tabId);
  return json(res, 200, { data: refreshed });
}

export default async function handler(req: any, res: any) {
  try {
    const path: string[] = req.query.path || [];
    const tabId = path[0] || "";
    const action = path[1] || "";
    const itemId = path[2] || "";

    // /api/pending-tabs
    if (path.length === 0) {
      if (req.method === "GET") return await handleList(req, res);
      if (req.method === "POST") return await handleCreate(req, res);
      return json(res, 405, { error: "Method not allowed" });
    }

    // /api/pending-tabs/:id
    if (path.length === 1) {
      if (!tabId) return json(res, 400, { error: "id requis" });
      if (req.method === "GET") return await handleDetail(req, res, tabId);
      return json(res, 405, { error: "Method not allowed" });
    }

    // /api/pending-tabs/:id/cancel
    if (action === "cancel") {
      if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
      return await handleCancel(req, res, tabId);
    }

    // /api/pending-tabs/:id/checkout
    if (action === "checkout") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleCheckout(req, res, tabId);
    }

    // /api/pending-tabs/:id/items
    if (action === "items" && !itemId) {
      if (req.method === "POST") return await handleAddItem(req, res, tabId);
      return json(res, 405, { error: "Method not allowed" });
    }

    // /api/pending-tabs/:id/items/:itemId
    if (action === "items" && itemId) {
      if (req.method === "PATCH") return await handleUpdateItem(req, res, tabId, itemId);
      if (req.method === "DELETE") return await handleDeleteItem(req, res, tabId, itemId);
      return json(res, 405, { error: "Method not allowed" });
    }

    return json(res, 404, { error: "Route inconnue" });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
