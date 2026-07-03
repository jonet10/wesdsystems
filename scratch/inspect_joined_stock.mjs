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

    // Query active products join inventory
    const { data: joined, error } = await client
      .from("auto_parts_products")
      .select("id, active, name, auto_parts_product_inventory!inner(stock_quantity, cost_price, active)")
      .eq("auto_parts_product_inventory.business_id", businessId);

    if (error) {
      console.error(error);
      return;
    }

    const withStock = joined.filter(r => {
      const inv = Array.isArray(r.auto_parts_product_inventory) 
        ? r.auto_parts_product_inventory[0] 
        : r.auto_parts_product_inventory;
      return (inv?.stock_quantity || 0) > 0;
    });

    console.log(`Joined rows: ${joined.length}`);
    console.log(`Joined rows with stock > 0: ${withStock.length}`);
    if (withStock.length > 0) {
      console.log("Sample rows with stock > 0:", withStock.slice(0, 5));
    }

  } catch (err) {
    console.error(err);
  }
}
inspect();
