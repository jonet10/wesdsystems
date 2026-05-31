import { apiSupabase } from "../../_supabase";
import { json, loadTabDetail } from "../_shared";

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    if (!tabId) return json(res, 400, { error: "id requis" });
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });

    const current = await loadTabDetail(tabId);
    if (!current) return json(res, 404, { error: "Fiche introuvable" });
    if (current.status !== "open") return json(res, 400, { error: "La fiche ne peut plus être annulée" });

    const { error } = await apiSupabase
      .from("pending_tabs")
      .update({ status: "cancelled" })
      .eq("id", tabId);

    if (error) throw error;

    const tab = await loadTabDetail(tabId);
    return json(res, 200, { data: tab });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
