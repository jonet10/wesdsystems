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

    // 1. Get sum of stock_quantity in auto_parts_product_inventory
    const { data: inventoryData, error: invError } = await client
      .from("auto_parts_product_inventory")
      .select("stock_quantity, cost_price, branch_id")
      .eq("business_id", businessId);

    if (invError) {
      console.error(invError);
      return;
    }

    const totalItems = inventoryData.length;
    const itemsWithStock = inventoryData.filter(i => (i.stock_quantity || 0) > 0);
    const itemsWithPrice = inventoryData.filter(i => i.cost_price !== null);

    console.log(`=== INVENTORY STATS FOR Original Auto Parts (${businessId}) ===`);
    console.log(`Total inventory rows: ${totalItems}`);
    console.log(`Rows with stock > 0: ${itemsWithStock.length}`);
    console.log(`Rows with cost price defined: ${itemsWithPrice.length}`);

    if (itemsWithStock.length > 0) {
      console.log("Sample rows with stock > 0:", itemsWithStock.slice(0, 5));
    }

  } catch (err) {
    console.error(err);
  }
}
inspect();
