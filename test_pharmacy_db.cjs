const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== BUSINESSES ===");
  const { data: b, error: bErr } = await supabase.from('businesses').select('*');
  console.log("Error:", bErr);
  console.dir(b, { depth: null });

  console.log("\n=== PROFILES ===");
  const { data: p, error: pErr } = await supabase.from('profiles').select('*');
  console.log("Error:", pErr);
  console.dir(p, { depth: null });

  console.log("\n=== PHARMACY PRODUCTS ===");
  const { data: prod, error: prodErr } = await supabase.from('pharmacy_products').select('id, name, business_id, total_stock_quantity, active');
  console.log("Error:", prodErr);
  console.dir(prod, { depth: null });

  console.log("\n=== PHARMACY BATCHES ===");
  const { data: bat, error: batErr } = await supabase.from('pharmacy_batches').select('*');
  console.log("Error:", batErr);
  console.dir(bat, { depth: null });

  console.log("\n=== PHARMACY STOCK MOVEMENTS ===");
  const { data: mv, error: mvErr } = await supabase.from('pharmacy_stock_movements').select('*');
  console.log("Error:", mvErr);
  console.dir(mv, { depth: null });
}

inspect();
