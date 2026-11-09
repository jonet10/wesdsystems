import { supabase } from "@/lib/supabase";

export interface RegisterCashSummary {
  salesCount: number;
  cashSales: number;
  expenses: number;
}

export interface OpenRegisterInfo {
  id: string;
  name: string;
  opened_at: string | null;
}

/**
 * Lit le nom / la description d'une caisse.
 * Le nom est stocké dans la colonne `notes` (JSON), avec repli sur le texte brut
 * pour les anciennes caisses.
 */
export function parseRegisterMeta(notes?: string | null): {
  name: string;
  description: string | null;
} {
  if (!notes) return { name: "Caisse", description: null };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed.name) {
      return {
        name: String(parsed.name),
        description: parsed.description ? String(parsed.description) : null,
      };
    }
  } catch {
    // notes n'est pas du JSON : ancienne caisse, on garde le texte tel quel.
  }
  return { name: notes, description: null };
}

/**
 * Retourne la caisse ouverte pour un utilisateur donné (la plus récente).
 * Utilisé par le POS pour rattacher automatiquement chaque vente à la caisse
 * du caissier connecté.
 */
export async function getOpenRegisterForCurrentUser(
  businessId: string,
  userId?: string | null,
): Promise<OpenRegisterInfo | null> {
  if (!businessId) return null;

  let query = supabase
    .from("pharmacy_cash_registers")
    .select("id, notes, opened_at, opened_by")
    .eq("business_id", businessId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);

  if (userId) query = query.eq("opened_by", userId);

  const { data, error } = await query;
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.id,
    name: parseRegisterMeta(row.notes).name,
    opened_at: row.opened_at || null,
  };
}

/**
 * Calcule pour chaque caisse :
 *  - le nombre total de ventes rattachées,
 *  - le total des ventes encaissées en espèces,
 *  - le total des dépenses payées depuis la caisse.
 *
 * Le rapprochement de caisse ne compte que les ventes en espèces réellement
 * payées (`payment_method = 'cash'` et `payment_status = 'paid'`).
 */
export async function getRegisterSummaries(
  businessId: string,
  registerIds: string[],
): Promise<Record<string, RegisterCashSummary>> {
  const summary: Record<string, RegisterCashSummary> = {};
  registerIds.forEach((id) => {
    summary[id] = { salesCount: 0, cashSales: 0, expenses: 0 };
  });

  if (!businessId || registerIds.length === 0) return summary;

  const [salesResult, expensesResult] = await Promise.all([
    supabase
      .from("pharmacy_sales")
      .select("register_id, total, payment_method, payment_status")
      .eq("business_id", businessId)
      .in("register_id", registerIds),
    supabase
      .from("pharmacy_expenses")
      .select("register_id, amount")
      .eq("business_id", businessId)
      .in("register_id", registerIds),
  ]);

  if (!salesResult.error) {
    (salesResult.data || []).forEach((sale: any) => {
      const entry = summary[sale.register_id];
      if (!entry) return;
      entry.salesCount += 1;
      if (sale.payment_method === "cash" && sale.payment_status === "paid") {
        entry.cashSales += Number(sale.total) || 0;
      }
    });
  }

  if (!expensesResult.error) {
    (expensesResult.data || []).forEach((expense: any) => {
      const entry = summary[expense.register_id];
      if (!entry) return;
      entry.expenses += Number(expense.amount) || 0;
    });
  }

  return summary;
}
