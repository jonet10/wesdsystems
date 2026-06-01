import { apiSupabase } from "../../../_supabase";
import { adjustProductStock, json, loadTabDetail } from "../../_shared";

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    const itemId = String(req.query.itemId || "");

    if (!tabId || !itemId) return json(res, 400, { error: "id et itemId requis" });
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

    if (req.method === "PATCH") {
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
        const { error } = await apiSupabase
          .from("pending_tab_items")
          .update({ quantity })
          .eq("id", itemId)
          .eq("tab_id", tabId);
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

    if (req.method === "DELETE") {
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
        const { error } = await apiSupabase
          .from("pending_tab_items")
          .delete()
          .eq("id", itemId)
          .eq("tab_id", tabId);
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

    return json(res, 405, { error: "Method not allowed" });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
