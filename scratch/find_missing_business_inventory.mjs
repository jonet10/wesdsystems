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

    // 1. Fetch all rows in auto_parts_product_inventory where branch_id = '42267c0e-846d-4963-81c1-0ec0b5a1fcc3'
    const { data: rows } = await client
      .from("auto_parts_product_inventory")
      .select("business_id, count(*)")
      .eq("branch_id", "42267c0e-846d-4963-81c1-0ec0b5a1fcc3");

    console.log("=== BUSINESS IDS FOR BRANCH 42267c0e-846d-4963-81c1-0ec0b5a1fcc3 ===");
    
    // Group manual counting
    const { data: rawRows } = await client
      .from("auto_parts_product_inventory")
      .select("business_id, stock_quantity, cost_price, unit_price")
      .eq("branch_id", "42267c0e-846d-4963-81c1-0ec0b5a1fcc3");
    
    const groups = {};
    rawRows.forEach(r => {
      groups[r.business_id] = (groups[r.business_id] || 0) + 1;
    });
    console.log(groups);

  } catch (err) {
    console.error(err);
  }
}
inspect();
