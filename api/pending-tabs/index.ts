import type { PendingTabCreateInput } from "../../src/modules/salon/pending-tabs";
import { apiSupabase } from "../_supabase";
import { json, loadTabDetail, loadTabSummaryList } from "./_shared";

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const branchId = String(req.query.branch_id || "");
      const status = String(req.query.status || "open");
      if (!branchId) return json(res, 400, { error: "branch_id requis" });
      const tabs = await loadTabSummaryList(branchId, status);
      return json(res, 200, { data: tabs });
    }

    if (req.method === "POST") {
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

    return json(res, 405, { error: "Method not allowed" });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}

