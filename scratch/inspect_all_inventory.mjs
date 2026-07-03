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

    const { data: inventory } = await client
      .from("auto_parts_product_inventory")
      .select("branch_id, stock_quantity, unit_price, cost_price");

    const stats = {};
    inventory.forEach(row => {
      const bId = row.branch_id || 'null';
      if (!stats[bId]) {
        stats[bId] = { total: 0, withStock: 0, withUnitPrice: 0, withCostPrice: 0 };
      }
      stats[bId].total++;
      if ((row.stock_quantity || 0) > 0) stats[bId].withStock++;
      if (row.unit_price !== null) stats[bId].withUnitPrice++;
      if (row.cost_price !== null) stats[bId].withCostPrice++;
    });

    console.log("=== INVENTORY DETAILS BY BRANCH ===");
    console.log(stats);

  } catch (err) {
    console.error(err);
  }
}
inspect();
