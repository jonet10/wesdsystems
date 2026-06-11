# Audit du module Auto Parts — Wesd Systems

**Date :** 10 juin 2026  
**Version :** 1.0  
**Objet :** Inventaire complet des menus, pages, fonctionnalités et composants du module Pièces Auto.

---

## 1. Architecture générale

| Élément | Valeur |
|---|---|
| Nombre de pages | 15 |
| Nombre de fichiers module (services, hooks, composants, types) | 25 |
| Routes | 15 (toutes sous `/auto-parts/`) |
| Éléments de navigation latérale | 15 |
| Point d'entrée auth | `ProtectedRoute` avec permissions granulaires |
| Base de données | Supabase (tables dédiées `auto_parts_*`) |

---

## 2. Routes et permissions

| # | Route | Page | Permission requise | Rôle |
|---|---|---|---|---|
| 1 | `/auto-parts` | Dashboard | `DASHBOARD_VIEW` | tous |
| 2 | `/auto-parts/products` | Produits | `PRODUCTS_READ` | tous |
| 3 | `/auto-parts/categories` | Catégories | `CATEGORIES_MANAGE` | tous |
| 4 | `/auto-parts/brands` | Marques | `BRANDS_MANAGE` | tous |
| 5 | `/auto-parts/models` | Modèles | `MODELS_MANAGE` | tous |
| 6 | `/auto-parts/compatibilities` | Compatibilités | `COMPATIBILITIES_MANAGE` | tous |
| 7 | `/auto-parts/suppliers` | Fournisseurs | `SUPPLIERS_MANAGE` | tous |
| 8 | `/auto-parts/clients` | Clients | `CLIENTS_READ` | tous |
| 9 | `/auto-parts/pos` | POS / Caisse | `POS_VIEW` | tous |
| 10 | `/auto-parts/purchases` | Achats | `PURCHASES_MANAGE` | tous |
| 11 | `/auto-parts/stock-movements` | Mouvements de stock | `STOCK_VIEW` | tous |
| 12 | `/auto-parts/reports` | Rapports | `REPORTS_VIEW` | admin |
| 13 | `/auto-parts/returns` | Retours | `RETURNS_MANAGE` | tous |
| 14 | `/auto-parts/settings` | Paramètres | `SETTINGS_MANAGE` | admin |
| 15 | `/auto-parts/staff` | Employés | `STAFF_MANAGE` | admin |

---

## 3. Menu latéral (navigation)

| # | Icône | Libellé | Path |
|---|---|---|---|
| 1 | `LayoutDashboard` | Dashboard | `/auto-parts` |
| 2 | `Package` | Produits | `/auto-parts/products` |
| 3 | `Layers` | Catégories | `/auto-parts/categories` |
| 4 | `Truck` | Marques | `/auto-parts/brands` |
| 5 | `Wrench` | Modèles | `/auto-parts/models` |
| 6 | `Users` | Clients | `/auto-parts/clients` |
| 7 | `Truck` | Fournisseurs | `/auto-parts/suppliers` |
| 8 | `ShoppingBag` | POS / Caisse | `/auto-parts/pos` |
| 9 | `Package` | Achats | `/auto-parts/purchases` |
| 10 | `ArrowLeftRight` | Retours | `/auto-parts/returns` |
| 11 | `UserCog` | Employés | `/auto-parts/staff` |
| 12 | `Layers` | Stock | `/auto-parts/stock-movements` |
| 13 | `Workflow` | Compatibilités | `/auto-parts/compatibilities` |
| 14 | `TrendingUp` | Rapports | `/auto-parts/reports` |
| 15 | `Settings` | Paramètres | `/auto-parts/settings` |

---

## 4. Analyse détaillée des pages

### 4.1 Dashboard — `/auto-parts`

**Type :** Read-only (analytique)  
**Boîtes de dialogue :** 0

**Indicateurs (8 cartes métriques) :**
- **Pièces totales** — icône `Package` (bleu)
- **Valeur du stock** (HTG) — icône `DollarSign` (vert) — *caché sans `STOCK_MANAGE`*
- **Ruptures de stock** — icône `AlertTriangle` (rouge)
- **Stock faible** — icône `AlertTriangle` (ambre)
- **Ventes du jour** (HTG) — icône `TrendingUp` (indigo)
- **Ventes du mois** (HTG) — icône `ShoppingCart` (émeraude)
- **Achats du mois** — icône `Truck` (violet) — *caché sans `PURCHASES_MANAGE`*
- **Commandes en attente** — icône `Receipt` (orange) — *caché sans `PURCHASES_MANAGE`*

**Graphiques (Chart.js) :**
- **Barres** : Ventes mensuelles (12 mois, HTG)
- **Donut** : Répartition par catégorie (10 couleurs)

**Sources de données :**
- Session staff : RPCs SECURITY DEFINER (`auto_parts_dashboard_counts`, `auto_parts_monthly_sales`, `auto_parts_category_repartition`)
- Session admin : Requêtes Supabase directes filtrées par business_id

---

### 4.2 Produits — `/auto-parts/products`

**Type :** CRUD complet  
**Permissions :** `PRODUCTS_MANAGE` pour les actions

**Filtres :**
- Barre de recherche (nom ou SKU)
- Filtre par catégorie (liste déroulante)

**Colonnes du tableau :**
| Colonne | Type | Détail |
|---|---|---|
| Nom | Texte | |
| SKU | Texte | "-" si vide |
| Catégorie | Texte | "-" si nulle |
| Prix vente | Monnaie (HTG) | |
| Prix revient | Monnaie (HTG) | |
| Stock | Badge couleur | `destructive` (≤0), `secondary` (≤ min_stock), `default` |
| Actif | Oui/Non | |
| Actions | Boutons | ✏️ Modifier, 🗑️ Supprimer (si `PRODUCTS_MANAGE`) |

**Dialogue de création/édition** (`max-w-xl`, scrollable `max-h-[60vh]`) :
| Champ | Type | Largeur |
|---|---|---|
| Nom | Texte | pleine |
| Description | Textarea | pleine |
| Catégorie | Select (catégories) | pleine |
| SKU | Texte | 1/2 |
| Code-barres | Texte | 1/2 |
| Prix de vente | Nombre (step 0.01) | 1/2 |
| Prix de revient | Nombre (step 0.01) | 1/2 |
| Stock minimum | Nombre | 1/2 |
| Stock maximum | Nombre (optionnel) | 1/2 |
| Emplacement | Texte | 1/2 |
| Notes | Textarea | pleine |
| Produit actif | Switch | pleine |

**Boutons :** "Annuler" | "Enregistrer"

---

### 4.3 Catégories — `/auto-parts/categories`

**Type :** CRUD complet

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Nom | |
| Description | "-" si vide |
| Ordre | Numéro d'affichage |
| Actions | ✏️ 🗑️ |

**Dialogue de création/édition :**
| Champ | Type |
|---|---|
| Nom | Texte |
| Description | Textarea |
| Ordre d'affichage | Nombre |

**Boutons :** "Annuler" | "Enregistrer"

---

### 4.4 Marques — `/auto-parts/brands`

**Type :** CRUD complet  
**Particularité :** Pas de dépendance business_id (marques globales)

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Nom | |
| Actions | ✏️ 🗑️ |

**Dialogue de création/édition :**
| Champ | Type |
|---|---|
| Nom | Texte |

**Boutons :** "Annuler" | "Enregistrer"

---

### 4.5 Modèles — `/auto-parts/models`

**Type :** CRUD complet  
**Particularité :** Marques globales, modèles liés aux marques

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Nom | |
| Marque | Nom de la marque (relation) |
| Début | Année début |
| Fin | Année fin |
| Actions | ✏️ 🗑️ |

**Dialogue de création/édition :**
| Champ | Type |
|---|---|
| Marque | Select (listBrands) |
| Nom du modèle | Texte |
| Année début | Nombre (optionnel) |
| Année fin | Nombre (optionnel) |

**Boutons :** "Annuler" | "Enregistrer"

---

### 4.6 Compatibilités — `/auto-parts/compatibilities`

**Type :** Création + Suppression (pas de modification)  
**Particularité :** Listes déroulantes en cascade (marque → modèle)

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Produit | Nom (relation) |
| Marque | Nom |
| Modèle | Nom |
| Année début | |
| Année fin | |
| Moteur | |
| Actions | 🗑️ Supprimer seulement |

**Dialogue de création :**
| Champ | Type | Détail |
|---|---|---|
| Produit | Select | Nom + SKU |
| Marque | Select | Reset modèle au changement |
| Modèle | Select | Chargé dynamiquement selon marque |
| Année début | Nombre | |
| Année fin | Nombre | |
| Moteur | Texte | |
| Notes | Texte | |

**Boutons :** "Annuler" | "Ajouter"

---

### 4.7 Fournisseurs — `/auto-parts/suppliers`

**Type :** CRUD complet

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Nom | |
| Téléphone | "-" si vide |
| Email | "-" si vide |
| Pays | |
| Devise | |
| Actif | Oui/Non |
| Actions | ✏️ 🗑️ |

**Dialogue de création/édition** (`max-w-lg`, scrollable) :
| Champ | Type | Largeur | Défaut |
|---|---|---|---|
| Nom | Texte | pleine | |
| Téléphone | Texte | 1/2 | |
| WhatsApp | Texte | 1/2 | |
| Email | Email | pleine | |
| Adresse | Texte | pleine | |
| Pays | Texte | 1/2 | "Haiti" |
| Devise | Texte | 1/2 | "HTG" |
| Notes | Textarea | pleine | |
| Fournisseur actif | Switch | pleine | true |

**Boutons :** "Annuler" | "Enregistrer"

---

### 4.8 Clients — `/auto-parts/clients`

**Type :** CRUD complet  
**Permissions :** `CLIENTS_MANAGE` pour les actions

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Nom | |
| Téléphone | "-" si vide |
| Email | "-" si vide |
| Compagnie | "-" si vide |
| Actions | ✏️ 🗑️ (si `CLIENTS_MANAGE`) |

**Dialogue de création/édition** (`max-w-lg`) :
| Champ | Type | Largeur |
|---|---|---|
| Nom | Texte | pleine |
| Téléphone | Texte | 1/2 |
| WhatsApp | Texte | 1/2 |
| Email | Email | pleine |
| Adresse | Texte | pleine |
| Compagnie | Texte | pleine |
| Notes | Textarea | pleine |

**Boutons :** "Annuler" | "Enregistrer"

---

### 4.9 POS / Caisse — `/auto-parts/pos`

**Type :** Création (ventes)  
**Complexité :** Page la plus complexe du module

**Disposition :** 2 panneaux (gauche : produits, droite : panier)

**Panneau gauche — Produits :**
- Barre de recherche (nom ou SKU)
- Filtre par catégorie (Select avec "Toutes")
- Grille de cartes produit (2-4 colonnes responsive) :
  - Nom (tronqué)
  - Prix unitaire (gras, couleur primaire)
  - Badge stock : `destructive` (≤0), `secondary` (>0)
  - Clic → ajoute au panier
- Seuls les produits actifs sont affichés

**Panneau droit — Panier :**
| Section | Contenu |
|---|---|
| En-tête | "Panier (N)" |
| Recherche client | Input avec suggestions (searchClients), Badge client sélectionné |
| Articles | Liste scrollable : nom, PU, contrôles qty (-/N/+), total ligne, 🗑️ |
| Totaux | Sous-total, Remise (si >0, vert), TVA (si >0), **Total** (gras) |
| Paiement | Bouton "Payer {total}" → dialogue de paiement |

**Dialogue de paiement :**
| Champ | Type | Options |
|---|---|---|
| Remise | Select + Nombre | Aucune / % / Montant |
| TVA (%) | Nombre | |
| Caissier(ère) | Select ou Texte | Liste employés (caissier/manager/admin) ou auto si staff session |
| Moyen de paiement | Select | cash, card, transfer, moncash, natcash |
| Total à payer | Texte (gras, grand) | |

**Dialogue de reçu :**
- Style reçu imprimé (300px, police monospace, fond blanc)
- En-tête : "Pièces Auto", numéro facture, date, caissier, client
- Lignes : Article, Qté, Prix, Total
- Totaux : sous-total, remise (rouge), TVA, **TOTAL**
- Méthode de paiement
- Pied : "Merci de votre visite!"
- Boutons : "Fermer" | "Imprimer" (printReceipt)

**Fonctionnalités clés :**
- Calculs temps réel (useMemo) : sous-total, remise, taxe, total
- Remise plafonnée au sous-total
- Panier persistant pendant les dialogues
- Auto-sélection du staff si session staff active
- Recherche client avec autocomplétion

---

### 4.10 Achats — `/auto-parts/purchases`

**Type :** CRUD complet  
**Particularité :** Workflow de statuts, lignes d'articles

**Statuts disponibles :**
| Statut | Badge |
|---|---|
| draft (Brouillon) | outline |
| pending (En attente) | secondary |
| confirmed (Confirmée) | default |
| preparing (Préparation) | default |
| shipped (Expédiée) | default |
| delivered (Livrée) | default |
| cancelled (Annulée) | destructive |

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Réf. | Numéro de référence |
| Fournisseur | Nom |
| Total | Monnaie formatée |
| Statut | Select inline + Badge couleur |
| Date | Format fr-FR |
| Actions | ✏️ 🗑️ |

**Dialogue de création/édition** (`max-w-2xl`, scrollable) :
| Section | Champ | Type |
|---|---|---|
| Infos | Fournisseur | Select |
| | Référence | Texte |
| | Notes | Textarea |
| Articles | Lignes d'articles | |
| | Produit | Recherche avec autocomplétion |
| | Quantité | Nombre (width 20) |
| | Prix unitaire | Nombre (step 0.01, width 24) |
| | Supprimer ligne | 🗑️ |
| | Ajouter ligne | Bouton "Ajouter" (+), icône `Plus` |
| Total | Total calculé | Affiché en bas |

**Dialogue de confirmation suppression :**
- Titre : "Confirmer la suppression"
- Message : référence ou ID
- "Cette action est irréversible."
- Boutons : "Annuler" | "Supprimer" (destructive)

**Fonctionnalités :**
- Changement de statut inline (Select dans la ligne du tableau)
- Gestion dynamique des lignes d'articles
- Recherche produit avec autocomplétion

---

### 4.11 Mouvements de stock — `/auto-parts/stock-movements`

**Type :** Création + Lecture (pas de modification/suppression)  
**Permissions :** `STOCK_MANAGE` pour la création

**Types de mouvements :**
| Type | Badge | Créable ? |
|---|---|---|
| in (Entrée) | default | ✅ Oui |
| out (Sortie) | destructive | ✅ Oui |
| adjustment (Ajustement) | secondary | ✅ Oui |
| sale (Vente) | destructive | ❌ Non (historique) |
| return (Retour) | outline | ❌ Non (historique) |

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Produit | Nom (relation) |
| Type | Badge couleur |
| Quantité | Vert si positif (+), rouge si négatif |
| Référence | "-" si vide |
| Date | Format fr-FR |

**Dialogue de création :**
| Champ | Type |
|---|---|
| Produit | Recherche avec sélection |
| Type | Select (Entrée, Sortie, Ajustement) |
| Quantité | Nombre (min 1) |
| Prix unitaire (optionnel) | Nombre (step 0.01) |
| Référence | Texte |
| Notes | Texte |

**Fonctionnalités :**
- Quantité auto-négativée pour les sorties
- Recherche produit avec résultats inline
- Quantité codée par couleur (vert positif, rouge négatif)

---

### 4.12 Rapports — `/auto-parts/reports`

**Type :** Read-only (analytique)  
**Onglets :** 3

**Onglet 1 — Ventes (défaut) :**
- Graphique barres : Ventes mensuelles (bleu)
- Graphique donut : Ventes par catégorie (8 couleurs)

**Onglet 2 — Top produits :**
- Tableau HTML : "Top 10 produits les plus vendus"
- Colonnes : Produit, Quantité

**Onglet 3 — Alertes :**
- Liste des alertes stock
- Chaque alerte : Badge type, Message, Timestamp
- Alertes lues : opacité réduite (60 %)
- Types : `out_of_stock` (Rupture, destructive), `low_stock` (Stock faible, secondary)

**Sources de données :**
- Alertes via `listAlerts`
- Ventes annuelles via requête Supabase directe
- Top 10 via agrégation `auto_parts_sale_items`
- Ventes catégories via agrégation

---

### 4.13 Employés — `/auto-parts/staff`

**Type :** CRUD complet  
**Permissions :** `STAFF_MANAGE`

**Rôles disponibles :**
| Rôle | Badge |
|---|---|
| admin (Administrateur) | destructive |
| manager (Gérant) | default |
| cashier (Caissier(ère)) | secondary |

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Nom | |
| Identifiant | "-" si vide |
| Email | "-" si vide |
| Téléphone | "-" si vide |
| Rôle | Badge couleur |
| Actions | ✏️ 🗑️ |

**Dialogue de création/édition :**

*Vue formulaire :*
| Champ | Type | Détail |
|---|---|---|
| Nom * | Texte | Requis, auto-génère l'identifiant |
| Identifiant | Texte | Généré automatiquement, modifiable |
| Email | Texte | 1/2 largeur |
| Téléphone | Texte | 1/2 largeur |
| Rôle | Select | Caissier(ère), Gérant, Administrateur |
| Code PIN | Password (6 chiffres max) | Généré automatiquement si vide |

*Vue succès* (après création) :
- ✅ "Employé créé avec succès!"
- Identifiant affiché dans `<code>`
- Code PIN affiché dans `<code>`
- "Transmettez ces informations à l'employé."
- Bouton "Fermer"

**Dialogue de confirmation suppression :**
- Titre : "Confirmer la suppression"
- Message : "Supprimer l'employé {name} ?"
- Boutons : "Annuler" | "Supprimer" (destructive)

**Fonctionnalités :**
- Génération automatique d'identifiant (slug + 4 chiffres aléatoires)
- Génération automatique de PIN 6 chiffres
- Écran de succès avec identifiants après création
- Drapeau `usernameTouched` pour ne pas écraser les modifications manuelles

---

### 4.14 Retours — `/auto-parts/returns`

**Type :** Création + Lecture (immuable)  
**Permissions :** `RETURNS_MANAGE` pour la création

**Colonnes du tableau :**
| Colonne | Détail |
|---|---|
| Date | Format fr-FR |
| Produit | Nom (relation) |
| Qté retournée | Vert, préfixe "+" |
| Facture | Numéro de facture |
| Client | Nom (relation vente) |
| Motif | Texte |

**Dialogue de création de retour** (`max-w-2xl`) :

*Section recherche de facture :*
- Champ de recherche : "Rechercher par numéro de facture (INV-...)"
- Bouton "Chercher"
- Touche Entrée déclenche la recherche

*Section vente trouvée :*
- Numéro de facture (gras)
- Nom du client
- Badge statut retour : `full` (Retourné, destructive), `partial` (Partiel, secondary), "Aucun retour" (outline)
- Total et date

*Section articles à retourner :*
- Liste des articles de la vente d'origine
- Chaque ligne : Case à cocher, Nom produit (tronqué), PU, "Max: N", Input quantité
- Survol : fond grisé

*Raison :*
- Textarea (optionnel), placeholder "Raison du retour..."

*Résumé :*
- "Articles sélectionnés: N"
- "Quantité totale: N"

**Boutons :** "Annuler" | "Valider le retour" (désactivé si aucun article)

**Traitement :**
- Filtre les articles avec quantité > 0
- Valide au moins un article sélectionné
- Appelle `processReturn` (sale_id, items)
- Message succès avec statut (full/partial)

---

## 5. Composants réutilisables du module

### 5.1 `AutoPartsDataTable`
Tableau de données générique utilisé par toutes les pages CRUD.

### 5.2 `AutoPartsPageHeader`
En-tête de page avec titre, sous-titre et bouton d'action (optionnel).

### 5.3 `ProductSelect`
Sélecteur de produit avec recherche et affichage nom + SKU.

---

## 6. Services (CRUD)

| Service | Fichier | Opérations |
|---|---|---|
| Produits | `services/products.ts` | list, create, update, delete, search |
| Catégories | `services/categories.ts` | list, create, update, delete |
| Marques | `services/brands.ts` | list, create, update, delete |
| Modèles | `services/models.ts` | list, create, update, delete |
| Compatibilités | `services/compatibilities.ts` | list, create, delete |
| Fournisseurs | `services/suppliers.ts` | list, create, update, delete |
| Clients | `services/clients.ts` | list, create, update, delete, search |
| Ventes | `services/sales.ts` | create, get (by id) |
| Achats | `services/purchases.ts` | list, create, update, updateStatus, delete |
| Mouvements stock | `services/stock-movements.ts` | list, create |
| Retours | `services/returns.ts` | list, processReturn |
| Staff | `services/staff.ts` | list, create, update, delete |
| Alertes | `services/alerts.ts` | list |
| Session staff | `services/staff-session-helper.ts` | Helpers |

---

## 7. Sessions et authentification

Le module supporte deux modes de connexion :

### 7.1 Session Supabase (admin)
- Utilisateur connecté via Supabase Auth
- Rôle `salon_admin` avec `business_type = 'auto_parts'`
- Routes protégées par `ProtectedRoute` avec permissions

### 7.2 Session staff (caissier/manager)
- Authentification locale via identifiant + PIN
- Stockée dans `localStorage` via `staff-session.ts`
- Limité aux routes `/auto-parts/*`
- Si accès à une route hors `/auto-parts/` → redirigé vers `/auto-parts/pos`
- Permissions filtrées via `filterMenuByPermissions`
- Utilise des RPCs SECURITY DEFINER pour les requêtes DB (contourne RLS)

---

## 8. Points d'attention

| Problème | Fichier | Recommandation |
|---|---|---|
| `confirm()` natif pour suppression | Products, Categories, Brands, Models, Suppliers, Clients, Compatibilities | Remplacer par un dialogue de confirmation stylisé (comme dans Purchases et Staff) |
| Pas de pagination côté serveur | Tous les tableaux | Les données sont chargées en totalité → risque de performance avec beaucoup d'entrées |
| Pas de débounce sur la recherche | Products, POS | La recherche se déclenche à chaque frappe → optimisable |
| Pas de filtre par statut pour les achats | Purchases | Utile pour les commandes en attente/livrées |
| Marques et modèles globaux | brands.ts, models.ts | Pas de filtre par business_id → partagé entre toutes les entreprises |
| Pas d'édition des retours | returns.ts | Volontaire (immuable) mais peut bloquer en cas d'erreur |
| `listSales` importé dynamiquement | returns.ts | Déjà optimisé (dynamic import) |
| `any` dans les types services | Plusieurs services | Migrer vers des types stricts |

---

## 9. Statistiques du module

| Métrique | Valeur |
|---|---|
| Lignes de code (pages) | ~5 500 |
| Lignes de code (module) | ~2 500 |
| Nombre de dialogues | 14 (création/édition/confirmation) |
| Graphiques Chart.js | 4 (Dashboard + Reports) |
| Fonctions de génération auto | 2 (username, PIN) |
| Permissions distinctes | 15 |
| Dépendances externes | Chart.js, react-chartjs-2, sonner, framer-motion |
