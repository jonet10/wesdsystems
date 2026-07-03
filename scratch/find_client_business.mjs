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

    // 1. Get profile of originalautoparts796@gmail.com
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", "b26d804b-d723-47ec-87b1-2233c042f5ef");
    console.log("=== CLIENT PROFILE ===");
    console.log(profile);

    // 2. Count inventory rows grouped by business_id
    const { data: inventory } = await client
      .from("auto_parts_product_inventory")
      .select("business_id, stock_quantity, cost_price, unit_price");

    const counts = {};
    inventory.forEach(row => {
      const bizId = row.business_id;
      if (!counts[bizId]) {
        counts[bizId] = { total: 0, withStock: 0, withPrice: 0 };
      }
      counts[bizId].total++;
      if ((row.stock_quantity || 0) > 0) counts[bizId].withStock++;
      if (row.unit_price !== null || row.cost_price !== null) counts[bizId].withPrice++;
    });

    console.log("\n=== INVENTORY COUNTS BY BUSINESS ===");
    console.log(counts);

    // 3. Count products in auto_parts_products grouped by business_id (for old/legacy products)
    const { data: legacyProducts } = await client
      .from("auto_parts_products")
      .select("business_id, stock_quantity, unit_price, cost_price");

    const legacyCounts = {};
    legacyProducts.forEach(row => {
      const bizId = row.business_id;
      if (!legacyCounts[bizId]) {
        legacyCounts[bizId] = { total: 0, withStock: 0, withPrice: 0 };
      }
      legacyCounts[bizId].total++;
      if ((row.stock_quantity || 0) > 0) legacyCounts[bizId].withStock++;
      if (row.unit_price !== null || row.cost_price !== null) legacyCounts[bizId].withPrice++;
    });

    console.log("\n=== LEGACY PRODUCTS BY BUSINESS IN auto_parts_products ===");
    console.log(legacyCounts);

  } catch (err) {
    console.error(err);
  }
}
inspect();
