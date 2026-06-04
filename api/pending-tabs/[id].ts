import { json, loadTabDetail } from "./shared";

export default async function handler(req: any, res: any) {
  try {
    const tabId = String(req.query.id || "");
    if (!tabId) return json(res, 400, { error: "id requis" });

    if (req.method !== "GET") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const tab = await loadTabDetail(tabId);
    if (!tab) return json(res, 404, { error: "Fiche introuvable" });
    return json(res, 200, { data: tab });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}

