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

    const emptyBranchId = "5251aafb-fac2-4e1c-8096-a6c1994bd5d9";

    // Check if referenced in sales
    const { count: salesCount } = await client
      .from("auto_parts_sales")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", emptyBranchId);

    // Check if referenced in purchases
    const { count: purchasesCount } = await client
      .from("auto_parts_purchases")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", emptyBranchId);

    // Check if referenced in inventory
    const { count: invCount } = await client
      .from("auto_parts_product_inventory")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", emptyBranchId);

    console.log(`=== REFERENCES FOR EMPTY BRANCH ${emptyBranchId} ===`);
    console.log(`Sales: ${salesCount}`);
    console.log(`Purchases: ${purchasesCount}`);
    console.log(`Inventory records: ${invCount}`);

  } catch (err) {
    console.error(err);
  }
}
inspect();
