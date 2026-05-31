import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nurwzdbjzkhsrlxehobq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnd6ZGJqemtoc3JseGVob2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMxMDMsImV4cCI6MjA5NDYyOTEwM30.kRwgj2fTRo6m5I0y6V3rd_qM3zkU7D2wrSU2SaWfgLc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COIFFURE_SERVICES = [
  { name: "Lavage simple",                               price_htg: 600,  sort_order: 1 },
  { name: "Mise en rouleau",                             price_htg: 800,  sort_order: 2 },
  { name: "Lavage complet (Bain d'huile + Bain de crème)", price_htg: 1200, sort_order: 3 },
  { name: "Lavage + Blow",                               price_htg: 1400, sort_order: 4 },
  { name: "Brûlage",                                     price_htg: 500,  sort_order: 5 },
  { name: "Bain de crème",                               price_htg: 700,  sort_order: 6 },
  { name: "Brushing (Blow)",                             price_htg: 1000, sort_order: 7 },
  { name: "Défrisage à chaud cheveux naturels",          price_htg: 2000, sort_order: 8 },
  { name: "Application permanente cheveux naturels",     price_htg: 2500, sort_order: 9 },
  { name: "Application permanente + Blow",               price_htg: 2800, sort_order: 10 },
  { name: "Application permanente",                      price_htg: 2200, sort_order: 11 },
  { name: "Application teinture",                        price_htg: 1800, sort_order: 12 },
  { name: "Application lace",                            price_htg: 1500, sort_order: 13 },
  { name: "Coupe Tara + cheveux",                        price_htg: 1200, sort_order: 14 },
  { name: "Lavage perruque",                             price_htg: 800,  sort_order: 15 },
  { name: "Coupe de cheveux femme",                      price_htg: 900,  sort_order: 16 },
  { name: "Tresse",                                      price_htg: 1600, sort_order: 17 },
  { name: "Réparation perruque",                         price_htg: 1000, sort_order: 18 },
  { name: "Make-up simple",                              price_htg: 1500, sort_order: 19 },
  { name: "Tissage",                                     price_htg: 3000, sort_order: 20 },
  { name: "Mèches",                                      price_htg: 2000, sort_order: 21 },
  { name: "Chignon",                                     price_htg: 1200, sort_order: 22 },
];

async function seed() {
  // 1. Trouver toutes les branches
  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select("id, name");

  if (branchError) {
    console.error("Erreur branches:", branchError.message);
    process.exit(1);
  }

  if (!branches || branches.length === 0) {
    console.error("Aucune branche trouvée.");
    process.exit(1);
  }

  console.log(`Branches trouvées: ${branches.map(b => b.name || b.id).join(", ")}`);

  for (const branch of branches) {
    console.log(`\n--- Traitement de la branche: ${branch.name || branch.id} ---`);

    // 2. Trouver la catégorie Coiffure / Beauté pour cette branche
    const { data: categories } = await supabase
      .from("salon_service_categories")
      .select("id, name")
      .eq("branch_id", branch.id)
      .ilike("name", "%coiffure%");

    let categoryId;

    if (!categories || categories.length === 0) {
      // Créer la catégorie si elle n'existe pas
      console.log("Catégorie 'Coiffure / Beauté' non trouvée, création...");
      const { data: newCat, error: catError } = await supabase
        .from("salon_service_categories")
        .insert({
          branch_id: branch.id,
          name: "Coiffure / Beauté",
          description: "Prestations de coiffure et beauté",
          icon: "scissors",
          color: "orange",
          sort_order: 3,
          is_active: true,
          metadata: { addon_options: [] },
        })
        .select("id")
        .single();

      if (catError) {
        console.error("Erreur création catégorie:", catError.message);
        continue;
      }
      categoryId = newCat.id;
      console.log(`Catégorie créée: ${categoryId}`);
    } else {
      categoryId = categories[0].id;
      console.log(`Catégorie trouvée: ${categories[0].name} (${categoryId})`);
    }

    // 3. Récupérer les services existants dans cette catégorie
    const { data: existing } = await supabase
      .from("salon_services")
      .select("name")
      .eq("branch_id", branch.id)
      .eq("category_id", categoryId);

    const existingNames = new Set((existing || []).map(s => s.name.trim().toLowerCase()));
    console.log(`Services existants: ${existingNames.size}`);

    // 4. Insérer les services manquants
    let inserted = 0;
    let skipped = 0;

    for (const svc of COIFFURE_SERVICES) {
      if (existingNames.has(svc.name.trim().toLowerCase())) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("salon_services").insert({
        branch_id: branch.id,
        category_id: categoryId,
        name: svc.name,
        price_htg: svc.price_htg,
        price_currency: "HTG",
        is_active: true,
        sort_order: svc.sort_order,
        duration_minutes: 30,
        requires_employee: true,
        commission_percentage: 0,
        metadata: { addon_options: [] },
      });

      if (error) {
        console.error(`  ✗ Erreur pour "${svc.name}": ${error.message}`);
      } else {
        console.log(`  ✓ Créé: ${svc.name} (${svc.price_htg} HTG)`);
        inserted++;
      }
    }

    console.log(`\n  → ${inserted} service(s) créé(s), ${skipped} ignoré(s) (déjà existants)`);
  }

  console.log("\n✅ Seeding terminé !");
}

seed().catch(console.error);
