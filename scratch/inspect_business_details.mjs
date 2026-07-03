import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv() {
  try {
    const envPath = 'c:/Users/herod/OneDrive/Desktop/WesdSystems/.env.local';
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2].trim();
      }
    });
  } catch (error) {
    console.log('Could not load env');
  }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    if (authError) {
      console.error("Super Admin login error:", authError);
      return;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    // 1. Get profile of admin
    const { data: adminProf } = await client
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id);
    console.log("=== ADMIN PROFILE IN DB ===");
    console.log(adminProf);

    // 2. Query businesses table
    const { data: businesses } = await client
      .from("businesses")
      .select("id, name, business_type");
    console.log("\n=== ALL BUSINESSES ===");
    console.log(businesses);

    // 3. Query inventory/stock for business 519b32e7-4cc9-4bb8-9008-4f06447d29fb
    const businessId = "519b32e7-4cc9-4bb8-9008-4f06447d29fb";
    const { data: inventory } = await client
      .from("auto_parts_product_inventory")
      .select("id, product_id, stock_quantity, unit_price")
      .eq("business_id", businessId)
      .limit(5);
    console.log(`\n=== INVENTORY FOR ${businessId} (limit 5) ===`);
    console.log(inventory);

    // 4. Query products count
    const { count: prodCount } = await client
      .from("auto_parts_products")
      .select("*", { count: "exact", head: true });
    console.log(`\nTotal products in global catalog: ${prodCount}`);

  } catch (err) {
    console.error("Exception:", err);
  }
}

inspect();
