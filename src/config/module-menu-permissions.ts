export interface MenuPermissionItem {
  id: string;
  label: string;
  path: string;
  defaultRoles: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PHARMACIE
// ─────────────────────────────────────────────────────────────────────────────
export const PHARMACY_MENU_PERMISSIONS: MenuPermissionItem[] = [
  { id: "pharmacy:dashboard", label: "Tableau de Bord", path: "/pharmacie", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_accountant", "pharmacy_stock_manager"] },
  { id: "pharmacy:pos", label: "Point de Vente (Caisse POS)", path: "/pharmacie/pos", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_cashier"] },
  { id: "pharmacy:products", label: "Médicaments & Produits", path: "/pharmacie/products", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"] },
  { id: "pharmacy:categories", label: "Catégories", path: "/pharmacie/categories", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"] },
  { id: "pharmacy:batches", label: "Lots (Batches) & Péremption", path: "/pharmacie/batches", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"] },
  { id: "pharmacy:suppliers", label: "Fournisseurs", path: "/pharmacie/suppliers", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"] },
  { id: "pharmacy:purchases", label: "Achats & Commandes", path: "/pharmacie/purchases", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"] },
  { id: "pharmacy:stock", label: "Stock & Mouvements", path: "/pharmacie/stock", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"] },
  { id: "pharmacy:patients", label: "Patients", path: "/pharmacie/patients", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_accountant", "pharmacy_cashier"] },
  { id: "pharmacy:prescriptions", label: "Ordonnances", path: "/pharmacie/prescriptions", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_cashier"] },
  { id: "pharmacy:credits", label: "Crédits Clients", path: "/pharmacie/credits", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_accountant", "pharmacy_cashier"] },
  { id: "pharmacy:registers", label: "Gestion des Caisses", path: "/pharmacie/registers", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_accountant", "pharmacy_cashier"] },
  { id: "pharmacy:employees", label: "Employés & Accès", path: "/pharmacie/employees", defaultRoles: ["pharmacy_admin"] },
  { id: "pharmacy:reports", label: "Rapports & Ventes", path: "/pharmacie/reports", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_accountant"] },
  { id: "pharmacy:notifications", label: "Alertes WhatsApp", path: "/pharmacie/notifications", defaultRoles: ["pharmacy_admin", "pharmacy_manager", "pharmacy_accountant", "pharmacy_stock_manager"] },
  { id: "pharmacy:whatsapp-settings", label: "Paramètres WhatsApp", path: "/pharmacie/whatsapp-settings", defaultRoles: ["pharmacy_admin"] },
  { id: "pharmacy:settings", label: "Paramètres généraux", path: "/pharmacie/settings", defaultRoles: ["pharmacy_admin"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. SALON / SPA / BARBIER
// ─────────────────────────────────────────────────────────────────────────────
export const SALON_MENU_PERMISSIONS: MenuPermissionItem[] = [
  { id: "salon:dashboard", label: "Tableau de Bord", path: "/salon", defaultRoles: ["manager", "cashier", "barber"] },
  { id: "salon:appointments", label: "Rendez-vous & Planning", path: "/salon/appointments", defaultRoles: ["manager", "barber"] },
  { id: "salon:services", label: "Prestations & Menu", path: "/salon/services", defaultRoles: ["manager"] },
  { id: "salon:clients", label: "Fichier Clients", path: "/salon/clients", defaultRoles: ["manager", "cashier", "barber"] },
  { id: "salon:employees", label: "Équipe & Employés", path: "/salon/employees", defaultRoles: ["manager"] },
  { id: "salon:inventory", label: "Stock & Consommables", path: "/salon/inventory", defaultRoles: ["manager"] },
  { id: "salon:products", label: "Produits de vente", path: "/salon/products", defaultRoles: ["manager"] },
  { id: "salon:pos", label: "Caisse POS", path: "/salon/pos", defaultRoles: ["manager", "cashier"] },
  { id: "salon:promotions", label: "Promotions & Rabais", path: "/salon/promotions", defaultRoles: ["manager"] },
  { id: "salon:expenses", label: "Dépenses", path: "/salon/expenses", defaultRoles: ["manager"] },
  { id: "salon:reports", label: "Rapports & Clôtures", path: "/salon/reports", defaultRoles: ["manager", "cashier"] },
  { id: "salon:sales-analytics", label: "Analyses des Ventes", path: "/salon/sales-analytics", defaultRoles: ["manager"] },
  { id: "salon:branches", label: "Succursales", path: "/salon/branches", defaultRoles: ["manager"] },
  { id: "salon:settings", label: "Paramètres", path: "/salon/settings", defaultRoles: ["manager"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. PIÈCES AUTO (AUTO-PARTS)
// ─────────────────────────────────────────────────────────────────────────────
export const AUTO_PARTS_MENU_PERMISSIONS: MenuPermissionItem[] = [
  { id: "autoparts:dashboard", label: "Tableau de Bord", path: "/auto-parts", defaultRoles: ["admin", "manager", "cashier"] },
  { id: "autoparts:products", label: "Produits & Pièces", path: "/auto-parts/products", defaultRoles: ["admin", "manager", "cashier"] },
  { id: "autoparts:categories", label: "Catégories", path: "/auto-parts/categories", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:brands", label: "Marques", path: "/auto-parts/brands", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:models", label: "Modèles", path: "/auto-parts/models", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:clients", label: "Clients", path: "/auto-parts/clients", defaultRoles: ["admin", "manager", "cashier"] },
  { id: "autoparts:suppliers", label: "Fournisseurs", path: "/auto-parts/suppliers", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:pos", label: "Caisse POS", path: "/auto-parts/pos", defaultRoles: ["admin", "manager", "cashier"] },
  { id: "autoparts:invoices", label: "Factures", path: "/auto-parts/invoices", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:quotes", label: "Devis / Proformas", path: "/auto-parts/quotes", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:delivery-notes", label: "Bordereaux de livraison", path: "/auto-parts/delivery-notes", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:purchases", label: "Achats", path: "/auto-parts/purchases", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:returns", label: "Retours", path: "/auto-parts/returns", defaultRoles: ["admin", "manager", "cashier"] },
  { id: "autoparts:staff", label: "Personnel & Accès", path: "/auto-parts/staff", defaultRoles: ["admin"] },
  { id: "autoparts:stock", label: "Stock & Mouvements", path: "/auto-parts/stock-movements", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:compatibilities", label: "Compatibilités", path: "/auto-parts/compatibilities", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:reports", label: "Rapports", path: "/auto-parts/reports", defaultRoles: ["admin", "manager"] },
  { id: "autoparts:branches", label: "Succursales", path: "/auto-parts/branches", defaultRoles: ["admin"] },
  { id: "autoparts:settings", label: "Paramètres", path: "/auto-parts/settings", defaultRoles: ["admin"] },
];

/**
 * Retourne la liste des permissions de menu pour un module donné.
 */
export function getMenuPermissionsForModule(module: string): MenuPermissionItem[] {
  switch (module) {
    case "pharmacie":
      return PHARMACY_MENU_PERMISSIONS;
    case "salon":
    case "restaurant":
    case "bar":
      return SALON_MENU_PERMISSIONS;
    case "auto_parts":
      return AUTO_PARTS_MENU_PERMISSIONS;
    default:
      return [];
  }
}

/**
 * Retourne les IDs de permissions par défaut pour un rôle donné dans un module.
 */
export function getDefaultPermissionsForRole(module: string, role: string): string[] {
  const items = getMenuPermissionsForModule(module);
  const normalized = (role || "").toLowerCase();

  // Mapping des variantes de rôles pour la pharmacie
  let targetRole = normalized;
  if (module === "pharmacie") {
    if (normalized === "cashier" || normalized === "caissier" || normalized === "caissiere") targetRole = "pharmacy_cashier";
    if (normalized === "accountant" || normalized === "comptable") targetRole = "pharmacy_accountant";
    if (normalized === "stock_manager" || normalized === "responsable_stock") targetRole = "pharmacy_stock_manager";
    if (normalized === "manager" || normalized === "gerant" || normalized === "gerante") targetRole = "pharmacy_manager";
    if (normalized === "admin" || normalized === "administrateur") targetRole = "pharmacy_admin";
  }

  return items.filter((item) => item.defaultRoles.includes(targetRole) || item.defaultRoles.includes(normalized)).map((item) => item.id);
}
