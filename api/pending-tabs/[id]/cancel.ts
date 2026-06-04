import { apiSupabase } from "../../supabase";
import { adjustProductStock, json, loadTabDetail, restorePendingTabStock } from "../shared";

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    if (!tabId) return json(res, 400, { error: "id requis" });
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });

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

      const { error } = await apiSupabase
        .from("pending_tabs")
        .update({ status: "cancelled" })
        .eq("id", tabId);

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
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
