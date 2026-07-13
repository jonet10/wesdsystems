const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPatch() {
  console.log("Running patch to update existing batches prices from products...");
  
  // We can query all batches where cost_price is 0 or sale_price is 0,
  // then fetch the product and update the batch.
  const { data: batches, error: bErr } = await supabase
    .from("pharmacy_batches")
    .select("id, product_id, cost_price, sale_price")
    .or("cost_price.eq.0,sale_price.eq.0,cost_price.is.null,sale_price.is.null");

  if (bErr) {
    console.error("Error fetching batches:", bErr);
    return;
  }

  console.log(`Found ${batches.length} batches to update.`);

  for (const batch of batches) {
    const { data: prod, error: pErr } = await supabase
      .from("pharmacy_products")
      .select("cost_price, sale_price")
      .eq("id", batch.product_id)
      .single();

    if (pErr || !prod) {
      console.error(`Error fetching product for batch ${batch.id}:`, pErr);
      continue;
    }

    const { error: uErr } = await supabase
      .from("pharmacy_batches")
      .update({
        cost_price: prod.cost_price || 0,
        sale_price: prod.sale_price || 0
      })
      .eq("id", batch.id);

    if (uErr) {
      console.error(`Error updating batch ${batch.id}:`, uErr);
    } else {
      console.log(`Updated batch ${batch.id} with cost: ${prod.cost_price}, sale: ${prod.sale_price}`);
    }
  }

  console.log("Patch completed successfully!");
}

runPatch();
