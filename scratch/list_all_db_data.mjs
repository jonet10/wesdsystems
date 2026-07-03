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
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error("SERVICE ROLE KEY IS MISSING!");
  process.exit(1);
}

// Connect with SERVICE ROLE KEY to bypass RLS!
const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function inspect() {
  try {
    // 1. Get all businesses
    const { data: businesses } = await adminClient
      .from("businesses")
      .select("id, name, business_type");
    console.log("=== ALL BUSINESSES (BYPASS RLS) ===");
    console.log(businesses);

    // 2. Count products grouped by business_id in public.auto_parts_products
    const { data: products } = await adminClient
      .from("auto_parts_products")
      .select("business_id");
    
    const pCounts = {};
    products.forEach(p => {
      const bId = p.business_id || 'null';
      pCounts[bId] = (pCounts[bId] || 0) + 1;
    });
    console.log("\n=== ALL PRODUCTS IN auto_parts_products GROUPED BY business_id ===");
    console.log(pCounts);

    // 3. Count inventory records grouped by business_id and branch_id
    const { data: inventory } = await adminClient
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

    // 4. Get all profiles
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, email, business_id, business_name, role");
    console.log("\n=== ALL PROFILES ===");
    console.log(profiles);

  } catch (err) {
    console.error(err);
  }
}
inspect();
