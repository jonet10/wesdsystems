import { supabase } from "@/lib/supabase";
import type { BarProduct, BarCocktail, HotelRoom, HotelBooking, CartItem, PaymentMethod } from "../types";
import { HAITI_BAR_PRODUCTS, HAITI_COCKTAILS, HAITI_HOTEL_ROOMS } from "../data/haitiCatalog";

export const DEFAULT_BAR_BUSINESS_ID = "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

export const resolveBarBranchId = (branchId?: string | null, businessId?: string | null): string => {
  return branchId || businessId || DEFAULT_BAR_BUSINESS_ID;
};

const ROOMS_STORAGE_KEY_PREFIX = "wesd_bar_hotel_rooms_";
const BOOKINGS_STORAGE_KEY_PREFIX = "wesd_bar_hotel_bookings_";

export const barRestoService = {
  /**
   * Charger les catégories
   */
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from("bar_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn("Could not load bar_categories from Supabase:", err);
      return [];
    }
  },

  /**
   * Charger les produits du bar / restaurant pour la branche active.
   * Si aucun produit n'existe encore pour cette branche, auto-seed du catalogue Haïti !
   */
  async getProducts(branchId: string): Promise<BarProduct[]> {
    const effectiveId = resolveBarBranchId(branchId);
    try {
      const { data, error } = await supabase
        .from("bar_products")
        .select("*")
        .eq("branch_id", effectiveId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      if (!data || data.length === 0) {
        // Auto-seed du catalogue Haïti pour cette branche
        return await this.seedHaitiCatalog(effectiveId);
      }

      return data as BarProduct[];
    } catch (err) {
      console.warn("Falling back to local Haiti catalog preview:", err);
      return HAITI_BAR_PRODUCTS.map((p, index) => ({
        ...p,
        id: `local-prod-${index}`,
        branch_id: effectiveId,
        is_active: true,
      })) as BarProduct[];
    }
  },

  /**
   * Charger les cocktails
   */
  async getCocktails(branchId: string): Promise<BarCocktail[]> {
    const effectiveId = resolveBarBranchId(branchId);
    try {
      const { data, error } = await supabase
        .from("bar_cocktails")
        .select("*")
        .eq("branch_id", effectiveId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      if (!data || data.length === 0) {
        return await this.seedHaitiCocktails(effectiveId);
      }

      return data as BarCocktail[];
    } catch (err) {
      console.warn("Cocktails fallback:", err);
      return HAITI_COCKTAILS.map((c, index) => ({
        ...c,
        id: `local-cocktail-${index}`,
        branch_id: effectiveId,
        is_active: true,
      })) as BarCocktail[];
    }
  },

  /**
   * Initialiser / Réinitialiser le catalogue complet des produits vendus en Haïti
   */
  async seedHaitiCatalog(branchId: string): Promise<BarProduct[]> {
    const effectiveId = resolveBarBranchId(branchId);

    // Récupérer les catégories pour mapper les category_id
    const categories = await this.getCategories();
    const catMap = new Map<string, string>();
    categories.forEach((c) => catMap.set(c.name.toLowerCase(), c.id));

    const rowsToInsert = HAITI_BAR_PRODUCTS.map((p) => {
      const matchedCatId = p.category ? catMap.get(p.category.toLowerCase()) || null : null;
      const { category, item_type, ...cleanProduct } = p;
      return {
        ...cleanProduct,
        branch_id: effectiveId,
        category_id: matchedCatId,
        is_active: true,
      };
    });

    try {
      const { data, error } = await supabase
        .from("bar_products")
        .insert(rowsToInsert)
        .select();

      if (error) throw error;
      return (data || []) as BarProduct[];
    } catch (err) {
      console.error("Error inserting seed products:", err);
      return rowsToInsert.map((p, index) => ({
        ...p,
        id: `prod-${index}`,
      })) as BarProduct[];
    }
  },

  /**
   * Initialiser les cocktails haïtiens
   */
  async seedHaitiCocktails(branchId: string): Promise<BarCocktail[]> {
    const effectiveId = resolveBarBranchId(branchId);
    const rows = HAITI_COCKTAILS.map((c) => ({
      ...c,
      branch_id: effectiveId,
      is_active: true,
    }));

    try {
      const { data, error } = await supabase
        .from("bar_cocktails")
        .insert(rows)
        .select();
      if (error) throw error;
      return (data || []) as BarCocktail[];
    } catch (err) {
      console.error("Error inserting cocktails:", err);
      return rows.map((c, index) => ({
        ...c,
        id: `ck-${index}`,
      })) as BarCocktail[];
    }
  },

  /**
   * Gestion des chambres d'hôtel
   */
  getHotelRooms(branchId: string): HotelRoom[] {
    const effectiveId = resolveBarBranchId(branchId);
    const key = `${ROOMS_STORAGE_KEY_PREFIX}${effectiveId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    // Default seed
    const initialRooms: HotelRoom[] = HAITI_HOTEL_ROOMS.map((r, index) => ({
      ...r,
      id: `room-${effectiveId}-${r.room_number.replace(/\s+/g, "_")}`,
      branch_id: effectiveId,
      created_at: new Date().toISOString(),
    }));

    try {
      localStorage.setItem(key, JSON.stringify(initialRooms));
    } catch {
      // ignore
    }
    return initialRooms;
  },

  saveHotelRooms(branchId: string, rooms: HotelRoom[]) {
    const effectiveId = resolveBarBranchId(branchId);
    const key = `${ROOMS_STORAGE_KEY_PREFIX}${effectiveId}`;
    try {
      localStorage.setItem(key, JSON.stringify(rooms));
    } catch {
      // ignore
    }
  },

  updateRoomStatus(branchId: string, roomId: string, status: HotelRoom["status"], guestInfo?: { name?: string; phone?: string; checkIn?: string }) {
    const rooms = this.getHotelRooms(branchId);
    const updated = rooms.map((r) => {
      if (r.id === roomId) {
        return {
          ...r,
          status,
          current_guest_name: guestInfo ? guestInfo.name ?? null : status === "AVAILABLE" ? null : r.current_guest_name,
          current_guest_phone: guestInfo ? guestInfo.phone ?? null : status === "AVAILABLE" ? null : r.current_guest_phone,
          check_in_date: guestInfo?.checkIn ?? (status === "OCCUPIED" ? new Date().toISOString() : status === "AVAILABLE" ? null : r.check_in_date),
        };
      }
      return r;
    });
    this.saveHotelRooms(branchId, updated);
    return updated;
  },

  /**
   * Enregistrer une réservation / check-in
   */
  getBookings(branchId: string): HotelBooking[] {
    const effectiveId = resolveBarBranchId(branchId);
    const key = `${BOOKINGS_STORAGE_KEY_PREFIX}${effectiveId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  addBooking(branchId: string, booking: Omit<HotelBooking, "id" | "branch_id" | "created_at">): HotelBooking {
    const effectiveId = resolveBarBranchId(branchId);
    const key = `${BOOKINGS_STORAGE_KEY_PREFIX}${effectiveId}`;
    const newBooking: HotelBooking = {
      ...booking,
      id: `book-${Date.now()}`,
      branch_id: effectiveId,
      created_at: new Date().toISOString(),
    };

    const current = this.getBookings(branchId);
    const updated = [newBooking, ...current];
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // Mettre à jour le statut de la chambre
    this.updateRoomStatus(branchId, booking.room_id, "OCCUPIED", {
      name: booking.guest_name,
      phone: booking.guest_phone,
      checkIn: booking.check_in,
    });

    return newBooking;
  },

  checkOutRoom(branchId: string, roomId: string): HotelRoom[] {
    // Passer en mode "CLEANING"
    return this.updateRoomStatus(branchId, roomId, "CLEANING");
  },

  /**
   * Finaliser une vente en caisse (POS) avec déstockage
   */
  async processSale(
    branchId: string,
    cart: CartItem[],
    paymentMethod: PaymentMethod,
    subtotal: number,
    total: number
  ) {
    const effectiveId = resolveBarBranchId(branchId);

    // 1. Enregistrer la vente dans bar_sales
    const { data: sale, error: saleErr } = await supabase
      .from("bar_sales")
      .insert([
        {
          branch_id: effectiveId,
          sale_type: "BAR",
          payment_method: paymentMethod,
          subtotal,
          total,
          status: "COMPLETED",
        },
      ])
      .select("id, created_at")
      .single();

    if (saleErr || !sale?.id) {
      throw new Error(saleErr?.message || "Erreur de création de la vente");
    }

    // 2. Enregistrer les articles de la vente
    const items = cart.map((i) => ({
      sale_id: sale.id,
      ...(i.type === "product" || i.type === "food" ? { product_id: i.item_id } : {}),
      ...(i.type === "cocktail" ? { cocktail_id: i.item_id } : {}),
      item_type: i.sale_type === "CAISSE" ? "CAISSE" : i.sale_type === "COCKTAIL" ? "COCKTAIL" : "UNITE",
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.quantity * i.unit_price,
    }));

    await supabase.from("bar_sale_items").insert(items);

    // 3. Déstockage automatique des produits en stock
    for (const item of cart) {
      if (item.type === "product" || item.type === "food") {
        try {
          const { data: currentProd } = await supabase
            .from("bar_products")
            .select("id, stock_cases, stock_units, units_per_case")
            .eq("id", item.item_id)
            .single();

          if (currentProd) {
            let newCases = currentProd.stock_cases || 0;
            let newUnits = currentProd.stock_units || 0;
            const upc = currentProd.units_per_case || 24;

            if (item.sale_type === "CAISSE") {
              newCases = Math.max(0, newCases - item.quantity);
              newUnits = Math.max(0, newUnits - item.quantity * upc);
            } else {
              newUnits = newUnits - item.quantity;
              while (newUnits < 0 && newCases > 0) {
                newCases -= 1;
                newUnits += upc;
              }
              if (newUnits < 0) newUnits = 0;
            }

            await supabase
              .from("bar_products")
              .update({ stock_cases: newCases, stock_units: newUnits })
              .eq("id", item.item_id);

            await supabase.from("bar_stock_movements").insert({
              branch_id: effectiveId,
              product_id: item.item_id,
              movement_type: "VENTE",
              quantity_cases: item.sale_type === "CAISSE" ? item.quantity : 0,
              quantity_units: item.sale_type === "UNITE" ? item.quantity : 0,
              reference_id: sale.id,
              notes: `Vente POS Bar/Resto: ${item.name}`,
            });
          }
        } catch (stockErr) {
          console.warn("Stock movement update error:", stockErr);
        }
      }
    }

    return sale;
  },
};
