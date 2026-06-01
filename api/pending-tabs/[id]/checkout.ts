import { apiSupabase } from "../../_supabase";
import { json, loadTabDetail } from "../_shared";

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

  if (employee?.commission_percentage) {
    return { type: "percentage", value: Number(employee.commission_percentage) };
  }

  return null;
};

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    if (!tabId) return json(res, 400, { error: "id requis" });
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

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

    for (const item of saleItems) {
      if (item.item_type !== "product") continue;

      const { data: product } = await apiSupabase
        .from("salon_products")
        .select("id, quantity_in_stock")
        .eq("id", item.item_id)
        .maybeSingle();

      const previousStock = Number(product?.quantity_in_stock || 0);
      const nextStock = Math.max(0, previousStock - Number(item.quantity || 0));

      const { error: productUpdateError } = await apiSupabase
        .from("salon_products")
        .update({ quantity_in_stock: nextStock })
        .eq("id", item.item_id);
      if (productUpdateError) throw productUpdateError;

      const { error: stockMovementError } = await apiSupabase.from("salon_stock_movements").insert({
        business_id: branch.business_id,
        branch_id: tab.branch_id,
        product_id: item.item_id,
        movement_type: "sale",
        quantity_delta: -Number(item.quantity || 0),
        quantity_before: previousStock,
        quantity_after: nextStock,
        reason: `Vente fiche #${tab.tab_number}`,
        reference_type: "pending_tab",
        reference_id: tab.id,
        created_by: cashierId || null,
      });
      if (stockMovementError) throw stockMovementError;
    }

    if (employeeId) {
      for (const item of saleItems) {
        if (item.item_type !== "service") continue;
        const rate = await getCommissionRate(employeeId, item.item_id);
        if (!rate) continue;

        const saleAmount = Number(item.quantity || 0) * Number(item.unit_price || 0);
        const commissionAmount = rate.type === "percentage"
          ? saleAmount * (rate.value / 100)
          : rate.value;

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
        sale: {
          ...sale,
          tab_number: tab.tab_number,
          label: tab.label,
          customer_name: tab.label,
          customer_id: tab.client_id || null,
          opened_at: tab.opened_at,
          closed_at: closedTab?.closed_at || new Date().toISOString(),
          cashier_name: cashierName,
        },
        items: saleItems,
        tab: closedTab,
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
