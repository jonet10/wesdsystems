import { apiSupabase } from "../../supabase.js";
import { adjustProductStock, json, loadTabDetail } from "../shared.js";

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    if (!tabId) return json(res, 400, { error: "id requis" });

    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

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
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
