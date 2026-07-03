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

    const businessId = "519b32e7-4cc9-4bb8-9008-4f06447d29fb";

    // Query inventory rows with stock > 0 for this business
    const { data: inventory, error } = await client
      .from("auto_parts_product_inventory")
      .select("product_id, stock_quantity, cost_price, unit_price, branch_id")
      .eq("business_id", businessId)
      .gt("stock_quantity", 0);

    if (error) {
      console.error(error);
      return;
    }

    console.log(`Inventory rows with stock > 0 for Original Auto Parts: ${inventory.length}`);
    if (inventory.length > 0) {
      console.log("Sample inventory rows with stock > 0:", inventory.slice(0, 10));
      
      // Check if product_id exists in products
      const pIds = inventory.map(i => i.product_id);
      const { data: products } = await client
        .from("auto_parts_products")
        .select("id, name, active")
        .in("id", pIds);
      console.log(`Matching products in global catalog: ${products ? products.length : 0}`);
      if (products && products.length > 0) {
        console.log("Sample products:", products.slice(0, 5));
      }
    }

  } catch (err) {
    console.error(err);
  }
}
inspect();
