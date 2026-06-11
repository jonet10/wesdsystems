# Anchored Context — Wesd Session

## Current Task
Auto Parts module audit et amélioration — Phase 1 terminée.

## Progress
### Done
- **Phase 1 complète** (Data Isolation multi-entreprise)
  - Migration SQL `20260726_fix_auto_parts_data_isolation.sql` : corrigé 8 RPCs SECURITY DEFINER pour accepter/filtrer par `p_business_id`
  - **13 services** mis à jour : fallbacks sans businessId supprimés, `business_id` ajouté aux update/delete/create, signatures renforcées
  - **Dashboard.tsx** : Path B (else branch sans filtre business_id) supprimée — charge uniquement via RPCs sécurisés
  - **Reports.tsx** : `bFilter` remplacé par `.eq("business_id", businessId)` ; agrégation `sum:quantity` buggée remplacée par JS-side
  - **5 callers** réparés : Clients, Suppliers, Compatibilities (×2), POS
  - Compilation TypeScript : **0 erreurs**
- Audit complet du module Auto Parts (rapport `AUDIT_AUTO_PARTS_PRE_IMPLEMENTATION.md`)
- Paiements manuels MonCash : implémentation complète alignée sur spec utilisateur (10 étapes)

### Blocked
- (none)

## Phase 1 Summary
| Faille | Correctif | Fichiers |
|--------|-----------|----------|
| 7 RPCs SECURITY DEFINER sans p_business_id | Ajout param + filtre | `20260726_fix_auto_parts_data_isolation.sql` |
| 20+ branches fallback sans businessId | Branches supprimées | 13 fichiers service |
| Dashboard.tsx Path B (0 filtre business_id) | Else branch supprimée | `Dashboard.tsx` |
| Reports.tsx bFilter (business_id.is.null) | `.eq("business_id", businessId)` + fix sum | `Reports.tsx` |
| Callers incompatibles | 5 corrections signatures | Clients, Suppliers, Compatibilities, POS |

## Next Steps (for next session)
1. **Phase 2** : Permissions COST_VIEW/PROFIT_VIEW — gater cost_price et colonnes bénéfices selon rôle
2. **Phase 3** : Achat à crédit
3. **Phase 4** : Paiements partiels
4. **Phase 5** : Comptes clients
5. **Phase 6** : Dashboard financier
6. **Phase 7** : Commandes fournisseur
7. **Phase 8** : Scanner code-barres
8. **Phase 9** : Rapport marketplace inter-entreprises
9. **Phase 10** : Rapport final

## Key Decisions
- Brands/Models : données partagées (RLS read pour tout auth user) — pas de filtre businessId nécessaire
- `searchClients` : appels POS avec businessId optionnel (backward compat)
- Aucune nouvelle table créée — seules les migrations correctives
