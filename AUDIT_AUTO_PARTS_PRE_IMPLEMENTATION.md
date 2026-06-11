# Rapport d'audit pré-implémentation — Module Auto Parts

**Date :** 10 juin 2026  
**Statut :** AVANT toute modification  

---

## Résumé des vulnérabilités critiques

### 🔴 CRITIQUE — 7 failles de sécurité (RPCs SECURITY DEFINER sans filtre business_id)

Ces fonctions bypassent RLS et permettent de lire/modifier les données de TOUTES les entreprises :

| RPC | Service → Fichier | Impact |
|---|---|---|
| `auto_parts_get_product` | `getProduct` → products.ts | Lire n'importe quel produit |
| `auto_parts_get_sale` | `getSale` → sales.ts | Lire n'importe quelle vente (données financières) |
| `auto_parts_search_clients` | `searchClients` → clients.ts | Chercher des clients de toutes les entreprises |
| `update_auto_parts_purchase` | `updatePurchase` → purchases.ts | Modifier n'importe quel achat |
| `delete_auto_parts_purchase` | `deletePurchase` → purchases.ts | Supprimer n'importe quel achat |
| `update_auto_parts_staff` | `updateStaff` → staff.ts | Modifier n'importe quel employé (rôle, PIN) |
| `delete_auto_parts_staff` | `deleteStaff` → staff.ts | Supprimer n'importe quel employé |

### 🔴 CRITIQUE — Dashboard.tsx (Path B, admin session)

Les requêtes directes dans le Dashboard **ne filtrent PAS par business_id**. Le helper `bFilter` est défini mais jamais appelé (ligne 64). Un admin voit les données de TOUTES les entreprises.

### 🟠 HAUTE — 20+ fonctions service sans filtre business_id

| Pattern | Nombre | Exemples |
|---|---|---|
| `list*()` sans filtre quand businessId est null | 9 | `listProducts`, `listCategories`, `listClients`, `listSuppliers`, `listSales`, `listPurchases`, `listStockMovements`, `listStaff`, `listAlerts` |
| `update*` / `delete*` sans `.eq("business_id", ...)` | 11 | `updateProduct`, `deleteProduct`, `updateCategory`, `deleteCategory`, `updateClient`, `deleteClient`, `updateSupplier`, `deleteSupplier`, `updatePurchaseStatus`, `markAlertRead`, `deleteCompatibility` |
| `create*` sans business_id explicite | 3 | `createClient`, `createSupplier`, `createCompatibility` |

### 🟠 HAUTE — coût d'achat visible par les caissières

- `Products.tsx` : colonne `Prix revient` (cost_price) affichée à tous les rôles sans vérification de permission
- `Dashboard.tsx` : valeur du stock calculée avec `cost_price`, cachée seulement par `STOCK_MANAGE` mais court-circuité à `true` pour les sessions admin

### 🟠 HAUTE — pages sans aucune vérification de permission

| Page | Permissions manquantes |
|---|---|
| `Reports.tsx` | Aucun `hasAutoPartsPermission` |
| `Staff.tsx` | Aucun `hasAutoPartsPermission` |
| `Purchases.tsx` | Aucun `hasAutoPartsPermission` |
| `POS.tsx` | Aucun `hasAutoPartsPermission` |
| `StockMovements.tsx` | Pas de vérification sur la vue (seulement sur la création) |
| `Returns.tsx` | Pas de vérification sur la vue du tableau |

### 🟡 MOYENNE — `hasAutoPartsPermission` court-circuité

```typescript
// AuthContext.tsx - retourne TOUJOURS true pour les sessions Supabase
if (!!profile && isAuthenticated) { return true; }
```

Le système de permission frontend est **effectivement désactivé** pour les admins connectés via Supabase Auth. Il ne fonctionne que pour les sessions staff (PIN).

---

## Plan d'implémentation

### Phase 1 : Correction isolation multi-entreprises
1. Ajouter `p_business_id` aux 7 RPCs critiques + filtrer par business_id
2. Ajouter `.eq("business_id", businessId)` sur tous les update/delete services
3. Ajouter `business_id` explicite dans les inserts (createClient, createSupplier, createCompatibility)
4. Supprimer les fallbacks sans filtre (exiger businessId partout)
5. Corriger Dashboard.tsx (Path B) pour filtrer les requêtes directes
6. Corriger Reports.tsx (bFilter sur sale_items)
7. Supprimer le court-circuit `hasAutoPartsPermission` pour les sessions admin

### Phase 2 : Confidentialité coûts/bénéfices
1. Ajouter une permission `PROFIT_VIEW` et `COST_VIEW` dans le système
2. Gater la colonne `cost_price` dans Products.tsx
3. Gater `totalStockValue` dans Dashboard.tsx
4. Ajouter les vérifications de permission manquantes (Reports, Staff, Purchases, POS)

### Phase 3-7 : Nouvelles fonctionnalités
- Crédit client (table + UI)
- Paiements partiels (extension POS)
- Comptes clients (nouveau module)
- Dashboard financier (nouvel onglet)
- Commandes clients (table + UI)

### Phase 8 : Scanner codes-barres
### Phase 9 : Rapport architecture marketplace (analyse seulement)
### Phase 10 : Rapport final
