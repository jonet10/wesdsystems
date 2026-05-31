import { apiSupabase } from "../../../_supabase";
import { json, loadTabDetail } from "../../_shared";

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    const itemId = String(req.query.itemId || "");

    if (!tabId || !itemId) return json(res, 400, { error: "id et itemId requis" });
    const tab = await loadTabDetail(tabId);
    if (!tab) return json(res, 404, { error: "Fiche introuvable" });
    if (tab.status !== "open") return json(res, 400, { error: "La fiche n'est plus modifiable" });

    if (req.method === "PATCH") {
      const quantity = Math.max(1, Number(req.body?.quantity || 1));
      const { error } = await apiSupabase
        .from("pending_tab_items")
        .update({ quantity })
        .eq("id", itemId)
        .eq("tab_id", tabId);
      if (error) throw error;

      const refreshed = await loadTabDetail(tabId);
      return json(res, 200, { data: refreshed });
    }

    if (req.method === "DELETE") {
      const { error } = await apiSupabase
        .from("pending_tab_items")
        .delete()
        .eq("id", itemId)
        .eq("tab_id", tabId);
      if (error) throw error;

      const refreshed = await loadTabDetail(tabId);
      return json(res, 200, { data: refreshed });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
