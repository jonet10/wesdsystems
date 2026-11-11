import { supabase } from "@/lib/supabase";
import type { PharmacyCustomer, PharmacyPrescription, PharmacySale, PharmacySaleItem } from "../types";
import { getPharmacyBusinessId } from "./productService";
import { whatsappService } from "./whatsappService";

export const salesService = {
  // --- CUSTOMERS / PATIENTS ---
  async getCustomers(explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_customers")
      .select("*")
      .eq("business_id", businessId)
      .order("first_name");
    if (error) throw error;
    return data as PharmacyCustomer[];
  },

  async createCustomer(payload: Partial<PharmacyCustomer>) {
    const businessId = getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_customers")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as PharmacyCustomer;
  },

  async updateCustomer(id: string, payload: Partial<PharmacyCustomer>) {
    const { data, error } = await supabase
      .from("pharmacy_customers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as PharmacyCustomer;
  },

  // --- PRESCRIPTIONS ---
  async getPrescriptions(explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_prescriptions")
      .select("*, customer:customer_id(*)")
      .eq("business_id", businessId)
      .order("prescription_date", { ascending: false });
    if (error) throw error;
    return data as PharmacyPrescription[];
  },

  async createPrescription(payload: Partial<PharmacyPrescription>) {
    const businessId = getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_prescriptions")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as PharmacyPrescription;
  },

  // --- SALES (POS) ---
  // A real production app would use an RPC call for atomicity to handle the FEFO logic.
  // Here we'll do the logic on the frontend: find the oldest batches and deplete them.
  async processSale(sale: Partial<PharmacySale>, cart: any[], explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();

    // 0. Valider le panier et le stock AVANT de créer la vente.
    // Sans ce contrôle, une vente pouvait être enregistrée (et apparaître au
    // tableau de bord) alors que le produit était en rupture de stock.
    if (!cart.length) {
      throw new Error("Le panier est vide.");
    }

    for (const item of cart) {
      if (!item.product_id) {
        throw new Error("Produit invalide dans le panier.");
      }
      if (!(Number(item.quantity) > 0)) {
        throw new Error(`Quantité invalide pour ${item.name || "un produit"}.`);
      }
    }

    const productIds = Array.from(new Set(cart.map((item) => item.product_id)));
    const { data: stockRows, error: stockError } = await supabase
      .from("pharmacy_products")
      .select("id, name, total_stock_quantity")
      .eq("business_id", businessId)
      .in("id", productIds);

    if (stockError) throw stockError;

    const stockById = new Map<string, { name: string; available: number }>();
    (stockRows || []).forEach((row: any) => {
      stockById.set(row.id, {
        name: row.name,
        available: Number(row.total_stock_quantity) || 0,
      });
    });

    for (const item of cart) {
      const product = stockById.get(item.product_id);
      if (!product) {
        throw new Error(`Produit introuvable : ${item.name || item.product_id}`);
      }
      if (Number(item.quantity) > product.available) {
        throw new Error(
          `Stock insuffisant pour ${product.name} : ${product.available} disponible(s), ${item.quantity} demandé(s).`
        );
      }
    }

    // 1. Create Sale
    const { data: newSale, error: saleErr } = await supabase
      .from("pharmacy_sales")
      .insert([{ ...sale, business_id: businessId }])
      .select()
      .single();
    if (saleErr) throw saleErr;

    // 2. Process Cart Items (FEFO Depletion with graceful fallback if no batches)
    for (const item of cart) {
      // Fetch batches for this product ordered by expiration date (FEFO)
      const { data: batches } = await supabase
        .from("pharmacy_batches")
        .select("*")
        .eq("business_id", businessId)
        .eq("product_id", item.product_id)
        .gt("current_quantity", 0)
        .order("expiration_date", { ascending: true });

      let remainingToFulfill = item.quantity;

      if (batches && batches.length > 0) {
        for (const batch of batches) {
          if (remainingToFulfill <= 0) break;

          const quantityToTakeFromBatch = Math.min(batch.current_quantity, remainingToFulfill);
          
          // Update batch quantity
          await supabase
            .from("pharmacy_batches")
            .update({ current_quantity: Math.max(0, batch.current_quantity - quantityToTakeFromBatch) })
            .eq("id", batch.id);

          // Create Sale Item for this specific batch
          await supabase
            .from("pharmacy_sale_items")
            .insert([{
              business_id: businessId,
              sale_id: newSale.id,
              product_id: item.product_id,
              batch_id: batch.id,
              quantity: quantityToTakeFromBatch,
              unit_price: item.unit_price,
              total_price: quantityToTakeFromBatch * item.unit_price
            }]);

          // Create Stock Movement (Out / Sale)
          await supabase
            .from("pharmacy_stock_movements")
            .insert([{
              business_id: businessId,
              product_id: item.product_id,
              batch_id: batch.id,
              type: "sale",
              quantity: quantityToTakeFromBatch,
              reference: `Sale ${newSale.receipt_number}`
            }]);

          remainingToFulfill -= quantityToTakeFromBatch;
        }
      }

      // If no batches exist or batch stock ran out, record the remaining sale item gracefully
      if (remainingToFulfill > 0) {
        await supabase
          .from("pharmacy_sale_items")
          .insert([{
            business_id: businessId,
            sale_id: newSale.id,
            product_id: item.product_id,
            batch_id: null,
            quantity: remainingToFulfill,
            unit_price: item.unit_price,
            total_price: remainingToFulfill * item.unit_price
          }]);

        await supabase
          .from("pharmacy_stock_movements")
          .insert([{
            business_id: businessId,
            product_id: item.product_id,
            batch_id: null,
            type: "sale",
            quantity: remainingToFulfill,
            reference: `Sale ${newSale.receipt_number}`
          }]);
      }
    }

    // Trigger WhatsApp large sale alert asynchronously
    if (newSale) {
      (async () => {
        try {
          const settings = await whatsappService.getSettings(businessId);
          if (settings && settings.enabled && settings.send_sales_alerts) {
            const totalAmt = Number(newSale.total || 0);
            const threshold = Number(settings.large_sale_threshold || 10000);
            
            if (totalAmt >= threshold) {
              // Fetch customer if linked
              let customerName = "Client de passage";
              if (newSale.customer_id) {
                const { data: cust } = await supabase
                  .from("pharmacy_customers")
                  .select("first_name, last_name")
                  .eq("id", newSale.customer_id)
                  .single();
                if (cust) customerName = `${cust.first_name} ${cust.last_name}`;
              }

              // Fetch cashier if linked
              let cashierName = "Caissier";
              if (newSale.created_by) {
                const { data: prof } = await supabase
                  .from("profiles")
                  .select("full_name")
                  .eq("id", newSale.created_by)
                  .single();
                if (prof) cashierName = prof.full_name || "Caissier";
              }

              const timeStr = new Date(newSale.created_at || new Date()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const msg = `🛒 Nouvelle Vente\n\nMontant : ${totalAmt.toLocaleString()} HTG\nClient : ${customerName}\nCaissier : ${cashierName}\nPaiement : ${newSale.payment_method === "cash" ? "Espèces" : newSale.payment_method === "card" ? "Carte Bancaire" : newSale.payment_method === "moncash" ? "MonCash" : "Autre"}\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;
              
              whatsappService.sendWhatsAppMessageAsync(businessId, msg, "sales_alert", newSale.branch_id || businessId);
            }
          }
        } catch (e) {
          console.error("[Sales Service] WhatsApp large sale alert error:", e);
        }
      })();
    }

    return newSale;
  },

  /**
   * Supprime définitivement une vente (erreur de saisie, vente de test...).
   * - restaure les quantités dans les lots concernés,
   * - supprime les mouvements de stock générés par la vente,
   * - supprime la vente (les lignes de vente et crédits liés suivent en cascade).
   *
   * Les totaux de caisse étant recalculés à partir des ventes, la caisse est
   * automatiquement corrigée après suppression.
   */
  async deleteSale(saleId: string, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();

    const { data: sale, error: saleError } = await supabase
      .from("pharmacy_sales")
      .select("id, receipt_number, register_id")
      .eq("id", saleId)
      .eq("business_id", businessId)
      .single();

    if (saleError) throw saleError;
    if (!sale) throw new Error("Vente introuvable");

    // 1. Restaurer le stock des lots utilisés par la vente.
    const { data: items, error: itemsError } = await supabase
      .from("pharmacy_sale_items")
      .select("product_id, batch_id, quantity")
      .eq("sale_id", saleId);

    if (itemsError) throw itemsError;

    for (const item of items || []) {
      if (!item.batch_id) continue;

      const { data: batch, error: batchError } = await supabase
        .from("pharmacy_batches")
        .select("id, current_quantity")
        .eq("id", item.batch_id)
        .maybeSingle();

      if (batchError) throw batchError;
      if (!batch) continue;

      const restored =
        Number(batch.current_quantity || 0) + Number(item.quantity || 0);

      const { error: updateError } = await supabase
        .from("pharmacy_batches")
        .update({ current_quantity: restored })
        .eq("id", item.batch_id);

      if (updateError) throw updateError;
    }

    // 2. Supprimer les mouvements de stock liés à cette vente.
    const { error: movementError } = await supabase
      .from("pharmacy_stock_movements")
      .delete()
      .eq("business_id", businessId)
      .eq("type", "sale")
      .eq("reference", `Sale ${sale.receipt_number}`);

    if (movementError) throw movementError;

    // 3. Supprimer la vente elle-même.
    const { error: deleteError } = await supabase
      .from("pharmacy_sales")
      .delete()
      .eq("id", saleId)
      .eq("business_id", businessId);

    if (deleteError) throw deleteError;

    // 4. Si la vente appartenait à une caisse déjà fermée, recalculer son
    //    rapprochement (les caisses ouvertes sont recalculées à l'affichage).
    if (sale.register_id) {
      try {
        const { data: register } = await supabase
          .from("pharmacy_cash_registers")
          .select("id, status, initial_amount, actual_amount")
          .eq("id", sale.register_id)
          .maybeSingle();

        if (register && register.status === "closed") {
          const [remainingSalesResult, expensesResult] = await Promise.all([
            supabase
              .from("pharmacy_sales")
              .select("total, payment_method, payment_status")
              .eq("business_id", businessId)
              .eq("register_id", register.id),
            supabase
              .from("pharmacy_expenses")
              .select("amount")
              .eq("business_id", businessId)
              .eq("register_id", register.id),
          ]);

          const cashSales = (remainingSalesResult.data || [])
            .filter(
              (row: any) =>
                row.payment_method === "cash" && row.payment_status === "paid",
            )
            .reduce((sum: number, row: any) => sum + (Number(row.total) || 0), 0);

          const expenses = (expensesResult.data || []).reduce(
            (sum: number, row: any) => sum + (Number(row.amount) || 0),
            0,
          );

          const expected =
            (Number(register.initial_amount) || 0) + cashSales - expenses;
          const actual =
            register.actual_amount === null || register.actual_amount === undefined
              ? null
              : Number(register.actual_amount);

          await supabase
            .from("pharmacy_cash_registers")
            .update({
              expected_amount: expected,
              difference: actual === null ? null : actual - expected,
            })
            .eq("id", register.id);
        }
      } catch (recalcError) {
        // La vente est déjà supprimée : on n'échoue pas à cause du recalcul.
        console.warn(
          "[Sales Service] Recalcul de caisse après suppression impossible:",
          recalcError,
        );
      }
    }

    return true;
  },

  async voidSale(saleId: string, cashierName: string, reason: string, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data: sale } = await supabase
      .from("pharmacy_sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (!sale) throw new Error("Vente introuvable");

    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const msg = `⚠️ Annulation de vente\n\nFacture : ${sale.receipt_number}\nMontant : ${Number(sale.total).toLocaleString()} HTG\nCaissier : ${cashierName}\nRaison : ${reason}\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;
    
    whatsappService.sendWhatsAppMessageAsync(businessId, msg, "void_alert", sale.branch_id || businessId);
    return true;
  },

  async returnProduct(saleId: string, productSelector: { id: string; name: string }, quantity: number, customerName: string, cashierName: string, reason: string, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data: sale } = await supabase
      .from("pharmacy_sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (!sale) throw new Error("Vente introuvable");

    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const msg = `↩️ Retour produit\n\nProduit : ${productSelector.name}\nQuantité : ${quantity}\nClient : ${customerName}\nCaissier : ${cashierName}\nRaison : ${reason}\nHeure : ${timeStr}\n\nWesdSystems Pharmacy`;

    whatsappService.sendWhatsAppMessageAsync(businessId, msg, "return_alert", sale.branch_id || businessId);
    return true;
  }
};
