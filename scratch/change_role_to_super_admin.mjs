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
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    // 1. Temporarily restore super_admin role on profiles
    const { error: updateError } = await client
      .from("profiles")
      .update({
        role: "super_admin",
        role_normalized: "super_admin",
        business_id: null,
        business_type: null
      })
      .eq("id", authData.user.id);
    
    if (updateError) {
      console.error("Error setting role to super_admin:", updateError);
      return;
    }
    console.log("Successfully set admin role to super_admin!");

    // 2. Query ALL businesses
    const { data: businesses } = await client
      .from("businesses")
      .select("id, name, business_type");
    console.log("\n=== ALL BUSINESSES ===");
    console.log(businesses);

    // 3. Query all profiles
    const { data: profiles } = await client
      .from("profiles")
      .select("id, email, business_id, business_name, role");
    console.log("\n=== ALL PROFILES ===");
    console.log(profiles);

    // 4. Query all products counts in auto_parts_products
    const { data: products } = await client
      .from("auto_parts_products")
      .select("business_id");
    
    const pCounts = {};
    products.forEach(p => {
      const bId = p.business_id || 'null';
      pCounts[bId] = (pCounts[bId] || 0) + 1;
    });
    console.log("\n=== PRODUCTS IN auto_parts_products BY business_id ===");
    console.log(pCounts);

    // 5. Query all inventory rows
    const { data: inventory } = await client
      .from("auto_parts_product_inventory")
      .select("business_id, branch_id, stock_quantity, cost_price, unit_price");

    const invCounts = {};
    inventory.forEach(row => {
      const bId = row.business_id || 'null';
      const branchId = row.branch_id || 'null';
      const key = `${bId} | ${branchId}`;
      if (!invCounts[key]) {
        invCounts[key] = { total: 0, withStock: 0, withPrice: 0 };
      }
      invCounts[key].total++;
      if ((row.stock_quantity || 0) > 0) invCounts[key].withStock++;
      if (row.unit_price !== null || row.cost_price !== null) invCounts[key].withPrice++;
    });
    console.log("\n=== ALL INVENTORY GROUPED BY business_id | branch_id ===");
    console.log(invCounts);

  } catch (err) {
    console.error(err);
  }
}
inspect();
